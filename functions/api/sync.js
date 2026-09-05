/**
 * Cloudflare Pages Function: /api/sync
 * 
 * Synchronizes global SerenityCare Sober House application state
 * (residents/patients, rooms, beds, addict payment fees & installments,
 * staff/users, medication logs/MAR, inventory, house timetable,
 * reminders, and facility configuration) across all connected browsers
 * via Cloudflare Workers KV and optional D1 SQL Relational Database.
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

const SEED_ROOMS = [
  { id: 'rm_101', roomNumber: 'Room 101', name: 'Cedar Wing 101', floor: '1st Floor', type: 'Double', capacity: 2, status: 'Active', notes: 'Standard double occupancy recovery room' },
  { id: 'rm_102', roomNumber: 'Room 102', name: 'Cedar Wing 102', floor: '1st Floor', type: 'Double', capacity: 2, status: 'Active', notes: 'Standard double occupancy recovery room' },
  { id: 'rm_103', roomNumber: 'Room 103', name: 'Pine Wing 103', floor: '1st Floor', type: 'Single', capacity: 1, status: 'Active', notes: 'Private single transition room' },
  { id: 'rm_201', roomNumber: 'Room 201', name: 'Maple Hall 201', floor: '2nd Floor', type: 'Ward', capacity: 4, status: 'Active', notes: 'Four-bed group recovery unit' },
  { id: 'rm_dx1', roomNumber: 'Detox 01', name: 'Clinical Detox Suite 01', floor: 'Ground Floor', type: 'Detox', capacity: 2, status: 'Active', notes: 'Monitored medical detoxification suite' }
];

const SEED_BEDS = [
  { id: 'bed_101a', roomId: 'rm_101', bedNumber: 'Bed 101-A', type: 'Standard', status: 'Available', patientId: null, notes: '' },
  { id: 'bed_101b', roomId: 'rm_101', bedNumber: 'Bed 101-B', type: 'Standard', status: 'Available', patientId: null, notes: '' },
  { id: 'bed_102a', roomId: 'rm_102', bedNumber: 'Bed 102-A', type: 'Standard', status: 'Available', patientId: null, notes: '' },
  { id: 'bed_102b', roomId: 'rm_102', bedNumber: 'Bed 102-B', type: 'Standard', status: 'Available', patientId: null, notes: '' },
  { id: 'bed_103a', roomId: 'rm_103', bedNumber: 'Bed 103-A', type: 'Standard', status: 'Available', patientId: null, notes: '' },
  { id: 'bed_201a', roomId: 'rm_201', bedNumber: 'Bed 201-A', type: 'Standard', status: 'Available', patientId: null, notes: '' },
  { id: 'bed_201b', roomId: 'rm_201', bedNumber: 'Bed 201-B', type: 'Standard', status: 'Available', patientId: null, notes: '' },
  { id: 'bed_201c', roomId: 'rm_201', bedNumber: 'Bed 201-C', type: 'Standard', status: 'Available', patientId: null, notes: '' },
  { id: 'bed_201d', roomId: 'rm_201', bedNumber: 'Bed 201-D', type: 'Standard', status: 'Available', patientId: null, notes: '' },
  { id: 'bed_dx1a', roomId: 'rm_dx1', bedNumber: 'Bed DX-1', type: 'Medical', status: 'Available', patientId: null, notes: 'Direct vitals telemetry equipped' },
  { id: 'bed_dx1b', roomId: 'rm_dx1', bedNumber: 'Bed DX-2', type: 'Medical', status: 'Available', patientId: null, notes: 'Direct vitals telemetry equipped' }
];

const SEED_SOBBER_STATE = {
  facility: {
    name: 'SerenityCare Sober House & Recovery Center',
    licenseNumber: 'SH-84920-CLINICAL',
    address: '742 Hope Valley Road, Building B, Austin, TX 78701',
    phone: '+1 (800) 555-7623',
    email: 'admissions@serenitycare.org',
    director: 'Dr. Evelyn Vance, MD, FASAM',
    leadCounselor: 'Marcus Sterling, MSW, LCDC',
    totalBeds: 11,
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
        rooms: true,
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
  rooms: SEED_ROOMS,
  beds: SEED_BEDS,
  patients: [],
  residentFees: [],
  installmentPayments: [],
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
  ],
  stateVersion: Date.now()
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
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet(context) {
  try {
    const kv = getKV(context);
    if (!kv) {
      return new Response(JSON.stringify({ 
        online: false,
        isDemoFallback: true,
        message: 'Cloudflare KV binding not detected. Bind SOBBER_KV in Cloudflare Pages Settings -> Functions.',
        ...SEED_SOBBER_STATE
      }), {
        status: 200,
        headers: JSON_HEADERS
      });
    }

    let rawData = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
    if (!rawData) {
      rawData = await kv.get('serenitycare_state', { type: 'text', cacheTtl: 0 });
    }

    if (!rawData) {
      const initialWithTimestamp = {
        ...SEED_SOBBER_STATE,
        lastSyncedAt: new Date().toISOString(),
        stateVersion: Date.now()
      };
      await kv.put('sobber_state', JSON.stringify(initialWithTimestamp));
      await kv.put('sobber_users', JSON.stringify(initialWithTimestamp.users));
      await kv.put('sobber_rooms', JSON.stringify(initialWithTimestamp.rooms));
      await kv.put('sobber_beds', JSON.stringify(initialWithTimestamp.beds));

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

    // Ensure rooms, beds, residentFees, installmentPayments exist
    if (!Array.isArray(parsed.rooms) || parsed.rooms.length === 0) {
      parsed.rooms = SEED_ROOMS;
      parsed.beds = SEED_BEDS;
    }
    if (!Array.isArray(parsed.residentFees)) parsed.residentFees = [];
    if (!Array.isArray(parsed.installmentPayments)) parsed.installmentPayments = [];

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
    stateToSave.stateVersion = Date.now();

    if (!Array.isArray(stateToSave.rooms)) stateToSave.rooms = SEED_ROOMS;
    if (!Array.isArray(stateToSave.beds)) stateToSave.beds = SEED_BEDS;
    if (!Array.isArray(stateToSave.residentFees)) stateToSave.residentFees = [];
    if (!Array.isArray(stateToSave.installmentPayments)) stateToSave.installmentPayments = [];

    // Persist full system snapshot to primary KV storage
    await kv.put('sobber_state', JSON.stringify(stateToSave));

    // Mirror granular collections for dedicated endpoints
    if (Array.isArray(stateToSave.users)) await kv.put('sobber_users', JSON.stringify(stateToSave.users));
    if (Array.isArray(stateToSave.patients)) await kv.put('sobber_patients', JSON.stringify(stateToSave.patients));
    if (Array.isArray(stateToSave.rooms)) await kv.put('sobber_rooms', JSON.stringify(stateToSave.rooms));
    if (Array.isArray(stateToSave.beds)) await kv.put('sobber_beds', JSON.stringify(stateToSave.beds));
    if (Array.isArray(stateToSave.residentFees)) await kv.put('sobber_fees', JSON.stringify(stateToSave.residentFees));
    if (Array.isArray(stateToSave.installmentPayments)) await kv.put('sobber_installments', JSON.stringify(stateToSave.installmentPayments));
    if (Array.isArray(stateToSave.medicationLogs)) await kv.put('sobber_medications', JSON.stringify(stateToSave.medicationLogs));
    if (Array.isArray(stateToSave.inventory)) await kv.put('sobber_inventory', JSON.stringify(stateToSave.inventory));
    if (Array.isArray(stateToSave.timetable)) await kv.put('sobber_timetable', JSON.stringify(stateToSave.timetable));

    // D1 SQL Relational Sync if connected
    if (context.env?.DB) {
      try {
        if (Array.isArray(stateToSave.rooms)) {
          for (const rm of stateToSave.rooms) {
            await context.env.DB.prepare(
              `INSERT INTO rooms (id, room_number, name, floor, type, capacity, status, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
               room_number=excluded.room_number, name=excluded.name, floor=excluded.floor,
               type=excluded.type, capacity=excluded.capacity, status=excluded.status, notes=excluded.notes`
            ).bind(rm.id, rm.roomNumber, rm.name || '', rm.floor || '1st Floor', rm.type || 'Double', rm.capacity || 2, rm.status || 'Active', rm.notes || '').run().catch(() => {});
          }
        }
        if (Array.isArray(stateToSave.beds)) {
          for (const bd of stateToSave.beds) {
            await context.env.DB.prepare(
              `INSERT INTO beds (id, room_id, bed_number, type, status, patient_id, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
               room_id=excluded.room_id, bed_number=excluded.bed_number, type=excluded.type,
               status=excluded.status, patient_id=excluded.patient_id, notes=excluded.notes`
            ).bind(bd.id, bd.roomId, bd.bedNumber, bd.type || 'Standard', bd.status || 'Available', bd.patientId || null, bd.notes || '').run().catch(() => {});
          }
        }
      } catch (e) {
        console.warn('Pages D1 sync error:', e);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'SerenityCare Sober House state successfully written to Cloudflare Workers KV',
      timestamp: stateToSave.lastSyncedAt,
      version: stateToSave.stateVersion,
      usersCount: stateToSave.users?.length || 0,
      patientsCount: stateToSave.patients?.length || 0,
      roomsCount: stateToSave.rooms?.length || 0,
      bedsCount: stateToSave.beds?.length || 0,
      state: stateToSave
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
