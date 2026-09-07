/**
 * Cloudflare Pages Function: /api/medications
 * 
 * Provides dedicated Medication Administration Records (MAR) & Prescriptions
 * storage and tracking via Cloudflare Workers KV.
 * 
 * KV Binding: SOBBER_KV (primary) or KV (fallback)
 * Storage Key: "sobber_medications"
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
    const kv = getKV(context);
    if (!kv) {
      return new Response(JSON.stringify([]), { status: 200, headers: JSON_HEADERS });
    }

    let raw = await kv.get('sobber_medications', { type: 'text', cacheTtl: 0 });
    let logs = [];

    if (raw) {
      try { logs = JSON.parse(raw); } catch {}
    } else {
      const stateRaw = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
      if (stateRaw) {
        try {
          const parsed = JSON.parse(stateRaw);
          if (Array.isArray(parsed.medicationLogs)) {
            logs = parsed.medicationLogs;
            await kv.put('sobber_medications', JSON.stringify(logs));
          }
        } catch {}
      }
    }

    return new Response(JSON.stringify(Array.isArray(logs) ? logs : []), {
      status: 200,
      headers: JSON_HEADERS
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
  }
}

export async function onRequestPost(context) {
  try {
    if (!isAuthorized(context)) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Unauthorized: Invalid or missing Bearer token in Authorization header' 
      }), { 
        status: 401, 
        headers: JSON_HEADERS 
      });
    }

    const kv = getKV(context);
    if (!kv) {
      return new Response(JSON.stringify({ success: false, error: 'KV namespace not bound' }), { 
        status: 500, 
        headers: JSON_HEADERS 
      });
    }

    let payload;
    try {
      payload = await context.request.json();
    } catch {
      return new Response(JSON.stringify({ success: false, error: 'Invalid JSON payload' }), { 
        status: 400, 
        headers: JSON_HEADERS 
      });
    }

    if (!payload) {
      return new Response(JSON.stringify({ success: false, error: 'Empty payload' }), { 
        status: 400, 
        headers: JSON_HEADERS 
      });
    }

    let logs = [];
    const raw = await kv.get('sobber_medications', { type: 'text', cacheTtl: 0 });
    if (raw) {
      try { logs = JSON.parse(raw); } catch {}
    }
    if (!Array.isArray(logs)) logs = [];

    // Scenario A: Array of logs (bulk update or full sync)
    if (Array.isArray(payload)) {
      logs = payload;
    } 
    // Scenario B: Single MAR entry administration or addition
    else if (typeof payload === 'object') {
      const logItem = { ...payload };
      if (!logItem.id) {
        logItem.id = 'mar_' + Date.now().toString(36);
      }
      logItem.updatedAt = new Date().toISOString();

      const existingIdx = logs.findIndex(l => l.id === logItem.id);
      if (existingIdx !== -1) {
        logs[existingIdx] = { ...logs[existingIdx], ...logItem };
      } else {
        logs.unshift(logItem);
      }
    }

    await kv.put('sobber_medications', JSON.stringify(logs));

    // Update sobber_state
    const stateRaw = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
    let stateObj = null;
    if (stateRaw) {
      try {
        stateObj = JSON.parse(stateRaw);
        stateObj.medicationLogs = logs;
        stateObj.lastSyncedAt = new Date().toISOString();
        stateObj.stateVersion = Date.now();
        await kv.put('sobber_state', JSON.stringify(stateObj));
      } catch {}
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Medication administration record saved to SOBBER_KV',
      count: logs.length,
      data: logs,
      version: stateObj?.stateVersion || Date.now()
    }), {
      status: 200,
      headers: JSON_HEADERS
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { 
      status: 500, 
      headers: JSON_HEADERS 
    });
  }
}
