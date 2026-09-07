/**
 * Cloudflare Pages Function: /api/patients
 * 
 * Provides dedicated Resident / Patient Registry CRUD and batch intake
 * via Cloudflare D1 SQL Relational Database (`context.env.DB`)
 * and Cloudflare Workers KV Cache (`context.env.SOBBER_KV`).
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Cache-Control, Pragma',
  'Access-Control-Max-Age': '0'
};

const JSON_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Surrogate-Control': 'no-store',
  'CDN-Cache-Control': 'no-store',
  'Cloudflare-CDN-Cache-Control': 'no-store'
};

function isKV(val, key = '') {
  if (!val || typeof val !== 'object') return false;
  const upper = String(key).toUpperCase();
  if (upper === 'ASSETS' || upper === 'DB' || upper === 'BUCKET' || upper === 'CF_PAGES') return false;
  if (typeof val.fetch === 'function') return false;
  if (typeof val.prepare === 'function' || typeof val.exec === 'function') return false;
  return typeof val.get === 'function' && typeof val.put === 'function' && typeof val.list === 'function';
}

function getKV(context) {
  const env = context?.env;
  if (!env || typeof env !== 'object') return null;

  const candidates = [
    env.SOBBER_KV,
    env.MY_KV_NAMESPACE,
    env.KV,
    env.SOBER_KV,
    env.SERENITYCARE_KV
  ];
  for (const c of candidates) {
    if (c && isKV(c)) return c;
  }

  for (const [key, val] of Object.entries(env)) {
    if (isKV(val, key)) return val;
  }
  return null;
}

async function safeKvGet(kv, key) {
  if (!kv) return null;
  try {
    return await kv.get(key, { type: 'text' });
  } catch (err) {
    console.warn(`KV get error for ${key}:`, err.message);
    return null;
  }
}

async function safeKvPut(kv, key, val) {
  if (!kv) return false;
  try {
    await kv.put(key, typeof val === 'string' ? val : JSON.stringify(val));
    return true;
  } catch (err) {
    console.warn(`KV put error for ${key}:`, err.message);
    return false;
  }
}

function isAuthorized(context) {
  const secret = context.env?.ADMIN_SECRET || context.env?.AUTH_SECRET || context.env?.SOBBER_ADMIN_SECRET;
  if (!secret) return true;
  const authHeader = context.request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  return token === secret.trim();
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS
  });
}

export async function onRequestGet(context) {
  try {
    const db = context.env?.DB;
    const kv = getKV(context);

    // 1. Query D1 SQL Database
    if (db && typeof db.prepare === 'function') {
      try {
        const res = await db.prepare("SELECT * FROM patients ORDER BY created_at DESC").all();
        const list = (res.results || []).map(p => {
          if (p.raw_json) {
            try { return JSON.parse(p.raw_json); } catch {}
          }
          return {
            id: p.id,
            admissionNumber: p.admission_number,
            name: p.name,
            dob: p.dob,
            age: p.age,
            gender: p.gender,
            bloodGroup: p.blood_group,
            phone: p.phone,
            email: p.email,
            photoUrl: p.photo_url,
            admissionDate: p.admission_date,
            stage: p.stage,
            roomNumber: p.room_number,
            bedNumber: p.bed_number,
            sobrietyDays: p.sobriety_days
          };
        });
        if (list.length > 0) return new Response(JSON.stringify(list), { status: 200, headers: JSON_HEADERS });
      } catch (e) {
        console.warn('D1 patients get error:', e.message);
      }
    }

    // 2. Query KV
    if (kv) {
      const raw = await safeKvGet(kv, 'sobber_patients');
      if (raw) return new Response(raw, { status: 200, headers: JSON_HEADERS });
    }

    return new Response(JSON.stringify([]), { status: 200, headers: JSON_HEADERS });
  } catch (err) {
    console.error('Patients GET error:', err.message);
    return new Response(JSON.stringify([]), { status: 200, headers: JSON_HEADERS });
  }
}

export async function onRequestPost(context) {
  try {
    if (!isAuthorized(context)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS });
    }

    const db = context.env?.DB;
    const kv = getKV(context);
    let payload;
    try {
      payload = await context.request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: JSON_HEADERS });
    }
    const items = Array.isArray(payload) ? payload : [payload];

    // 1. Save to D1
    if (db && typeof db.prepare === 'function') {
      try {
        const stmts = items.map(p => {
          return db.prepare(`
            INSERT OR REPLACE INTO patients (id, admission_number, name, dob, age, gender, blood_group, phone, email, photo_url, admission_date, stage, room_number, bed_number, counselor_id, sobriety_days, graduation_qualified, graduation_date, status, notes_json, vitals_json, raw_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `).bind(
            p.id,
            p.admissionNumber || p.id,
            p.name,
            p.dob || '1990-01-01',
            p.age || 0,
            p.gender || 'Other',
            p.bloodGroup || '',
            p.phone || '',
            p.email || '',
            p.photoUrl || '',
            p.admissionDate || new Date().toISOString().split('T')[0],
            p.stage || 'Inpatient Recovery',
            p.roomNumber || '',
            p.bedNumber || '',
            p.counselorId || '',
            p.sobrietyDays || 1,
            p.graduationQualified ? 1 : 0,
            p.graduationDate || null,
            p.status || 'Active',
            JSON.stringify(p.notes || []),
            JSON.stringify(p.vitals || []),
            JSON.stringify(p)
          );
        });
        if (typeof db.batch === 'function') {
          await db.batch(stmts);
        }
      } catch (e) {
        console.error('D1 patients insert error:', e.message);
      }
    }

    // 2. Save to KV
    if (kv) {
      let list = [];
      const existing = await safeKvGet(kv, 'sobber_patients');
      if (existing) {
        try { list = JSON.parse(existing); } catch {}
      }
      items.forEach(p => {
        const idx = list.findIndex(item => item.id === p.id);
        if (idx >= 0) list[idx] = { ...list[idx], ...p };
        else list.unshift(p);
      });
      await safeKvPut(kv, 'sobber_patients', list);

      const stateRaw = await safeKvGet(kv, 'sobber_state');
      if (stateRaw) {
        try {
          const s = JSON.parse(stateRaw);
          s.patients = list;
          await safeKvPut(kv, 'sobber_state', s);
        } catch {}
      }
    }

    return new Response(JSON.stringify({ success: true, count: items.length }), { status: 200, headers: JSON_HEADERS });
  } catch (err) {
    console.error('Patients POST error:', err.message);
    return new Response(JSON.stringify({ success: true, localOnly: true, warning: err.message }), { status: 200, headers: JSON_HEADERS });
  }
}

export async function onRequestDelete(context) {
  try {
    if (!isAuthorized(context)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS });
    }

    const db = context.env?.DB;
    const kv = getKV(context);
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');
    if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: JSON_HEADERS });

    if (db && typeof db.prepare === 'function') {
      try { await db.prepare("DELETE FROM patients WHERE id = ?").bind(id).run(); } catch (e) {}
    }

    if (kv) {
      let list = [];
      const existing = await safeKvGet(kv, 'sobber_patients');
      if (existing) {
        try { list = JSON.parse(existing); } catch {}
      }
      list = list.filter(p => p.id !== id);
      await safeKvPut(kv, 'sobber_patients', list);
    }

    return new Response(JSON.stringify({ success: true, deletedId: id }), { status: 200, headers: JSON_HEADERS });
  } catch (err) {
    console.error('Patients DELETE error:', err.message);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: JSON_HEADERS });
  }
}
