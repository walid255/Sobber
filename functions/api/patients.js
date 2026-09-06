/**
 * Cloudflare Pages Function: /api/patients
 * 
 * Provides dedicated Resident / Patient Registry CRUD and batch intake
 * via Cloudflare Workers KV with edge cache bypassing and read-your-writes guarantees.
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

    let raw = await kv.get('sobber_patients', { type: 'text', cacheTtl: 0 });
    let patients = [];

    if (raw) {
      try { patients = JSON.parse(raw); } catch {}
    } else {
      const stateRaw = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
      if (stateRaw) {
        try {
          const parsed = JSON.parse(stateRaw);
          if (Array.isArray(parsed.patients)) {
            patients = parsed.patients;
            await kv.put('sobber_patients', JSON.stringify(patients));
          }
        } catch {}
      }
    }

    return new Response(JSON.stringify(Array.isArray(patients) ? patients : []), {
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
    const raw = await kv.get('sobber_patients', { type: 'text', cacheTtl: 0 });
    if (raw) {
      try { currentList = JSON.parse(raw); } catch {}
    }
    if (!Array.isArray(currentList)) currentList = [];

    // Scenario A: Batch intake (array of patients)
    if (Array.isArray(payload)) {
      const addedIds = [];
      payload.forEach((p, idx) => {
        const item = { ...p };
        if (!item.id) {
          item.id = 'PAT-' + (100 + currentList.length + 1 + idx);
        }
        if (!item.admissionDate) {
          item.admissionDate = new Date().toISOString().split('T')[0];
        }
        currentList.unshift(item);
        addedIds.push(item.id);
      });

      await kv.put('sobber_patients', JSON.stringify(currentList));

      // Also update sobber_state
      const stateRaw = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
      let stateObj = null;
      if (stateRaw) {
        try {
          stateObj = JSON.parse(stateRaw);
          stateObj.patients = currentList;
          stateObj.lastSyncedAt = new Date().toISOString();
          stateObj.stateVersion = Date.now();
          await kv.put('sobber_state', JSON.stringify(stateObj));
        } catch {}
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Batch imported ${payload.length} residents successfully`,
        count: currentList.length,
        addedIds,
        patients: currentList,
        version: stateObj?.stateVersion || Date.now()
      }), {
        status: 200,
        headers: JSON_HEADERS
      });
    }

    // Scenario B: Single resident intake or update
    const patientItem = { ...payload };
    if (!patientItem.id) {
      patientItem.id = 'PAT-' + (100 + currentList.length + 1);
    }
    if (!patientItem.admissionDate) {
      patientItem.admissionDate = new Date().toISOString().split('T')[0];
    }

    const existingIdx = currentList.findIndex(p => p.id === patientItem.id);
    if (existingIdx !== -1) {
      currentList[existingIdx] = { ...currentList[existingIdx], ...patientItem };
    } else {
      currentList.unshift(patientItem);
    }

    await kv.put('sobber_patients', JSON.stringify(currentList));

    // Update in sobber_state
    const stateRaw = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
    let stateObj = null;
    if (stateRaw) {
      try {
        stateObj = JSON.parse(stateRaw);
        stateObj.patients = currentList;
        stateObj.lastSyncedAt = new Date().toISOString();
        stateObj.stateVersion = Date.now();
        await kv.put('sobber_state', JSON.stringify(stateObj));
      } catch {}
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Resident record saved successfully to SOBBER_KV',
      patient: patientItem,
      patients: currentList,
      count: currentList.length,
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
      return new Response(JSON.stringify({ error: 'KV missing' }), { status: 500, headers: JSON_HEADERS });
    }

    const url = new URL(context.request.url);
    let patientId = url.searchParams.get('id');

    if (!patientId) {
      try {
        const body = await context.request.json();
        patientId = body?.id;
      } catch {}
    }

    if (!patientId) {
      return new Response(JSON.stringify({ error: 'Patient ID is required' }), { status: 400, headers: JSON_HEADERS });
    }

    let list = [];
    const raw = await kv.get('sobber_patients', { type: 'text', cacheTtl: 0 });
    if (raw) {
      try { list = JSON.parse(raw); } catch {}
    }
    if (!Array.isArray(list)) list = [];

    const beforeLen = list.length;
    list = list.filter(p => p.id !== patientId);

    await kv.put('sobber_patients', JSON.stringify(list));

    // Update sobber_state
    const stateRaw = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
    if (stateRaw) {
      try {
        const stateObj = JSON.parse(stateRaw);
        stateObj.patients = list;
        if (Array.isArray(stateObj.medicationLogs)) {
          stateObj.medicationLogs = stateObj.medicationLogs.filter(m => m.patientId !== patientId);
          await kv.put('sobber_medications', JSON.stringify(stateObj.medicationLogs));
        }
        stateObj.lastSyncedAt = new Date().toISOString();
        stateObj.stateVersion = Date.now();
        await kv.put('sobber_state', JSON.stringify(stateObj));
      } catch {}
    }

    return new Response(JSON.stringify({
      success: true,
      deletedId: patientId,
      remainingCount: list.length,
      patients: list,
      wasRemoved: beforeLen !== list.length
    }), {
      status: 200,
      headers: JSON_HEADERS
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
  }
}
