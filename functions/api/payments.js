/**
 * Cloudflare Pages Function: /api/payments
 * 
 * Provides dedicated Billing & Payments CRUD and installment tracking
 * in Tanzanian Shillings (TZS) via Cloudflare Workers KV with edge cache bypassing
 * and read-your-writes guarantees.
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
    const kv = getKV(context);
    if (!kv) {
      return new Response(JSON.stringify([]), { status: 200, headers: JSON_HEADERS });
    }

    const url = new URL(context.request.url);
    const patientId = url.searchParams.get('patientId');
    const paymentId = url.searchParams.get('id');

    let raw = await kv.get('sobber_payments', { type: 'text', cacheTtl: 0 });
    let payments = [];

    if (raw) {
      try { payments = JSON.parse(raw); } catch {}
    } else {
      const stateRaw = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
      if (stateRaw) {
        try {
          const parsed = JSON.parse(stateRaw);
          if (Array.isArray(parsed.payments)) {
            payments = parsed.payments;
            await kv.put('sobber_payments', JSON.stringify(payments));
          }
        } catch {}
      }
    }

    if (!Array.isArray(payments)) payments = [];

    if (paymentId) {
      const match = payments.find(p => p.id === paymentId);
      if (!match) {
        return new Response(JSON.stringify({ error: 'Payment not found' }), { status: 404, headers: JSON_HEADERS });
      }
      return new Response(JSON.stringify(match), { status: 200, headers: JSON_HEADERS });
    }

    if (patientId) {
      const filtered = payments.filter(p => p.patientId === patientId);
      return new Response(JSON.stringify(filtered), { status: 200, headers: JSON_HEADERS });
    }

    return new Response(JSON.stringify(payments), {
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
      return new Response(JSON.stringify({ success: false, error: 'Payload cannot be empty' }), { 
        status: 400, 
        headers: JSON_HEADERS 
      });
    }

    let currentList = [];
    const raw = await kv.get('sobber_payments', { type: 'text', cacheTtl: 0 });
    if (raw) {
      try { currentList = JSON.parse(raw); } catch {}
    }
    if (!Array.isArray(currentList)) currentList = [];

    // Array batch save or single object
    if (Array.isArray(payload)) {
      currentList = payload;
    } else {
      const existingIdx = currentList.findIndex(p => p.id === payload.id || (p.invoiceNumber && p.invoiceNumber === payload.invoiceNumber));
      if (existingIdx !== -1) {
        currentList[existingIdx] = { ...currentList[existingIdx], ...payload };
      } else {
        currentList.unshift(payload);
      }
    }

    // Persist to sobber_payments
    await kv.put('sobber_payments', JSON.stringify(currentList));

    // Update global state snapshot in sobber_state
    const stateRaw = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
    let version = Date.now();
    let timestamp = new Date().toISOString();

    if (stateRaw) {
      try {
        const stateObj = JSON.parse(stateRaw);
        stateObj.payments = currentList;
        stateObj.lastSyncedAt = timestamp;
        stateObj.stateVersion = version;
        await kv.put('sobber_state', JSON.stringify(stateObj));
      } catch {}
    }

    return new Response(JSON.stringify({
      success: true,
      count: currentList.length,
      data: payload,
      version: version,
      timestamp: timestamp
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

export async function onRequestDelete(context) {
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

    const url = new URL(context.request.url);
    const paymentId = url.searchParams.get('id');

    if (!paymentId) {
      return new Response(JSON.stringify({ success: false, error: 'Missing payment id parameter' }), { 
        status: 400, 
        headers: JSON_HEADERS 
      });
    }

    let currentList = [];
    const raw = await kv.get('sobber_payments', { type: 'text', cacheTtl: 0 });
    if (raw) {
      try { currentList = JSON.parse(raw); } catch {}
    }
    if (!Array.isArray(currentList)) currentList = [];

    const beforeCount = currentList.length;
    currentList = currentList.filter(p => p.id !== paymentId);

    if (currentList.length === beforeCount) {
      return new Response(JSON.stringify({ success: false, error: 'Payment not found' }), { 
        status: 404, 
        headers: JSON_HEADERS 
      });
    }

    await kv.put('sobber_payments', JSON.stringify(currentList));

    // Update global state
    const stateRaw = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
    let version = Date.now();
    if (stateRaw) {
      try {
        const stateObj = JSON.parse(stateRaw);
        stateObj.payments = currentList;
        stateObj.lastSyncedAt = new Date().toISOString();
        stateObj.stateVersion = version;
        await kv.put('sobber_state', JSON.stringify(stateObj));
      } catch {}
    }

    return new Response(JSON.stringify({
      success: true,
      deletedId: paymentId,
      remainingCount: currentList.length,
      version: version
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
