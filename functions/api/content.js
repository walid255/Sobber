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
  // If no secret is configured in Cloudflare environment, allow writes backward-compatibly
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
        message: 'KV namespace not bound (bind SOBBER_KV or KV in Cloudflare Settings)' 
      }), {
        status: 200,
        headers: JSON_HEADERS
      });
    }

    let rawData = await kv.get('site_data', { type: 'text', cacheTtl: 0 });
    if (!rawData) {
      rawData = await kv.get('sobber_content', { type: 'text', cacheTtl: 0 });
    }
    if (!rawData) {
      // Fallback check if state exists
      rawData = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
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
    return new Response(JSON.stringify({ 
      error: 'Failed to retrieve content from Cloudflare KV', 
      message: err.message 
    }), {
      status: 500,
      headers: JSON_HEADERS
    });
  }
}

export async function onRequestPost(context) {
  try {
    // 1. Verify Bearer token authorization if server environment has secret configured
    if (!isAuthorized(context)) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Unauthorized: Invalid or missing Bearer token in Authorization header' 
      }), {
        status: 401,
        headers: JSON_HEADERS
      });
    }

    // 2. Validate KV binding
    const kv = getKV(context);
    if (!kv) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Cloudflare KV namespace binding missing. Please bind SOBBER_KV, MY_KV_NAMESPACE, or KV in Cloudflare Pages Settings.' 
      }), {
        status: 500,
        headers: JSON_HEADERS
      });
    }

    // 3. Parse incoming payload
    let newData;
    try {
      newData = await context.request.json();
    } catch {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid JSON payload. Please send valid JSON data in request body.' 
      }), {
        status: 400,
        headers: JSON_HEADERS
      });
    }

    const timestamp = new Date().toISOString();
    const version = Date.now();

    // Attach metadata if object
    if (newData && typeof newData === 'object' && !Array.isArray(newData)) {
      newData.lastUpdated = timestamp;
      newData.contentVersion = version;
    }

    const stringified = JSON.stringify(newData);

    // 4. Persist to KV under 'site_data' and 'sobber_content'
    await kv.put('site_data', stringified);
    await kv.put('sobber_content', stringified);

    // 5. If payload contains full application state, update 'sobber_state' and sub-collections
    if (newData && typeof newData === 'object') {
      if (Array.isArray(newData.users) || Array.isArray(newData.patients)) {
        await kv.put('sobber_state', JSON.stringify(newData));
        if (Array.isArray(newData.users)) await kv.put('sobber_users', JSON.stringify(newData.users));
        if (Array.isArray(newData.patients)) await kv.put('sobber_patients', JSON.stringify(newData.patients));
        if (Array.isArray(newData.medicationLogs)) await kv.put('sobber_medications', JSON.stringify(newData.medicationLogs));
        if (Array.isArray(newData.inventory)) await kv.put('sobber_inventory', JSON.stringify(newData.inventory));
        if (Array.isArray(newData.timetable)) await kv.put('sobber_timetable', JSON.stringify(newData.timetable));
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Updated globally in KV',
      timestamp: timestamp,
      version: version,
      data: newData
    }), {
      status: 200,
      headers: JSON_HEADERS
    });
  } catch (err) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to write content to Cloudflare KV', 
      message: err.message 
    }), {
      status: 500,
      headers: JSON_HEADERS
    });
  }
}
