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
      return new Response(JSON.stringify([]), { status: 200, headers: JSON_HEADERS });
    }

    let raw = await safeKvGet(kv, 'sobber_medications');
    let logs = [];

    if (raw) {
      try { logs = JSON.parse(raw); } catch {}
    } else {
      const stateRaw = await safeKvGet(kv, 'sobber_state');
      if (stateRaw) {
        try {
          const parsed = JSON.parse(stateRaw);
          if (Array.isArray(parsed.medicationLogs)) {
            logs = parsed.medicationLogs;
            safeKvPut(kv, 'sobber_medications', logs).catch(() => {});
          }
        } catch {}
      }
    }

    return new Response(JSON.stringify(Array.isArray(logs) ? logs : []), {
      status: 200,
      headers: JSON_HEADERS
    });
  } catch (err) {
    console.error('Medications GET error:', err.message);
    return new Response(JSON.stringify([]), { status: 200, headers: JSON_HEADERS });
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
    if (kv) {
      const raw = await safeKvGet(kv, 'sobber_medications');
      if (raw) {
        try { logs = JSON.parse(raw); } catch {}
      }
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

    if (kv) {
      await safeKvPut(kv, 'sobber_medications', logs);

      // Update sobber_state
      const stateRaw = await safeKvGet(kv, 'sobber_state');
      if (stateRaw) {
        try {
          const stateObj = JSON.parse(stateRaw);
          stateObj.medicationLogs = logs;
          stateObj.lastSyncedAt = new Date().toISOString();
          stateObj.stateVersion = Date.now();
          await safeKvPut(kv, 'sobber_state', stateObj);
        } catch {}
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: kv ? 'Medication administration record saved to SOBBER_KV' : 'Saved (local mode)',
      count: logs.length,
      data: logs,
      version: Date.now()
    }), {
      status: 200,
      headers: JSON_HEADERS
    });
  } catch (err) {
    console.error('Medications POST error:', err.message);
    return new Response(JSON.stringify({ success: true, localOnly: true, warning: err.message }), { 
      status: 200, 
      headers: JSON_HEADERS 
    });
  }
}
