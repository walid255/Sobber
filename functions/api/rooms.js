/**
 * Cloudflare Pages Function: /api/rooms
 * 
 * Provides Room and Bed management CRUD with Cloudflare Workers KV and D1 SQL relational synchronization.
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
    let rooms = SEED_ROOMS;
    let beds = SEED_BEDS;

    if (kv) {
      const rRaw = await kv.get('sobber_rooms', { type: 'text', cacheTtl: 0 });
      if (rRaw) {
        try { rooms = JSON.parse(rRaw); } catch {}
      }
      const bRaw = await kv.get('sobber_beds', { type: 'text', cacheTtl: 0 });
      if (bRaw) {
        try { beds = JSON.parse(bRaw); } catch {}
      }
    }

    return new Response(JSON.stringify({ success: true, rooms, beds }), { status: 200, headers: JSON_HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
  }
}

export async function onRequestPost(context) {
  try {
    const kv = getKV(context);
    if (!kv) {
      return new Response(JSON.stringify({ success: false, error: 'Cloudflare KV not bound' }), { status: 500, headers: JSON_HEADERS });
    }

    const payload = await context.request.json();
    let rooms = SEED_ROOMS;
    let beds = SEED_BEDS;

    const rRaw = await kv.get('sobber_rooms', { type: 'text', cacheTtl: 0 });
    if (rRaw) try { rooms = JSON.parse(rRaw); } catch {}
    const bRaw = await kv.get('sobber_beds', { type: 'text', cacheTtl: 0 });
    if (bRaw) try { beds = JSON.parse(bRaw); } catch {}

    if (payload.room) {
      const rm = payload.room;
      if (!rm.id) rm.id = 'rm_' + Date.now();
      const idx = rooms.findIndex(r => r.id === rm.id);
      if (idx >= 0) rooms[idx] = { ...rooms[idx], ...rm };
      else rooms.push(rm);

      if (payload.initialBedsCount && payload.initialBedsCount > 0) {
        const count = parseInt(payload.initialBedsCount);
        const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        for (let i = 0; i < count; i++) {
          const label = `${rm.roomNumber}-${letters[i] || (i + 1)}`;
          beds.push({
            id: `bed_${rm.id}_${i + 1}`,
            roomId: rm.id,
            bedNumber: label,
            type: rm.type === 'Detox' ? 'Medical' : 'Standard',
            status: 'Available',
            patientId: null,
            notes: ''
          });
        }
      }
    }

    if (payload.bed) {
      const bd = payload.bed;
      if (!bd.id) bd.id = 'bed_' + Date.now();
      const idx = beds.findIndex(b => b.id === bd.id);
      if (idx >= 0) beds[idx] = { ...beds[idx], ...bd };
      else beds.push(bd);
    }

    if (Array.isArray(payload.rooms)) rooms = payload.rooms;
    if (Array.isArray(payload.beds)) beds = payload.beds;

    await kv.put('sobber_rooms', JSON.stringify(rooms));
    await kv.put('sobber_beds', JSON.stringify(beds));

    // Also update sobber_state
    const stateRaw = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
    let stateVersion = Date.now();
    if (stateRaw) {
      try {
        const s = JSON.parse(stateRaw);
        s.rooms = rooms;
        s.beds = beds;
        s.lastSyncedAt = new Date().toISOString();
        s.stateVersion = stateVersion;
        await kv.put('sobber_state', JSON.stringify(s));
      } catch {}
    }

    // If D1 is available, sync to relational tables
    if (context.env?.DB) {
      try {
        for (const rm of rooms) {
          await context.env.DB.prepare(
            `INSERT INTO rooms (id, room_number, name, floor, type, capacity, status, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
             room_number=excluded.room_number, name=excluded.name, floor=excluded.floor,
             type=excluded.type, capacity=excluded.capacity, status=excluded.status, notes=excluded.notes`
          ).bind(rm.id, rm.roomNumber, rm.name || '', rm.floor || '1st Floor', rm.type || 'Double', rm.capacity || 2, rm.status || 'Active', rm.notes || '').run().catch(() => {});
        }
        for (const bd of beds) {
          await context.env.DB.prepare(
            `INSERT INTO beds (id, room_id, bed_number, type, status, patient_id, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
             room_id=excluded.room_id, bed_number=excluded.bed_number, type=excluded.type,
             status=excluded.status, patient_id=excluded.patient_id, notes=excluded.notes`
          ).bind(bd.id, bd.roomId, bd.bedNumber, bd.type || 'Standard', bd.status || 'Available', bd.patientId || null, bd.notes || '').run().catch(() => {});
        }
      } catch (e) {
        console.warn('Pages function D1 rooms sync error:', e);
      }
    }

    return new Response(JSON.stringify({ success: true, rooms, beds, version: stateVersion }), { status: 200, headers: JSON_HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: JSON_HEADERS });
  }
}

export async function onRequestDelete(context) {
  try {
    const kv = getKV(context);
    if (!kv) return new Response(JSON.stringify({ error: 'KV missing' }), { status: 500, headers: JSON_HEADERS });

    const url = new URL(context.request.url);
    const roomId = url.searchParams.get('roomId');
    const bedId = url.searchParams.get('bedId');

    let rooms = [];
    let beds = [];
    const rRaw = await kv.get('sobber_rooms', { type: 'text', cacheTtl: 0 });
    if (rRaw) try { rooms = JSON.parse(rRaw); } catch {}
    const bRaw = await kv.get('sobber_beds', { type: 'text', cacheTtl: 0 });
    if (bRaw) try { beds = JSON.parse(bRaw); } catch {}

    if (roomId) {
      const occupied = beds.some(b => b.roomId === roomId && b.status === 'Occupied');
      if (occupied) {
        return new Response(JSON.stringify({ success: false, error: 'Cannot delete room: one or more beds are currently occupied by active residents.' }), { status: 400, headers: JSON_HEADERS });
      }
      rooms = rooms.filter(r => r.id !== roomId);
      beds = beds.filter(b => b.roomId !== roomId);

      if (context.env?.DB) {
        await context.env.DB.prepare('DELETE FROM rooms WHERE id = ?').bind(roomId).run().catch(() => {});
      }
    } else if (bedId) {
      const targetBed = beds.find(b => b.id === bedId);
      if (targetBed && targetBed.status === 'Occupied') {
        return new Response(JSON.stringify({ success: false, error: 'Cannot delete bed: bed is currently occupied by a resident.' }), { status: 400, headers: JSON_HEADERS });
      }
      beds = beds.filter(b => b.id !== bedId);

      if (context.env?.DB) {
        await context.env.DB.prepare('DELETE FROM beds WHERE id = ?').bind(bedId).run().catch(() => {});
      }
    }

    await kv.put('sobber_rooms', JSON.stringify(rooms));
    await kv.put('sobber_beds', JSON.stringify(beds));

    const stateRaw = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
    if (stateRaw) {
      try {
        const s = JSON.parse(stateRaw);
        s.rooms = rooms;
        s.beds = beds;
        s.lastSyncedAt = new Date().toISOString();
        s.stateVersion = Date.now();
        await kv.put('sobber_state', JSON.stringify(s));
      } catch {}
    }

    return new Response(JSON.stringify({ success: true, rooms, beds }), { status: 200, headers: JSON_HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
  }
}
