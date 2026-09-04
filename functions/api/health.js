/**
 * Cloudflare Pages Function: /api/health
 * 
 * Verifies system operational status and Cloudflare Workers KV connectivity.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

const JSON_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate'
};

function getKV(context) {
  return context.env?.SOBBER_KV || context.env?.KV || context.env?.SERENITYCARE_KV;
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
      const pingVal = await kv.get('sobber_state');
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
      '/api/sync',
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
