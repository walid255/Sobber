/**
 * SerenityCare Cloudflare Worker / Pages API Router
 * 
 * Provides serverless edge execution with:
 * - Cloudflare Workers KV (`env.SOBBER_KV` or `env.KV`) - Global ultra-fast state synchronization
 * - Cloudflare D1 SQL Relational Database (`env.DB`) - Relational persistence
 * - Cloudflare R2 Object Storage (`env.BUCKET`) - Resident photos, dossier PDFs & receipts
 */

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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Edge Cache Bypassing & CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Cache-Control, Pragma',
      'Access-Control-Max-Age': '0',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store',
      'CDN-Cache-Control': 'no-store',
      'Cloudflare-CDN-Cache-Control': 'no-store'
    };

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const kv = env.SOBBER_KV || env.KV;
    const db = env.DB;
    const bucket = env.BUCKET;

    // Helper: Safely run D1 queries if DB binding exists
    async function runD1Sync(stateObj) {
      if (!db) return;
      try {
        // Sync rooms to D1
        if (Array.isArray(stateObj.rooms)) {
          for (const rm of stateObj.rooms) {
            await db.prepare(
              `INSERT INTO rooms (id, room_number, name, floor, type, capacity, status, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
               room_number=excluded.room_number, name=excluded.name, floor=excluded.floor,
               type=excluded.type, capacity=excluded.capacity, status=excluded.status, notes=excluded.notes`
            ).bind(rm.id, rm.roomNumber, rm.name || '', rm.floor || '1st Floor', rm.type || 'Double', rm.capacity || 2, rm.status || 'Active', rm.notes || '').run().catch(() => {});
          }
        }
        // Sync beds to D1
        if (Array.isArray(stateObj.beds)) {
          for (const bd of stateObj.beds) {
            await db.prepare(
              `INSERT INTO beds (id, room_id, bed_number, type, status, patient_id, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
               room_id=excluded.room_id, bed_number=excluded.bed_number, type=excluded.type,
               status=excluded.status, patient_id=excluded.patient_id, notes=excluded.notes`
            ).bind(bd.id, bd.roomId, bd.bedNumber, bd.type || 'Standard', bd.status || 'Available', bd.patientId || null, bd.notes || '').run().catch(() => {});
          }
        }
        // Sync resident fees to D1
        if (Array.isArray(stateObj.residentFees)) {
          for (const f of stateObj.residentFees) {
            await db.prepare(
              `INSERT INTO resident_fees (id, patient_id, total_fee, currency, payment_plan, total_installments, frequency, initial_deposit, amount_paid, remaining_balance, payment_method, reference_no, status, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
               total_fee=excluded.total_fee, currency=excluded.currency, payment_plan=excluded.payment_plan,
               total_installments=excluded.total_installments, frequency=excluded.frequency, initial_deposit=excluded.initial_deposit,
               amount_paid=excluded.amount_paid, remaining_balance=excluded.remaining_balance, payment_method=excluded.payment_method,
               reference_no=excluded.reference_no, status=excluded.status, notes=excluded.notes, updated_at=CURRENT_TIMESTAMP`
            ).bind(
              f.id, f.patientId, f.totalFee || 0, f.currency || 'TZS', f.paymentPlan || 'Installments',
              f.totalInstallments || 1, f.frequency || 'Monthly', f.initialDeposit || 0, f.amountPaid || 0,
              f.remainingBalance || 0, f.paymentMethod || '', f.referenceNo || '', f.status || 'Pending', f.notes || ''
            ).run().catch(() => {});
          }
        }
        // Sync installment payments to D1
        if (Array.isArray(stateObj.installmentPayments)) {
          for (const ip of stateObj.installmentPayments) {
            await db.prepare(
              `INSERT INTO installment_payments (id, resident_fee_id, patient_id, installment_number, amount, due_date, paid_date, payment_method, reference_no, status, recorded_by, receipt_url, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
               amount=excluded.amount, due_date=excluded.due_date, paid_date=excluded.paid_date,
               payment_method=excluded.payment_method, reference_no=excluded.reference_no,
               status=excluded.status, recorded_by=excluded.recorded_by, notes=excluded.notes`
            ).bind(
              ip.id, ip.residentFeeId, ip.patientId, ip.installmentNumber || 1, ip.amount || 0,
              ip.dueDate || '', ip.paidDate || null, ip.paymentMethod || '', ip.referenceNo || '',
              ip.status || 'Pending', ip.recordedBy || '', ip.receiptUrl || '', ip.notes || ''
            ).run().catch(() => {});
          }
        }
      } catch (e) {
        console.warn('D1 sync partial error:', e);
      }
    }

    try {
      // 1. Health Ping
      if (path === '/api/health') {
        let d1Ok = false;
        let d1Details = null;
        if (db) {
          try {
            const row = await db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'").first();
            d1Ok = true;
            d1Details = { tableCount: row?.count || 0 };
          } catch (e) {
            d1Details = { error: e.message };
          }
        }

        return new Response(JSON.stringify({
          status: 'online',
          system: 'SerenityCare Recovery Management System',
          edgeLocation: request.cf?.colo || 'LocalEdge',
          kvConnected: Boolean(kv),
          d1Connected: Boolean(db),
          d1Operational: d1Ok,
          d1Details,
          r2Connected: Boolean(bucket),
          timestamp: new Date().toISOString(),
          endpoints: [
            '/api/sync',
            '/api/users',
            '/api/patients',
            '/api/rooms',
            '/api/payments',
            '/api/medications',
            '/api/inventory',
            '/api/timetable',
            '/api/upload',
            '/api/health'
          ]
        }), { headers: corsHeaders });
      }

      // 2. /api/sync (Global Sober House State Replication)
      if (path === '/api/sync') {
        if (method === 'GET') {
          if (!kv) {
            return new Response(JSON.stringify({ 
              online: false, 
              message: 'KV namespace not bound. Please bind SOBBER_KV or KV.',
              rooms: SEED_ROOMS,
              beds: SEED_BEDS,
              residentFees: [],
              installmentPayments: []
            }), { headers: corsHeaders });
          }
          let stateData = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
          if (!stateData) {
            stateData = await kv.get('serenitycare_state', { type: 'text', cacheTtl: 0 });
          }

          if (stateData) {
            let parsed = {};
            try { parsed = JSON.parse(stateData); } catch {}
            // Ensure rooms and beds exist in state
            if (!Array.isArray(parsed.rooms) || parsed.rooms.length === 0) {
              parsed.rooms = SEED_ROOMS;
              parsed.beds = SEED_BEDS;
            }
            if (!Array.isArray(parsed.residentFees)) parsed.residentFees = [];
            if (!Array.isArray(parsed.installmentPayments)) parsed.installmentPayments = [];
            return new Response(JSON.stringify(parsed), { headers: corsHeaders });
          }

          // Fresh bootstrap
          const fresh = {
            rooms: SEED_ROOMS,
            beds: SEED_BEDS,
            residentFees: [],
            installmentPayments: [],
            lastSyncedAt: new Date().toISOString(),
            stateVersion: Date.now()
          };
          return new Response(JSON.stringify(fresh), { headers: corsHeaders });
        }

        if (method === 'POST') {
          if (!kv) {
            return new Response(JSON.stringify({ success: false, error: 'KV binding missing (bind SOBBER_KV or KV)' }), { status: 500, headers: corsHeaders });
          }
          const stateObj = await request.json();
          stateObj.lastSyncedAt = new Date().toISOString();
          stateObj.stateVersion = Date.now();

          // Ensure rooms and beds arrays are preserved
          if (!Array.isArray(stateObj.rooms)) stateObj.rooms = SEED_ROOMS;
          if (!Array.isArray(stateObj.beds)) stateObj.beds = SEED_BEDS;
          if (!Array.isArray(stateObj.residentFees)) stateObj.residentFees = [];
          if (!Array.isArray(stateObj.installmentPayments)) stateObj.installmentPayments = [];

          // Persist full state to KV
          await kv.put('sobber_state', JSON.stringify(stateObj));

          // Mirror collections for dedicated edge queries
          if (Array.isArray(stateObj.users)) await kv.put('sobber_users', JSON.stringify(stateObj.users));
          if (Array.isArray(stateObj.patients)) await kv.put('sobber_patients', JSON.stringify(stateObj.patients));
          if (Array.isArray(stateObj.rooms)) await kv.put('sobber_rooms', JSON.stringify(stateObj.rooms));
          if (Array.isArray(stateObj.beds)) await kv.put('sobber_beds', JSON.stringify(stateObj.beds));
          if (Array.isArray(stateObj.residentFees)) await kv.put('sobber_fees', JSON.stringify(stateObj.residentFees));
          if (Array.isArray(stateObj.installmentPayments)) await kv.put('sobber_installments', JSON.stringify(stateObj.installmentPayments));
          if (Array.isArray(stateObj.medicationLogs)) await kv.put('sobber_medications', JSON.stringify(stateObj.medicationLogs));
          if (Array.isArray(stateObj.inventory)) await kv.put('sobber_inventory', JSON.stringify(stateObj.inventory));
          if (Array.isArray(stateObj.timetable)) await kv.put('sobber_timetable', JSON.stringify(stateObj.timetable));

          // Sync to D1 SQL Relational Database if connected
          if (ctx && typeof ctx.waitUntil === 'function') {
            ctx.waitUntil(runD1Sync(stateObj));
          } else {
            runD1Sync(stateObj);
          }

          return new Response(JSON.stringify({ 
            success: true, 
            timestamp: stateObj.lastSyncedAt,
            version: stateObj.stateVersion,
            state: stateObj
          }), { headers: corsHeaders });
        }
      }

      // 3. /api/rooms (Room and Bed Management)
      if (path === '/api/rooms') {
        if (method === 'GET') {
          let rooms = SEED_ROOMS;
          let beds = SEED_BEDS;
          if (kv) {
            const rRaw = await kv.get('sobber_rooms', { type: 'text', cacheTtl: 0 });
            if (rRaw) try { rooms = JSON.parse(rRaw); } catch {}
            const bRaw = await kv.get('sobber_beds', { type: 'text', cacheTtl: 0 });
            if (bRaw) try { beds = JSON.parse(bRaw); } catch {}
          }
          return new Response(JSON.stringify({ success: true, rooms, beds }), { headers: corsHeaders });
        }

        if (method === 'POST') {
          if (!kv) return new Response(JSON.stringify({ error: 'KV missing' }), { status: 500, headers: corsHeaders });
          const payload = await request.json();

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

            // Auto-generate initial beds if specified
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

          // Update in sobber_state
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

          if (ctx && typeof ctx.waitUntil === 'function') {
            ctx.waitUntil(runD1Sync({ rooms, beds }));
          } else {
            runD1Sync({ rooms, beds });
          }

          return new Response(JSON.stringify({ success: true, rooms, beds, version: stateVersion }), { headers: corsHeaders });
        }

        if (method === 'DELETE') {
          if (!kv) return new Response(JSON.stringify({ error: 'KV missing' }), { status: 500, headers: corsHeaders });
          const roomId = url.searchParams.get('roomId');
          const bedId = url.searchParams.get('bedId');

          let rooms = [];
          let beds = [];
          const rRaw = await kv.get('sobber_rooms', { type: 'text', cacheTtl: 0 });
          if (rRaw) try { rooms = JSON.parse(rRaw); } catch {}
          const bRaw = await kv.get('sobber_beds', { type: 'text', cacheTtl: 0 });
          if (bRaw) try { beds = JSON.parse(bRaw); } catch {}

          if (roomId) {
            // Safety check: ensure no active occupied bed
            const occupied = beds.some(b => b.roomId === roomId && b.status === 'Occupied');
            if (occupied) {
              return new Response(JSON.stringify({ success: false, error: 'Cannot delete room: one or more beds are currently occupied by active residents.' }), { status: 400, headers: corsHeaders });
            }
            rooms = rooms.filter(r => r.id !== roomId);
            beds = beds.filter(b => b.roomId !== roomId);
          } else if (bedId) {
            const targetBed = beds.find(b => b.id === bedId);
            if (targetBed && targetBed.status === 'Occupied') {
              return new Response(JSON.stringify({ success: false, error: 'Cannot delete bed: bed is currently occupied by a resident.' }), { status: 400, headers: corsHeaders });
            }
            beds = beds.filter(b => b.id !== bedId);
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

          return new Response(JSON.stringify({ success: true, rooms, beds }), { headers: corsHeaders });
        }
      }

      // 4. /api/payments (Resident Addict Fees & Installments)
      if (path === '/api/payments') {
        if (method === 'GET') {
          let fees = [];
          let installments = [];
          if (kv) {
            const fRaw = await kv.get('sobber_fees', { type: 'text', cacheTtl: 0 });
            if (fRaw) try { fees = JSON.parse(fRaw); } catch {}
            const iRaw = await kv.get('sobber_installments', { type: 'text', cacheTtl: 0 });
            if (iRaw) try { installments = JSON.parse(iRaw); } catch {}
          }
          const patientId = url.searchParams.get('patientId');
          if (patientId) {
            fees = fees.filter(f => f.patientId === patientId);
            installments = installments.filter(i => i.patientId === patientId);
          }
          return new Response(JSON.stringify({ success: true, residentFees: fees, installmentPayments: installments }), { headers: corsHeaders });
        }

        if (method === 'POST') {
          if (!kv) return new Response(JSON.stringify({ error: 'KV missing' }), { status: 500, headers: corsHeaders });
          const payload = await request.json();

          let fees = [];
          let installments = [];
          const fRaw = await kv.get('sobber_fees', { type: 'text', cacheTtl: 0 });
          if (fRaw) try { fees = JSON.parse(fRaw); } catch {}
          const iRaw = await kv.get('sobber_installments', { type: 'text', cacheTtl: 0 });
          if (iRaw) try { installments = JSON.parse(iRaw); } catch {}

          // Scenario A: Recording an installment payment
          if (payload.installmentPayment) {
            const pmt = payload.installmentPayment;
            const idx = installments.findIndex(i => i.id === pmt.installmentId || i.id === pmt.id);
            if (idx >= 0) {
              installments[idx] = {
                ...installments[idx],
                amount: pmt.amount || installments[idx].amount,
                paidDate: pmt.paidDate || new Date().toISOString().split('T')[0],
                paymentMethod: pmt.paymentMethod || 'Cash',
                referenceNo: pmt.referenceNo || `REC-${Date.now().toString().slice(-6)}`,
                status: 'Paid',
                recordedBy: pmt.recordedBy || 'Staff',
                notes: pmt.notes || ''
              };

              // Recalculate fee ledger
              const feeIdx = fees.findIndex(f => f.id === installments[idx].residentFeeId);
              if (feeIdx >= 0) {
                const related = installments.filter(i => i.residentFeeId === fees[feeIdx].id);
                const totalPaid = related.filter(i => i.status === 'Paid').reduce((sum, i) => sum + Number(i.amount), 0);
                fees[feeIdx].amountPaid = totalPaid;
                fees[feeIdx].remainingBalance = Math.max(0, fees[feeIdx].totalFee - totalPaid);
                fees[feeIdx].status = fees[feeIdx].remainingBalance <= 0 ? 'Fully Paid' : 'Partially Paid';
                fees[feeIdx].updatedAt = new Date().toISOString();
              }
            }
          }

          // Scenario B: Creating/Updating resident fee structure
          if (payload.residentFee) {
            const fee = payload.residentFee;
            if (!fee.id) fee.id = 'fee_' + Date.now();
            const idx = fees.findIndex(f => f.id === fee.id || f.patientId === fee.patientId);
            if (idx >= 0) fees[idx] = { ...fees[idx], ...fee };
            else fees.unshift(fee);

            // Add any newly scheduled installments
            if (Array.isArray(payload.schedule)) {
              installments = installments.filter(i => i.residentFeeId !== fee.id);
              installments.push(...payload.schedule);
            }
          }

          if (Array.isArray(payload.residentFees)) fees = payload.residentFees;
          if (Array.isArray(payload.installmentPayments)) installments = payload.installmentPayments;

          await kv.put('sobber_fees', JSON.stringify(fees));
          await kv.put('sobber_installments', JSON.stringify(installments));

          // Sync with sobber_state
          const stateRaw = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
          let stateVersion = Date.now();
          if (stateRaw) {
            try {
              const s = JSON.parse(stateRaw);
              s.residentFees = fees;
              s.installmentPayments = installments;
              s.lastSyncedAt = new Date().toISOString();
              s.stateVersion = stateVersion;
              await kv.put('sobber_state', JSON.stringify(s));
            } catch {}
          }

          if (ctx && typeof ctx.waitUntil === 'function') {
            ctx.waitUntil(runD1Sync({ residentFees: fees, installmentPayments: installments }));
          } else {
            runD1Sync({ residentFees: fees, installmentPayments: installments });
          }

          return new Response(JSON.stringify({ success: true, residentFees: fees, installmentPayments: installments, version: stateVersion }), { headers: corsHeaders });
        }
      }

      // 5. /api/users (Staff & RBAC global sync)
      if (path === '/api/users') {
        if (method === 'GET') {
          if (!kv) return new Response(JSON.stringify([]), { headers: corsHeaders });
          let usersData = await kv.get('sobber_users', { type: 'text', cacheTtl: 0 });
          if (!usersData) usersData = await kv.get('serenitycare_users', { type: 'text', cacheTtl: 0 });
          return new Response(usersData || '[]', { headers: corsHeaders });
        }
        if (method === 'POST') {
          if (!kv) return new Response(JSON.stringify({ error: 'KV missing' }), { status: 500, headers: corsHeaders });
          const userPayload = await request.json();
          let currentUsers = [];
          const existing = await kv.get('sobber_users', { type: 'text', cacheTtl: 0 });
          if (existing) {
            try { currentUsers = JSON.parse(existing); } catch {}
          }
          if (Array.isArray(userPayload)) {
            currentUsers = userPayload;
          } else {
            const idx = currentUsers.findIndex(u => u.id === userPayload.id || u.email === userPayload.email);
            if (idx >= 0) currentUsers[idx] = { ...currentUsers[idx], ...userPayload };
            else currentUsers.push(userPayload);
          }
          await kv.put('sobber_users', JSON.stringify(currentUsers));

          const rawState = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
          let version = Date.now();
          if (rawState) {
            try {
              const stateObj = JSON.parse(rawState);
              stateObj.users = currentUsers;
              stateObj.lastSyncedAt = new Date().toISOString();
              stateObj.stateVersion = version;
              await kv.put('sobber_state', JSON.stringify(stateObj));
            } catch {}
          }

          return new Response(JSON.stringify({ success: true, count: currentUsers.length, users: currentUsers, version }), { headers: corsHeaders });
        }
        if (method === 'DELETE') {
          if (!kv) return new Response(JSON.stringify({ error: 'KV missing' }), { status: 500, headers: corsHeaders });
          const id = url.searchParams.get('id');
          if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: corsHeaders });
          let currentUsers = [];
          const existing = await kv.get('sobber_users', { type: 'text', cacheTtl: 0 });
          if (existing) {
            try { currentUsers = JSON.parse(existing); } catch {}
          }
          currentUsers = currentUsers.filter(u => u.id !== id);
          await kv.put('sobber_users', JSON.stringify(currentUsers));

          const rawState = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
          let version = Date.now();
          if (rawState) {
            try {
              const stateObj = JSON.parse(rawState);
              stateObj.users = currentUsers;
              stateObj.lastSyncedAt = new Date().toISOString();
              stateObj.stateVersion = version;
              await kv.put('sobber_state', JSON.stringify(stateObj));
            } catch {}
          }

          return new Response(JSON.stringify({ success: true, deletedId: id, version }), { headers: corsHeaders });
        }
      }

      // 6. /api/patients (Resident Registry)
      if (path === '/api/patients') {
        if (method === 'GET') {
          if (!kv) return new Response(JSON.stringify([]), { headers: corsHeaders });
          const data = await kv.get('sobber_patients', { type: 'text', cacheTtl: 0 });
          return new Response(data || '[]', { headers: corsHeaders });
        }
        if (method === 'POST') {
          if (!kv) return new Response(JSON.stringify({ error: 'KV missing' }), { status: 500, headers: corsHeaders });
          const payload = await request.json();
          let patients = [];
          const existing = await kv.get('sobber_patients', { type: 'text', cacheTtl: 0 });
          if (existing) {
            try { patients = JSON.parse(existing); } catch {}
          }
          if (Array.isArray(payload)) {
            patients = payload;
          } else {
            const idx = patients.findIndex(p => p.id === payload.id);
            if (idx >= 0) patients[idx] = { ...patients[idx], ...payload };
            else patients.unshift(payload);
          }
          await kv.put('sobber_patients', JSON.stringify(patients));

          const rawState = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
          let version = Date.now();
          if (rawState) {
            try {
              const stateObj = JSON.parse(rawState);
              stateObj.patients = patients;
              stateObj.lastSyncedAt = new Date().toISOString();
              stateObj.stateVersion = version;
              await kv.put('sobber_state', JSON.stringify(stateObj));
            } catch {}
          }

          return new Response(JSON.stringify({ success: true, count: patients.length, patients, version }), { headers: corsHeaders });
        }
        if (method === 'DELETE') {
          if (!kv) return new Response(JSON.stringify({ error: 'KV missing' }), { status: 500, headers: corsHeaders });
          const id = url.searchParams.get('id');
          if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: corsHeaders });
          let list = [];
          const existing = await kv.get('sobber_patients', { type: 'text', cacheTtl: 0 });
          if (existing) {
            try { list = JSON.parse(existing); } catch {}
          }
          list = list.filter(p => p.id !== id);
          await kv.put('sobber_patients', JSON.stringify(list));

          // Also release any bed occupied by this patient
          let beds = [];
          const bRaw = await kv.get('sobber_beds', { type: 'text', cacheTtl: 0 });
          if (bRaw) {
            try {
              beds = JSON.parse(bRaw);
              let bedChanged = false;
              beds.forEach(b => {
                if (b.patientId === id) {
                  b.status = 'Available';
                  b.patientId = null;
                  bedChanged = true;
                }
              });
              if (bedChanged) {
                await kv.put('sobber_beds', JSON.stringify(beds));
              }
            } catch {}
          }

          const rawState = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
          let version = Date.now();
          if (rawState) {
            try {
              const stateObj = JSON.parse(rawState);
              stateObj.patients = list;
              if (beds.length > 0) stateObj.beds = beds;
              stateObj.lastSyncedAt = new Date().toISOString();
              stateObj.stateVersion = version;
              await kv.put('sobber_state', JSON.stringify(stateObj));
            } catch {}
          }

          return new Response(JSON.stringify({ success: true, deletedId: id, version }), { headers: corsHeaders });
        }
      }

      // 7. /api/medications (MAR logs)
      if (path === '/api/medications') {
        if (method === 'GET') {
          if (!kv) return new Response(JSON.stringify([]), { headers: corsHeaders });
          const data = await kv.get('sobber_medications', { type: 'text', cacheTtl: 0 });
          return new Response(data || '[]', { headers: corsHeaders });
        }
        if (method === 'POST') {
          if (!kv) return new Response(JSON.stringify({ error: 'KV missing' }), { status: 500, headers: corsHeaders });
          const payload = await request.json();
          let logs = [];
          const existing = await kv.get('sobber_medications', { type: 'text', cacheTtl: 0 });
          if (existing) {
            try { logs = JSON.parse(existing); } catch {}
          }
          if (Array.isArray(payload)) {
            logs = payload;
          } else {
            const idx = logs.findIndex(l => l.id === payload.id);
            if (idx >= 0) logs[idx] = { ...logs[idx], ...payload };
            else logs.unshift(payload);
          }
          await kv.put('sobber_medications', JSON.stringify(logs));

          const rawState = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
          let version = Date.now();
          if (rawState) {
            try {
              const stateObj = JSON.parse(rawState);
              stateObj.medicationLogs = logs;
              stateObj.lastSyncedAt = new Date().toISOString();
              stateObj.stateVersion = version;
              await kv.put('sobber_state', JSON.stringify(stateObj));
            } catch {}
          }

          return new Response(JSON.stringify({ success: true, count: logs.length, data: logs, version }), { headers: corsHeaders });
        }
      }

      // 8. /api/inventory
      if (path === '/api/inventory') {
        if (method === 'GET') {
          if (!kv) return new Response(JSON.stringify([]), { headers: corsHeaders });
          const data = await kv.get('sobber_inventory', { type: 'text', cacheTtl: 0 });
          return new Response(data || '[]', { headers: corsHeaders });
        }
        if (method === 'POST') {
          if (!kv) return new Response(JSON.stringify({ error: 'KV missing' }), { status: 500, headers: corsHeaders });
          const payload = await request.json();
          let items = [];
          const existing = await kv.get('sobber_inventory', { type: 'text', cacheTtl: 0 });
          if (existing) {
            try { items = JSON.parse(existing); } catch {}
          }
          if (Array.isArray(payload)) {
            items = payload;
          } else {
            const idx = items.findIndex(i => i.id === payload.id);
            if (idx >= 0) items[idx] = { ...items[idx], ...payload };
            else items.unshift(payload);
          }
          await kv.put('sobber_inventory', JSON.stringify(items));

          const rawState = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
          let version = Date.now();
          if (rawState) {
            try {
              const stateObj = JSON.parse(rawState);
              stateObj.inventory = items;
              stateObj.lastSyncedAt = new Date().toISOString();
              stateObj.stateVersion = version;
              await kv.put('sobber_state', JSON.stringify(stateObj));
            } catch {}
          }

          return new Response(JSON.stringify({ success: true, count: items.length, data: items, version }), { headers: corsHeaders });
        }
      }

      // 9. /api/timetable
      if (path === '/api/timetable') {
        if (method === 'GET') {
          if (!kv) return new Response(JSON.stringify([]), { headers: corsHeaders });
          const data = await kv.get('sobber_timetable', { type: 'text', cacheTtl: 0 });
          return new Response(data || '[]', { headers: corsHeaders });
        }
        if (method === 'POST') {
          if (!kv) return new Response(JSON.stringify({ error: 'KV missing' }), { status: 500, headers: corsHeaders });
          const payload = await request.json();
          await kv.put('sobber_timetable', JSON.stringify(payload));

          const rawState = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
          let version = Date.now();
          if (rawState) {
            try {
              const stateObj = JSON.parse(rawState);
              stateObj.timetable = Array.isArray(payload) ? payload : [];
              stateObj.lastSyncedAt = new Date().toISOString();
              stateObj.stateVersion = version;
              await kv.put('sobber_state', JSON.stringify(stateObj));
            } catch {}
          }

          return new Response(JSON.stringify({ success: true, version }), { headers: corsHeaders });
        }
      }

      // 10. R2 Storage Upload (POST /api/upload)
      if (path === '/api/upload' && method === 'POST') {
        if (!bucket) {
          return new Response(JSON.stringify({ error: 'R2 bucket not bound. Bind env.BUCKET in wrangler.toml' }), { status: 500, headers: corsHeaders });
        }
        const key = `uploads/${Date.now()}-${crypto.randomUUID()}`;
        const data = await request.arrayBuffer();
        const contentType = request.headers.get('content-type') || 'application/octet-stream';
        await bucket.put(key, data, {
          httpMetadata: { contentType }
        });

        const fileUrl = `${url.origin}/api/files/${key}`;
        return new Response(JSON.stringify({ success: true, key, url: fileUrl }), { headers: corsHeaders });
      }

      // 11. R2 File Delivery (GET /api/files/*)
      if (path.startsWith('/api/files/') && method === 'GET') {
        if (!bucket) {
          return new Response('R2 storage bucket not configured', { status: 500, headers: corsHeaders });
        }
        const fileKey = decodeURIComponent(path.replace('/api/files/', ''));
        const object = await bucket.get(fileKey);
        if (!object) {
          return new Response('File not found', { status: 404, headers: corsHeaders });
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        headers.set('Access-Control-Allow-Origin', '*');

        return new Response(object.body, { headers });
      }

      // 12. Default 404 for unknown API routes
      return new Response(JSON.stringify({ error: 'API endpoint not found', path }), { status: 404, headers: corsHeaders });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { status: 500, headers: corsHeaders });
    }
  }
};
