/**
 * Cloudflare Pages Function: /api/users
 * 
 * Provides dedicated Staff & RBAC user synchronization across browsers
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

const DEFAULT_ADMIN_USER = {
  id: 'usr_admin',
  name: 'System Administrator',
  email: 'admin@serenitycare.org',
  password: 'Admin@Serenity2026!',
  role: 'admin',
  phone: '+1 (800) 555-7623',
  department: 'Clinical Administration',
  status: 'Active',
  lastLogin: null,
  permissions: {
    dashboard: true,
    patients: true,
    medications: true,
    timetable: true,
    inventory: true,
    certificates: true,
    batch_upload: true,
    users: true,
    settings: true,
    payments: true
  }
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

    // 1. Check D1 SQL Database
    if (db) {
      try {
        const res = await db.prepare("SELECT * FROM users ORDER BY created_at ASC").all();
        const list = (res.results || []).map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          password: u.password_hash,
          role: u.role,
          department: u.department,
          phone: u.phone,
          status: u.status,
          permissions: u.permissions_json ? JSON.parse(u.permissions_json) : { dashboard: true, payments: true, users: true },
          lastLogin: u.last_login
        }));
        if (list.length > 0) return new Response(JSON.stringify(list), { headers: JSON_HEADERS });
      } catch (e) {}
    }

    // 2. Check KV Cache
    if (kv) {
      let raw = await kv.get('sobber_users', { type: 'text', cacheTtl: 0 });
      if (raw) return new Response(raw, { headers: JSON_HEADERS });
    }

    return new Response(JSON.stringify([DEFAULT_ADMIN_USER]), { headers: JSON_HEADERS });
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
        const stmts = items.map(u => {
          return db.prepare(`
            INSERT OR REPLACE INTO users (id, name, email, password_hash, role, department, phone, status, permissions_json, last_login, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `).bind(
            u.id || `usr_${Date.now()}`,
            u.name,
            u.email,
            u.password || 'SerenityCare2026!',
            u.role || 'nurse',
            u.department || 'Clinical',
            u.phone || '',
            u.status || 'Active',
            JSON.stringify(u.permissions || {}),
            u.lastLogin || null
          );
        });
        await db.batch(stmts);
      } catch (e) {
        console.error('D1 users insert error:', e);
      }
    }

    // 2. Save to KV
    if (kv) {
      let current = [];
      const existing = await kv.get('sobber_users', { type: 'text', cacheTtl: 0 });
      if (existing) {
        try { current = JSON.parse(existing); } catch {}
      }
      items.forEach(u => {
        const idx = current.findIndex(usr => usr.id === u.id || usr.email === u.email);
        if (idx >= 0) current[idx] = { ...current[idx], ...u };
        else current.push(u);
      });
      await kv.put('sobber_users', JSON.stringify(current));

      const stateRaw = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
      if (stateRaw) {
        try {
          const s = JSON.parse(stateRaw);
          s.users = current;
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
      try { await db.prepare("DELETE FROM users WHERE id = ?").bind(id).run(); } catch (e) {}
    }

    if (kv) {
      let list = [];
      const raw = await kv.get('sobber_users', { type: 'text', cacheTtl: 0 });
      if (raw) {
        try { list = JSON.parse(raw); } catch {}
      }
      list = list.filter(u => u.id !== id);
      await kv.put('sobber_users', JSON.stringify(list));
    }

    return new Response(JSON.stringify({ success: true, deletedId: id }), { headers: JSON_HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
  }
}
