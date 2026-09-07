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

function getKV(context) {
  if (context.env?.SOBBER_KV) return context.env.SOBBER_KV;
  if (context.env?.MY_KV_NAMESPACE) return context.env.MY_KV_NAMESPACE;
  if (context.env?.KV) return context.env.KV;
  if (context.env?.SOBER_KV) return context.env.SOBER_KV;
  if (context.env?.SERENITYCARE_KV) return context.env.SERENITYCARE_KV;
  
  if (context.env && typeof context.env === 'object') {
    for (const key of Object.keys(context.env)) {
      const val = context.env[key];
      if (val && typeof val.get === 'function' && typeof val.put === 'function') {
        return val;
      }
    }
  }
  return null;
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
    if (db) {
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
        if (list.length > 0) return new Response(JSON.stringify(list), { headers: JSON_HEADERS });
      } catch (e) {}
    }

    // 2. Query KV
    if (kv) {
      const raw = await kv.get('sobber_patients', { type: 'text', cacheTtl: 0 });
      if (raw) return new Response(raw, { headers: JSON_HEADERS });
    }

    return new Response(JSON.stringify([]), { headers: JSON_HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
  }
}

export async function onRequestPost(context) {
  try {
    if (!isAuthorized(context)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS });
    }

    const db = context.env?.DB;
    const kv = getKV(context);
    const payload = await context.request.json();
    const items = Array.isArray(payload) ? payload : [payload];

    // 1. Save to D1
    if (db) {
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
        await db.batch(stmts);
      } catch (e) {
        console.error('D1 patients insert error:', e);
      }
    }

    // 2. Save to KV
    if (kv) {
      let list = [];
      const existing = await kv.get('sobber_patients', { type: 'text', cacheTtl: 0 });
      if (existing) {
        try { list = JSON.parse(existing); } catch {}
      }
      items.forEach(p => {
        const idx = list.findIndex(item => item.id === p.id);
        if (idx >= 0) list[idx] = { ...list[idx], ...p };
        else list.unshift(p);
      });
      await kv.put('sobber_patients', JSON.stringify(list));

      const stateRaw = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
      if (stateRaw) {
        try {
          const s = JSON.parse(stateRaw);
          s.patients = list;
          await kv.put('sobber_state', JSON.stringify(s));
        } catch {}
      }
    }

    return new Response(JSON.stringify({ success: true, count: items.length }), { headers: JSON_HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
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

    if (db) {
      try { await db.prepare("DELETE FROM patients WHERE id = ?").bind(id).run(); } catch (e) {}
    }

    if (kv) {
      let list = [];
      const existing = await kv.get('sobber_patients', { type: 'text', cacheTtl: 0 });
      if (existing) {
        try { list = JSON.parse(existing); } catch {}
      }
      list = list.filter(p => p.id !== id);
      await kv.put('sobber_patients', JSON.stringify(list));
    }

    return new Response(JSON.stringify({ success: true, deletedId: id }), { headers: JSON_HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
  }
}
