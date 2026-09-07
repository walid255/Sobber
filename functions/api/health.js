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

  let d1Status = { connected: Boolean(db), tables: 0, counts: {} };
  if (db) {
    try {
      const tblRes = await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      d1Status.tables = (tblRes.results || []).length;
      if (d1Status.tables > 0) {
        const uCount = await db.prepare("SELECT COUNT(*) as c FROM users").first();
        const pCount = await db.prepare("SELECT COUNT(*) as c FROM patients").first();
        const payCount = await db.prepare("SELECT COUNT(*) as c FROM payments").first();
        d1Status.counts = {
          users: uCount ? uCount.c : 0,
          patients: pCount ? pCount.c : 0,
          payments: payCount ? payCount.c : 0
        };
      }
    } catch (e) {
      d1Status.error = e.message;
    }
  }

  let kvOperational = false;
  if (kv) {
    try {
      await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
      kvOperational = true;
    } catch (e) {}
  }

  return new Response(JSON.stringify({
    system: 'SerenityCare Recovery Management System',
    status: 'online',
    timestamp: new Date().toISOString(),
    edgeLocation: context.request?.cf?.colo || 'PagesEdge',
    kv: {
      connected: Boolean(kv),
      operational: kvOperational,
      binding: context.env?.SOBBER_KV ? 'SOBBER_KV' : (context.env?.MY_KV_NAMESPACE ? 'MY_KV_NAMESPACE' : (context.env?.KV ? 'KV' : 'None'))
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
