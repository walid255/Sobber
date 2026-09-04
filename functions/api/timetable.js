/**
 * Cloudflare Pages Function: /api/timetable
 * 
 * Provides dedicated House Routine & Activity Timetable synchronization
 * via Cloudflare Workers KV.
 * 
 * KV Binding: SOBBER_KV (primary) or KV (fallback)
 * Storage Key: "sobber_timetable"
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
  try {
    const kv = getKV(context);
    if (!kv) {
      return new Response(JSON.stringify([]), { status: 200, headers: JSON_HEADERS });
    }

    let raw = await kv.get('sobber_timetable');
    let schedule = [];

    if (raw) {
      try { schedule = JSON.parse(raw); } catch {}
    } else {
      const stateRaw = await kv.get('sobber_state');
      if (stateRaw) {
        try {
          const parsed = JSON.parse(stateRaw);
          if (Array.isArray(parsed.timetable)) {
            schedule = parsed.timetable;
            await kv.put('sobber_timetable', JSON.stringify(schedule));
          }
        } catch {}
      }
    }

    return new Response(JSON.stringify(Array.isArray(schedule) ? schedule : []), {
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

    let schedule = [];
    const raw = await kv.get('sobber_timetable');
    if (raw) {
      try { schedule = JSON.parse(raw); } catch {}
    }
    if (!Array.isArray(schedule)) schedule = [];

    if (Array.isArray(payload)) {
      schedule = payload;
    } else if (typeof payload === 'object') {
      const item = { ...payload };
      if (!item.id) {
        item.id = 'ev_' + Date.now().toString(36);
      }
      const existingIdx = schedule.findIndex(s => s.id === item.id);
      if (existingIdx !== -1) {
        schedule[existingIdx] = { ...schedule[existingIdx], ...item };
      } else {
        schedule.push(item);
      }
    }

    await kv.put('sobber_timetable', JSON.stringify(schedule));

    // Update sobber_state
    const stateRaw = await kv.get('sobber_state');
    if (stateRaw) {
      try {
        const stateObj = JSON.parse(stateRaw);
        stateObj.timetable = schedule;
        stateObj.lastSyncedAt = new Date().toISOString();
        await kv.put('sobber_state', JSON.stringify(stateObj));
      } catch {}
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'House timetable updated in SOBBER_KV',
      count: schedule.length,
      data: schedule
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
