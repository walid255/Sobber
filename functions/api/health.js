/**
 * Cloudflare Pages Function: /api/health
 * 
 * Verifies system operational status and Cloudflare Workers KV connectivity.
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
  let kvReadWriteOk = false;
  let errorDetail = null;

  if (kv) {
    try {
      const pingVal = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
      kvReadWriteOk = true;
    } catch (e) {
      errorDetail = e.message;
    }
  }

  return new Response(JSON.stringify({
    system: 'SerenityCare Recovery Management System',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    cloudflare: {
      pagesFunctions: true,
      kvBound: Boolean(kv),
      kvBindingName: context.env?.SOBBER_KV ? 'SOBBER_KV' : (context.env?.KV ? 'KV' : 'None'),
      kvOperational: kvReadWriteOk,
      error: errorDetail
    },
    endpoints: [
      '/api/content',
      '/api/sync',
      '/api/users',
      '/api/patients',
      '/api/medications',
      '/api/inventory',
      '/api/timetable',
      '/api/payments',
      '/api/health'
    ]
  }), {
    status: 200,
    headers: JSON_HEADERS
  });
}
