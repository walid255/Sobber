/**
 * Cloudflare Pages Function: /api/sync
 * 
 * Synchronizes global SerenityCare Sober House application state
 * (residents/patients, staff/users, medication logs/MAR, inventory,
 * house timetable, reminders, and facility configuration) across all
 * connected browsers via Cloudflare Workers KV.
 * 
 * KV Bindings: SOBBER_KV (primary) or KV (fallback, auto-discovered)
 * Storage Key: "sobber_state"
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

const JSON_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
};

// Initial clean production state seeded automatically if KV namespace is brand new
const SEED_SOBBER_STATE = {
  facility: {
    name: 'SerenityCare Sober House & Recovery Center',
    licenseNumber: 'SH-84920-CLINICAL',
    address: '742 Hope Valley Road, Building B, Austin, TX 78701',
    phone: '+1 (800) 555-7623',
    email: 'admissions@serenitycare.org',
    director: 'Dr. Evelyn Vance, MD, FASAM',
    leadCounselor: 'Marcus Sterling, MSW, LCDC',
    totalBeds: 32,
    currency: 'TZS',
    logoUrl: 'assets/logo.svg',
    faviconUrl: 'assets/favicon.svg'
  },
  currency: 'TZS',
  currentUser: null,
  sessionToken: null,
  users: [
    {
      id: 'usr_admin',
      name: 'System Administrator',
      email: 'admin@serenitycare.org',
      password: 'Admin@Serenity2026!',
      role: 'admin',
      phone: '+1 (800) 555-7623',
      department: 'Clinical Administration',
      status: 'Active',
      lastLogin: null,
      permissions: {
        dashboard: true,
        patients: true,
        medications: true,
        timetable: true,
        inventory: true,
        certificates: true,
        batch_upload: true,
        users: true,
        settings: true
      }
    }
  ],
  patients: [],
  medicationLogs: [],
  inventory: [],
  inventoryTransactions: [],
  timetable: [],
  reminders: [],
  activityLogs: [
    {
      id: 'act_init',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      user: 'System',
      action: 'Production Ready',
      details: 'SerenityCare production environment initialized with zero dummy records'
    }
  ]
};

function getKV(context) {
  if (context.env?.SOBBER_KV) return context.env.SOBBER_KV;
  if (context.env?.KV) return context.env.KV;
  if (context.env?.SOBER_KV) return context.env.SOBER_KV;
  if (context.env?.SERENITYCARE_KV) return context.env.SERENITYCARE_KV;
  
  // Auto-discover any bound KV namespace in context.env
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
      return new Response(JSON.stringify({ 
        online: false,
        isDemoFallback: true,
        message: 'Cloudflare KV binding not detected. In Cloudflare Pages, go to Settings -> Functions -> KV namespace bindings and bind SOBBER_KV.',
        ...SEED_SOBBER_STATE
      }), {
        status: 200,
        headers: JSON_HEADERS
      });
    }

    let rawData = await kv.get('sobber_state');
    if (!rawData) {
      // Check legacy key fallback
      rawData = await kv.get('serenitycare_state');
    }

    if (!rawData) {
      // Key does not exist yet: initialize with seed production state
      const initialWithTimestamp = {
        ...SEED_SOBBER_STATE,
        lastSyncedAt: new Date().toISOString()
      };
      await kv.put('sobber_state', JSON.stringify(initialWithTimestamp));
      await kv.put('sobber_users', JSON.stringify(initialWithTimestamp.users));

      return new Response(JSON.stringify(initialWithTimestamp), {
        status: 200,
        headers: JSON_HEADERS
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(rawData);
    } catch {
      parsed = SEED_SOBBER_STATE;
    }

    return new Response(JSON.stringify(parsed || {}), {
      status: 200,
      headers: JSON_HEADERS
    });
  } catch (err) {
    return new Response(JSON.stringify({ 
      error: 'Failed to retrieve state from Cloudflare KV', 
      message: err.message 
    }), {
      status: 500,
      headers: JSON_HEADERS
    });
  }
}

export async function onRequestPost(context) {
  try {
    const kv = getKV(context);
    if (!kv) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Cloudflare KV namespace binding missing. Please bind SOBBER_KV in Cloudflare Pages Settings -> Functions.' 
      }), {
        status: 500,
        headers: JSON_HEADERS
      });
    }

    let payload;
    try {
      payload = await context.request.json();
    } catch {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid JSON state payload' 
      }), {
        status: 400,
        headers: JSON_HEADERS
      });
    }

    if (!payload || typeof payload !== 'object') {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Payload must be a valid Sober House state object' 
      }), {
        status: 400,
        headers: JSON_HEADERS
      });
    }

    const stateToSave = { ...payload };
    stateToSave.lastSyncedAt = new Date().toISOString();

    // Persist full system snapshot to sobber_state
    await kv.put('sobber_state', JSON.stringify(stateToSave));

    // Mirror granular collections for dedicated endpoints
    if (Array.isArray(stateToSave.users)) {
      await kv.put('sobber_users', JSON.stringify(stateToSave.users));
    }
    if (Array.isArray(stateToSave.patients)) {
      await kv.put('sobber_patients', JSON.stringify(stateToSave.patients));
    }
    if (Array.isArray(stateToSave.medicationLogs)) {
      await kv.put('sobber_medications', JSON.stringify(stateToSave.medicationLogs));
    }
    if (Array.isArray(stateToSave.inventory)) {
      await kv.put('sobber_inventory', JSON.stringify(stateToSave.inventory));
    }
    if (Array.isArray(stateToSave.timetable)) {
      await kv.put('sobber_timetable', JSON.stringify(stateToSave.timetable));
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'SerenityCare Sober House state successfully written to Cloudflare Workers KV',
      timestamp: stateToSave.lastSyncedAt,
      usersCount: stateToSave.users?.length || 0,
      patientsCount: stateToSave.patients?.length || 0
    }), {
      status: 200,
      headers: JSON_HEADERS
    });
  } catch (err) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to write state to Cloudflare KV', 
      message: err.message 
    }), {
      status: 500,
      headers: JSON_HEADERS
    });
  }
}
