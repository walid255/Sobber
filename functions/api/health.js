/**
 * Cloudflare Pages Function: /api/health
 * 
 * Verifies system operational status and bindings for:
 * - Cloudflare Workers KV (`SOBBER_KV`, `MY_KV_NAMESPACE`, `KV`)
 * - Cloudflare D1 SQL Relational Database (`DB`)
 * - Cloudflare R2 Object Storage (`BUCKET`)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS
  });
}

export async function onRequestGet(context) {
  const kv = getKV(context);
  const db = context.env?.DB;
  const bucket = context.env?.BUCKET;

  let d1Status = { connected: Boolean(db && typeof db.prepare === 'function'), tables: 0, counts: {} };
  if (db && typeof db.prepare === 'function') {
    try {
      const tblRes = await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      d1Status.tables = (tblRes.results || []).length;
      if (d1Status.tables > 0) {
        try {
          const uCount = await db.prepare("SELECT COUNT(*) as c FROM users").first();
          const pCount = await db.prepare("SELECT COUNT(*) as c FROM patients").first();
          const payCount = await db.prepare("SELECT COUNT(*) as c FROM payments").first();
          d1Status.counts = {
            users: uCount ? uCount.c : 0,
            patients: pCount ? pCount.c : 0,
            payments: payCount ? payCount.c : 0
          };
        } catch (cntErr) {}
      }
    } catch (e) {
      d1Status.error = e.message;
    }
  }

  let kvOperational = false;
  if (kv) {
    try {
      await kv.get('sobber_state', { type: 'text' });
      kvOperational = true;
    } catch (e) {
      kvOperational = false;
    }
  }

  let kvBindingName = 'None';
  if (context.env?.SOBBER_KV) kvBindingName = 'SOBBER_KV';
  else if (context.env?.MY_KV_NAMESPACE) kvBindingName = 'MY_KV_NAMESPACE';
  else if (context.env?.KV) kvBindingName = 'KV';
  else if (kv) kvBindingName = 'Active_KV';

  return new Response(JSON.stringify({
    system: 'SerenityCare Recovery Management System',
    status: 'online',
    timestamp: new Date().toISOString(),
    edgeLocation: context.request?.cf?.colo || 'PagesEdge',
    kv: {
      connected: Boolean(kv),
      operational: kvOperational,
      binding: kvBindingName
    },
    d1: d1Status,
    r2: {
      connected: Boolean(bucket)
    },
    endpoints: [
      '/api/content',
      '/api/sync',
      '/api/payments',
      '/api/users',
      '/api/patients',
      '/api/medications',
      '/api/inventory',
      '/api/timetable',
      '/api/health'
    ]
  }), {
    status: 200,
    headers: JSON_HEADERS
  });
}
