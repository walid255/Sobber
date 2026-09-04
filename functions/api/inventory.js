/**
 * Cloudflare Pages Function: /api/inventory
 * 
 * Provides dedicated Pharmacy & Logistics Store inventory synchronization
 * via Cloudflare Workers KV.
 * 
 * KV Binding: SOBBER_KV (primary) or KV (fallback)
 * Storage Key: "sobber_inventory"
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
  try {
    const kv = getKV(context);
    if (!kv) {
      return new Response(JSON.stringify([]), { status: 200, headers: JSON_HEADERS });
    }

    let raw = await kv.get('sobber_inventory', { type: 'text', cacheTtl: 0 });
    let items = [];

    if (raw) {
      try { items = JSON.parse(raw); } catch {}
    } else {
      const stateRaw = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
      if (stateRaw) {
        try {
          const parsed = JSON.parse(stateRaw);
          if (Array.isArray(parsed.inventory)) {
            items = parsed.inventory;
            await kv.put('sobber_inventory', JSON.stringify(items));
          }
        } catch {}
      }
    }

    return new Response(JSON.stringify(Array.isArray(items) ? items : []), {
      status: 200,
      headers: JSON_HEADERS
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
  }
}

export async function onRequestPost(context) {
  try {
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

    let items = [];
    const raw = await kv.get('sobber_inventory', { type: 'text', cacheTtl: 0 });
    if (raw) {
      try { items = JSON.parse(raw); } catch {}
    }
    if (!Array.isArray(items)) items = [];

    if (Array.isArray(payload)) {
      items = payload;
    } else if (typeof payload === 'object') {
      const item = { ...payload };
      if (!item.id) {
        item.id = 'INV-' + (100 + items.length + 1);
      }
      item.updatedAt = new Date().toISOString();

      const existingIdx = items.findIndex(i => i.id === item.id);
      if (existingIdx !== -1) {
        items[existingIdx] = { ...items[existingIdx], ...item };
      } else {
        items.unshift(item);
      }
    }

    await kv.put('sobber_inventory', JSON.stringify(items));

    // Update sobber_state
    const stateRaw = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
    let stateObj = null;
    if (stateRaw) {
      try {
        stateObj = JSON.parse(stateRaw);
        stateObj.inventory = items;
        stateObj.lastSyncedAt = new Date().toISOString();
        stateObj.stateVersion = Date.now();
        await kv.put('sobber_state', JSON.stringify(stateObj));
      } catch {}
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Inventory item saved to SOBBER_KV',
      count: items.length,
      data: items,
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
