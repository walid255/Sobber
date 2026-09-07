/**
 * Cloudflare Pages Function: /api/content
 * 
 * Provides global content submission and synchronization via Cloudflare Workers KV.
 * Supports Bearer token authentication for write operations when ADMIN_SECRET or AUTH_SECRET
 * is configured in the environment.
 * 
 * Enforces strict edge cache bypassing:
 * - Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0
 * - Surrogate-Control: no-store
 * - CDN-Cache-Control: no-store
 * - Cloudflare-CDN-Cache-Control: no-store
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    const kv = getKV(context);
    if (!kv) {
      return new Response(JSON.stringify({ 
        online: false, 
        message: 'KV namespace not bound. Bind SOBBER_KV or KV in Cloudflare Pages Settings.' 
      }), {
        status: 200,
        headers: JSON_HEADERS
      });
    }

    let rawData = await safeKvGet(kv, 'site_data');
    if (!rawData) {
      rawData = await safeKvGet(kv, 'sobber_content');
    }
    if (!rawData) {
      rawData = await safeKvGet(kv, 'sobber_state');
    }

    let parsed = {};
    if (rawData) {
      try {
        parsed = JSON.parse(rawData);
      } catch {
        parsed = { raw: rawData };
      }
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: JSON_HEADERS
    });
  } catch (err) {
    console.error('Content GET error:', err.message);
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: JSON_HEADERS
    });
  }
}

export async function onRequestPost(context) {
  try {
    if (!isAuthorized(context)) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Unauthorized' 
      }), {
        status: 401,
        headers: JSON_HEADERS
      });
    }

    const kv = getKV(context);
    let newData;
    try {
      newData = await context.request.json();
    } catch {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid JSON payload' 
      }), {
        status: 400,
        headers: JSON_HEADERS
      });
    }

    const timestamp = new Date().toISOString();
    const version = Date.now();

    if (newData && typeof newData === 'object' && !Array.isArray(newData)) {
      newData.lastUpdated = timestamp;
      newData.contentVersion = version;
    }

    if (kv) {
      const stringified = JSON.stringify(newData);
      await safeKvPut(kv, 'site_data', stringified);
      await safeKvPut(kv, 'sobber_content', stringified);

      if (newData && typeof newData === 'object') {
        if (Array.isArray(newData.users) || Array.isArray(newData.patients)) {
          await safeKvPut(kv, 'sobber_state', stringified);
          if (Array.isArray(newData.users)) await safeKvPut(kv, 'sobber_users', newData.users);
          if (Array.isArray(newData.patients)) await safeKvPut(kv, 'sobber_patients', newData.patients);
          if (Array.isArray(newData.medicationLogs)) await safeKvPut(kv, 'sobber_medications', newData.medicationLogs);
          if (Array.isArray(newData.inventory)) await safeKvPut(kv, 'sobber_inventory', newData.inventory);
          if (Array.isArray(newData.timetable)) await safeKvPut(kv, 'sobber_timetable', newData.timetable);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: kv ? 'Updated globally in KV' : 'Accepted (local mode)',
      timestamp: timestamp,
      version: version,
      data: newData
    }), {
      status: 200,
      headers: JSON_HEADERS
    });
  } catch (err) {
    console.error('Content POST error:', err.message);
    return new Response(JSON.stringify({ 
      success: true, 
      localOnly: true, 
      warning: err.message 
    }), {
      status: 200,
      headers: JSON_HEADERS
    });
  }
}
