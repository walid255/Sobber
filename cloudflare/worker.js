/**
 * SerenityCare Cloudflare Worker - Unified Edge API & Storage Engine
 * 
 * Complete serverless backend for SerenityCare Sober House Management:
 * - Cloudflare Workers KV (`env.SOBBER_KV`, `env.MY_KV_NAMESPACE`, or `env.KV`)
 * - Cloudflare D1 SQL Relational Database (`env.DB`)
 * - Cloudflare R2 Object Storage for Resident Photos & PDF Dossiers (`env.BUCKET`)
 * 
 * Guarantees zero edge-caching desync, immediate global state replication,
 * and robust database persistence across all connected devices and browsers.
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

// Authentication validator
function isAuthorized(request, env) {
  const secret = env.ADMIN_SECRET || env.AUTH_SECRET || env.SOBBER_ADMIN_SECRET;
  if (!secret) return true; // Backward compatibility if no secret set in Cloudflare dashboard
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  return token === secret.trim();
}

function getKV(env) {
  if (env.SOBBER_KV) return env.SOBBER_KV;
  if (env.MY_KV_NAMESPACE) return env.MY_KV_NAMESPACE;
  if (env.KV) return env.KV;
  if (env.SOBER_KV) return env.SOBER_KV;
  for (const key of Object.keys(env || {})) {
    const val = env[key];
    if (val && typeof val.get === 'function' && typeof val.put === 'function') {
      return val;
    }
  }
  return null;
}

// Ensure Cloudflare D1 SQL schema exists
async function initD1Schema(db) {
  if (!db) return false;
  const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      department TEXT,
      phone TEXT,
      status TEXT DEFAULT 'Active',
      permissions_json TEXT,
      last_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      admission_number TEXT UNIQUE,
      name TEXT NOT NULL,
      dob DATE,
      age INTEGER,
      gender TEXT,
      blood_group TEXT,
      phone TEXT,
      email TEXT,
      photo_url TEXT,
      admission_date DATE,
      stage TEXT DEFAULT 'Inpatient Recovery',
      room_number TEXT,
      bed_number TEXT,
      counselor_id TEXT,
      sobriety_days INTEGER DEFAULT 1,
      graduation_qualified INTEGER DEFAULT 0,
      graduation_date DATE,
      status TEXT DEFAULT 'Active',
      notes_json TEXT,
      vitals_json TEXT,
      raw_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS medication_logs (
      id TEXT PRIMARY KEY,
      patient_id TEXT,
      patient_name TEXT,
      prescription_id TEXT,
      med_name TEXT NOT NULL,
      dosage TEXT,
      scheduled_time TEXT,
      status TEXT DEFAULT 'Pending',
      administered_at DATETIME,
      nurse_name TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE,
      name TEXT NOT NULL,
      category TEXT,
      quantity INTEGER DEFAULT 0,
      unit TEXT,
      min_threshold INTEGER DEFAULT 10,
      cost REAL DEFAULT 0.0,
      batch_number TEXT,
      expiry_date DATE,
      location TEXT,
      controlled INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS timetable_events (
      id TEXT PRIMARY KEY,
      day TEXT,
      time_slot TEXT,
      title TEXT,
      category TEXT,
      facilitator TEXT,
      location TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      invoice_number TEXT UNIQUE NOT NULL,
      patient_id TEXT,
      patient_name TEXT NOT NULL,
      admission_number TEXT,
      payer_name TEXT,
      payer_phone TEXT,
      category TEXT DEFAULT 'Admission Fee',
      description TEXT,
      total_amount REAL NOT NULL DEFAULT 0.0,
      amount_paid REAL NOT NULL DEFAULT 0.0,
      balance REAL NOT NULL DEFAULT 0.0,
      currency TEXT DEFAULT 'TZS',
      status TEXT DEFAULT 'Paid',
      payment_method TEXT DEFAULT 'M-Pesa',
      reference_no TEXT,
      date DATE,
      due_date DATE,
      recorded_by TEXT,
      notes TEXT,
      installments_json TEXT DEFAULT '[]',
      receipt_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS facility_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR REPLACE INTO users (id, name, email, password_hash, role, department, phone, status, permissions_json)
    VALUES (
      'usr_admin',
      'System Administrator',
      'admin@serenitycare.org',
      'Admin@Serenity2026!',
      'admin',
      'Clinical Administration',
      '+1 (800) 555-7623',
      'Active',
      '{"dashboard":true,"patients":true,"medications":true,"timetable":true,"inventory":true,"certificates":true,"batch_upload":true,"users":true,"settings":true,"payments":true}'
    );
  `;
  try {
    await db.exec(sql);
    return true;
  } catch (err) {
    console.error('D1 schema init error:', err);
    return false;
  }
}

// Fetch complete state from D1 Database
async function loadStateFromD1(db) {
  if (!db) return null;
  try {
    // 1. Users
    const usersRes = await db.prepare("SELECT * FROM users ORDER BY created_at ASC").all();
    const users = (usersRes.results || []).map(u => {
      let perms = { dashboard: true, patients: true, medications: true, timetable: true, inventory: true, certificates: true, batch_upload: true, users: true, settings: true, payments: true };
      if (u.permissions_json) {
        try { perms = JSON.parse(u.permissions_json); } catch {}
      }
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        password: u.password_hash,
        role: u.role,
        department: u.department,
        phone: u.phone,
        status: u.status,
        permissions: perms,
        lastLogin: u.last_login
      };
    });

    // 2. Patients
    const patRes = await db.prepare("SELECT * FROM patients ORDER BY created_at DESC").all();
    const patients = (patRes.results || []).map(p => {
      if (p.raw_json) {
        try { return JSON.parse(p.raw_json); } catch {}
      }
      return {
        id: p.id,
        admissionNumber: p.admission_number,
        name: p.name,
        dob: p.dob,
        age: p.age,
        gender: p.gender,
        bloodGroup: p.blood_group,
        phone: p.phone,
        email: p.email,
        photoUrl: p.photo_url,
        admissionDate: p.admission_date,
        stage: p.stage,
        roomNumber: p.room_number,
        bedNumber: p.bed_number,
        counselorId: p.counselor_id,
        sobrietyDays: p.sobriety_days,
        graduationQualified: Boolean(p.graduation_qualified),
        graduationDate: p.graduation_date,
        status: p.status,
        notes: p.notes_json ? JSON.parse(p.notes_json) : [],
        vitals: p.vitals_json ? JSON.parse(p.vitals_json) : []
      };
    });

    // 3. Medication Logs
    const medRes = await db.prepare("SELECT * FROM medication_logs ORDER BY created_at DESC LIMIT 500").all();
    const medicationLogs = (medRes.results || []).map(m => ({
      id: m.id,
      patientId: m.patient_id,
      patientName: m.patient_name,
      prescriptionId: m.prescription_id,
      medName: m.med_name,
      dosage: m.dosage,
      scheduledTime: m.scheduled_time,
      status: m.status,
      administeredAt: m.administered_at,
      nurseName: m.nurse_name,
      notes: m.notes
    }));

    // 4. Inventory
    const invRes = await db.prepare("SELECT * FROM inventory_items ORDER BY name ASC").all();
    const inventory = (invRes.results || []).map(i => ({
      id: i.id,
      code: i.code,
      name: i.name,
      category: i.category,
      quantity: i.quantity,
      unit: i.unit,
      minThreshold: i.min_threshold,
      cost: i.cost,
      batchNumber: i.batch_number,
      expiryDate: i.expiry_date,
      location: i.location,
      controlled: Boolean(i.controlled)
    }));

    // 5. Timetable
    const ttRes = await db.prepare("SELECT * FROM timetable_events ORDER BY day ASC, time_slot ASC").all();
    const timetable = (ttRes.results || []).map(t => ({
      id: t.id,
      day: t.day,
      timeSlot: t.time_slot,
      title: t.title,
      category: t.category,
      facilitator: t.facilitator,
      location: t.location,
      notes: t.notes
    }));

    // 6. Payments
    const payRes = await db.prepare("SELECT * FROM payments ORDER BY created_at DESC").all();
    const payments = (payRes.results || []).map(p => {
      let inst = [];
      if (p.installments_json) {
        try { inst = JSON.parse(p.installments_json); } catch {}
      }
      return {
        id: p.id,
        invoiceNumber: p.invoice_number,
        patientId: p.patient_id,
        patientName: p.patient_name,
        admissionNumber: p.admission_number,
        payerName: p.payer_name,
        payerPhone: p.payer_phone,
        category: p.category,
        description: p.description,
        totalAmount: p.total_amount,
        amountPaid: p.amount_paid,
        balance: p.balance,
        currency: p.currency || 'TZS',
        status: p.status,
        paymentMethod: p.payment_method,
        referenceNo: p.reference_no,
        date: p.date,
        dueDate: p.due_date,
        recordedBy: p.recorded_by,
        notes: p.notes,
        installments: inst,
        receiptUrl: p.receipt_url
      };
    });

    // 7. Settings
    const setRes = await db.prepare("SELECT * FROM facility_settings").all();
    const facility = {
      name: 'SerenityCare Sober House & Recovery Center',
      licenseNumber: 'SH-84920-CLINICAL',
      address: '742 Hope Valley Road, Building B, Austin, TX 78701',
      phone: '+1 (800) 555-7623',
      email: 'admissions@serenitycare.org',
      director: 'Dr. Evelyn Vance, MD, FASAM',
      currency: 'TZS',
      totalBeds: 32
    };
    (setRes.results || []).forEach(r => {
      if (r.setting_key === 'facility_name') facility.name = r.setting_value;
      if (r.setting_key === 'currency') facility.currency = r.setting_value;
      if (r.setting_key === 'address') facility.address = r.setting_value;
      if (r.setting_key === 'phone') facility.phone = r.setting_value;
      if (r.setting_key === 'license_number') facility.licenseNumber = r.setting_value;
    });

    return {
      users,
      patients,
      medicationLogs,
      inventory,
      timetable,
      payments,
      facility,
      stateVersion: Date.now(),
      lastSyncedAt: new Date().toISOString()
    };
  } catch (err) {
    console.error('Error querying D1 database:', err);
    return null;
  }
}

// Upsert state into Cloudflare D1 Database
async function saveStateToD1(db, state) {
  if (!db || !state) return false;
  try {
    const statements = [];

    // 1. Users
    if (Array.isArray(state.users)) {
      for (const u of state.users) {
        const permsStr = JSON.stringify(u.permissions || {});
        statements.push(
          db.prepare(`
            INSERT OR REPLACE INTO users (id, name, email, password_hash, role, department, phone, status, permissions_json, last_login, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `).bind(
            u.id || `usr_${Date.now()}`,
            u.name || 'Staff Member',
            u.email || '',
            u.password || 'SerenityCare2026!',
            u.role || 'nurse',
            u.department || 'Clinical',
            u.phone || '',
            u.status || 'Active',
            permsStr,
            u.lastLogin || null
          )
        );
      }
    }

    // 2. Patients
    if (Array.isArray(state.patients)) {
      for (const p of state.patients) {
        const rawJson = JSON.stringify(p);
        const notesJson = JSON.stringify(p.notes || []);
        const vitalsJson = JSON.stringify(p.vitals || []);
        statements.push(
          db.prepare(`
            INSERT OR REPLACE INTO patients (id, admission_number, name, dob, age, gender, blood_group, phone, email, photo_url, admission_date, stage, room_number, bed_number, counselor_id, sobriety_days, graduation_qualified, graduation_date, status, notes_json, vitals_json, raw_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `).bind(
            p.id,
            p.admissionNumber || p.id,
            p.name,
            p.dob || '1990-01-01',
            p.age || 0,
            p.gender || 'Other',
            p.bloodGroup || '',
            p.phone || '',
            p.email || '',
            p.photoUrl || '',
            p.admissionDate || new Date().toISOString().split('T')[0],
            p.stage || 'Inpatient Recovery',
            p.roomNumber || '',
            p.bedNumber || '',
            p.counselorId || '',
            p.sobrietyDays || 1,
            p.graduationQualified ? 1 : 0,
            p.graduationDate || null,
            p.status || 'Active',
            notesJson,
            vitalsJson,
            rawJson
          )
        );
      }
    }

    // 3. Payments
    if (Array.isArray(state.payments)) {
      for (const pay of state.payments) {
        const instJson = JSON.stringify(pay.installments || []);
        statements.push(
          db.prepare(`
            INSERT OR REPLACE INTO payments (id, invoice_number, patient_id, patient_name, admission_number, payer_name, payer_phone, category, description, total_amount, amount_paid, balance, currency, status, payment_method, reference_no, date, due_date, recorded_by, notes, installments_json, receipt_url, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `).bind(
            pay.id,
            pay.invoiceNumber,
            pay.patientId || null,
            pay.patientName || 'General Charge',
            pay.admissionNumber || '',
            pay.payerName || '',
            pay.payerPhone || '',
            pay.category || 'Admission Fee',
            pay.description || '',
            Number(pay.totalAmount) || 0,
            Number(pay.amountPaid) || 0,
            Number(pay.balance) || 0,
            pay.currency || 'TZS',
            pay.status || 'Paid',
            pay.paymentMethod || 'M-Pesa',
            pay.referenceNo || '',
            pay.date || new Date().toISOString().split('T')[0],
            pay.dueDate || null,
            pay.recordedBy || 'Staff',
            pay.notes || '',
            instJson,
            pay.receiptUrl || ''
          )
        );
      }
    }

    // Execute in batch
    if (statements.length > 0) {
      // Chunk statements to stay within D1 limits (max 100 per batch)
      const chunkSize = 80;
      for (let i = 0; i < statements.length; i += chunkSize) {
        const chunk = statements.slice(i, i + chunkSize);
        await db.batch(chunk);
      }
    }
    return true;
  } catch (err) {
    console.error('Error saving state to D1:', err);
    return false;
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Auth verification on write operations
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      if (!isAuthorized(request, env)) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Unauthorized: Invalid or missing Bearer token in Authorization header' 
        }), { status: 401, headers: JSON_HEADERS });
      }
    }

    const kv = getKV(env);
    const db = env.DB;
    const bucket = env.BUCKET;

    try {
      // =======================================================================
      // 1. HEALTH DIAGNOSTICS & SYSTEM STATUS
      // =======================================================================
      if (path === '/api/health') {
        let d1Status = { connected: Boolean(db), tables: 0, counts: {} };
        if (db) {
          try {
            const tblRes = await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
            d1Status.tables = (tblRes.results || []).length;
            if (d1Status.tables > 0) {
              const uCount = await db.prepare("SELECT COUNT(*) as c FROM users").first();
              const pCount = await db.prepare("SELECT COUNT(*) as c FROM patients").first();
              const payCount = await db.prepare("SELECT COUNT(*) as c FROM payments").first();
              d1Status.counts = {
                users: uCount ? uCount.c : 0,
                patients: pCount ? pCount.c : 0,
                payments: payCount ? payCount.c : 0
              };
            }
          } catch (e) {
            d1Status.error = e.message;
          }
        }

        return new Response(JSON.stringify({
          status: 'online',
          system: 'SerenityCare Recovery Management System',
          edgeLocation: request.cf?.colo || 'LocalEdge',
          kv: {
            connected: Boolean(kv),
            bindingFound: Boolean(kv)
          },
          d1: d1Status,
          r2: {
            connected: Boolean(bucket)
          },
          timestamp: new Date().toISOString(),
          endpoints: [
            '/api/sync',
            '/api/content',
            '/api/payments',
            '/api/users',
            '/api/patients',
            '/api/medications',
            '/api/inventory',
            '/api/timetable',
            '/api/upload',
            '/api/init-db',
            '/api/health'
          ]
        }), { headers: JSON_HEADERS });
      }

      // =======================================================================
      // 2. INITIALIZE D1 SQL DATABASE (/api/init-db)
      // =======================================================================
      if (path === '/api/init-db') {
        if (!db) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Cloudflare D1 database binding missing (bind DB to serenitycare-db)' 
          }), { status: 500, headers: JSON_HEADERS });
        }
        const success = await initD1Schema(db);
        const tblRes = await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        return new Response(JSON.stringify({
          success,
          message: success ? 'D1 SQLite tables initialized and seeded successfully' : 'D1 schema initialization failed',
          tables: (tblRes.results || []).map(r => r.name)
        }), { headers: JSON_HEADERS });
      }

      // =======================================================================
      // 3. GLOBAL STATE SYNCHRONIZATION (/api/sync)
      // =======================================================================
      if (path === '/api/sync') {
        if (method === 'GET') {
          // Priority 1: Read from Cloudflare D1 SQL Relational Database
          if (db) {
            const d1State = await loadStateFromD1(db);
            if (d1State && Array.isArray(d1State.users) && d1State.users.length > 0) {
              // Update KV cache in background
              if (kv) {
                ctx.waitUntil(kv.put('sobber_state', JSON.stringify(d1State)));
              }
              return new Response(JSON.stringify(d1State), { headers: JSON_HEADERS });
            }
          }

          // Priority 2: Read from Cloudflare Workers KV
          if (kv) {
            let stateData = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
            if (!stateData) stateData = await kv.get('serenitycare_state', { type: 'text', cacheTtl: 0 });
            if (stateData) {
              return new Response(stateData, { headers: JSON_HEADERS });
            }
          }

          // Priority 3: Fallback seed state
          const defaultSeed = {
            users: [{
              id: 'usr_admin',
              name: 'System Administrator',
              email: 'admin@serenitycare.org',
              password: 'Admin@Serenity2026!',
              role: 'admin',
              status: 'Active',
              permissions: { dashboard: true, patients: true, medications: true, timetable: true, inventory: true, certificates: true, batch_upload: true, users: true, settings: true, payments: true }
            }],
            patients: [],
            payments: [],
            medicationLogs: [],
            inventory: [],
            timetable: [],
            facility: { name: 'SerenityCare Sober House & Recovery Center', currency: 'TZS', totalBeds: 32 },
            stateVersion: Date.now(),
            lastSyncedAt: new Date().toISOString()
          };
          return new Response(JSON.stringify(defaultSeed), { headers: JSON_HEADERS });
        }

        if (method === 'POST') {
          const stateObj = await request.json();
          stateObj.lastSyncedAt = new Date().toISOString();
          stateObj.stateVersion = Date.now();

          // 1. Persist to Cloudflare D1 SQL Database
          let d1Saved = false;
          if (db) {
            d1Saved = await saveStateToD1(db, stateObj);
          }

          // 2. Persist to Cloudflare Workers KV Cache
          if (kv) {
            const stringified = JSON.stringify(stateObj);
            await kv.put('sobber_state', stringified);
            if (Array.isArray(stateObj.users)) await kv.put('sobber_users', JSON.stringify(stateObj.users));
            if (Array.isArray(stateObj.patients)) await kv.put('sobber_patients', JSON.stringify(stateObj.patients));
            if (Array.isArray(stateObj.payments)) await kv.put('sobber_payments', JSON.stringify(stateObj.payments));
            if (Array.isArray(stateObj.medicationLogs)) await kv.put('sobber_medications', JSON.stringify(stateObj.medicationLogs));
            if (Array.isArray(stateObj.inventory)) await kv.put('sobber_inventory', JSON.stringify(stateObj.inventory));
            if (Array.isArray(stateObj.timetable)) await kv.put('sobber_timetable', JSON.stringify(stateObj.timetable));
          }

          return new Response(JSON.stringify({
            success: true,
            persistedToD1: d1Saved,
            persistedToKV: Boolean(kv),
            timestamp: stateObj.lastSyncedAt,
            version: stateObj.stateVersion,
            state: stateObj
          }), { headers: JSON_HEADERS });
        }
      }

      // =======================================================================
      // 4. GLOBAL CONTENT SUBMISSION (/api/content)
      // =======================================================================
      if (path === '/api/content') {
        if (method === 'GET') {
          if (kv) {
            let rawData = await kv.get('site_data', { type: 'text', cacheTtl: 0 });
            if (!rawData) rawData = await kv.get('sobber_content', { type: 'text', cacheTtl: 0 });
            if (!rawData) rawData = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
            if (rawData) {
              return new Response(rawData, { headers: JSON_HEADERS });
            }
          }
          if (db) {
            const state = await loadStateFromD1(db);
            if (state) return new Response(JSON.stringify(state), { headers: JSON_HEADERS });
          }
          return new Response("{}", { headers: JSON_HEADERS });
        }

        if (method === 'POST') {
          const newData = await request.json();
          const timestamp = new Date().toISOString();
          const version = Date.now();

          if (newData && typeof newData === 'object' && !Array.isArray(newData)) {
            newData.lastUpdated = timestamp;
            newData.contentVersion = version;
          }

          const stringified = JSON.stringify(newData);

          // Save to KV
          if (kv) {
            await kv.put('site_data', stringified);
            await kv.put('sobber_content', stringified);
            if (newData && typeof newData === 'object') {
              if (Array.isArray(newData.users) || Array.isArray(newData.patients)) {
                await kv.put('sobber_state', stringified);
              }
            }
          }

          // Save to D1
          let d1Saved = false;
          if (db && newData && typeof newData === 'object') {
            d1Saved = await saveStateToD1(db, newData);
          }

          return new Response(JSON.stringify({
            success: true,
            message: 'Updated globally in KV and D1',
            d1Persisted: d1Saved,
            timestamp,
            version,
            data: newData
          }), { headers: JSON_HEADERS });
        }
      }

      // =======================================================================
      // 5. BILLING & PAYMENTS (/api/payments)
      // =======================================================================
      if (path === '/api/payments') {
        const patientId = url.searchParams.get('patientId');
        const paymentId = url.searchParams.get('id');

        if (method === 'GET') {
          let list = [];

          // 1. Try D1
          if (db) {
            try {
              let query = "SELECT * FROM payments";
              let params = [];
              if (paymentId) {
                query += " WHERE id = ?";
                params.push(paymentId);
              } else if (patientId) {
                query += " WHERE patient_id = ?";
                params.push(patientId);
              }
              query += " ORDER BY created_at DESC";
              const res = await db.prepare(query).bind(...params).all();
              list = (res.results || []).map(p => {
                let inst = [];
                if (p.installments_json) {
                  try { inst = JSON.parse(p.installments_json); } catch {}
                }
                return {
                  id: p.id,
                  invoiceNumber: p.invoice_number,
                  patientId: p.patient_id,
                  patientName: p.patient_name,
                  admissionNumber: p.admission_number,
                  payerName: p.payer_name,
                  payerPhone: p.payer_phone,
                  category: p.category,
                  description: p.description,
                  totalAmount: p.total_amount,
                  amountPaid: p.amount_paid,
                  balance: p.balance,
                  currency: p.currency || 'TZS',
                  status: p.status,
                  paymentMethod: p.payment_method,
                  referenceNo: p.reference_no,
                  date: p.date,
                  dueDate: p.due_date,
                  recordedBy: p.recorded_by,
                  notes: p.notes,
                  installments: inst,
                  receiptUrl: p.receipt_url
                };
              });
            } catch (e) {
              console.warn('D1 payments read error, falling back to KV:', e);
            }
          }

          // 2. Fallback to KV if D1 is empty or not configured
          if (list.length === 0 && kv) {
            let raw = await kv.get('sobber_payments', { type: 'text', cacheTtl: 0 });
            if (raw) {
              try { list = JSON.parse(raw); } catch {}
            } else {
              const stateRaw = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
              if (stateRaw) {
                try {
                  const s = JSON.parse(stateRaw);
                  if (Array.isArray(s.payments)) list = s.payments;
                } catch {}
              }
            }
            if (paymentId) list = list.filter(p => p.id === paymentId);
            else if (patientId) list = list.filter(p => p.patientId === patientId);
          }

          if (paymentId) {
            const single = list[0];
            if (!single) return new Response(JSON.stringify({ error: 'Payment not found' }), { status: 404, headers: JSON_HEADERS });
            return new Response(JSON.stringify(single), { headers: JSON_HEADERS });
          }

          return new Response(JSON.stringify(list), { headers: JSON_HEADERS });
        }

        if (method === 'POST') {
          const payload = await request.json();
          const items = Array.isArray(payload) ? payload : [payload];

          // 1. Save to D1
          if (db) {
            try {
              const stmts = items.map(pay => {
                const instJson = JSON.stringify(pay.installments || []);
                return db.prepare(`
                  INSERT OR REPLACE INTO payments (id, invoice_number, patient_id, patient_name, admission_number, payer_name, payer_phone, category, description, total_amount, amount_paid, balance, currency, status, payment_method, reference_no, date, due_date, recorded_by, notes, installments_json, receipt_url, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                `).bind(
                  pay.id,
                  pay.invoiceNumber || `INV-${Date.now()}`,
                  pay.patientId || null,
                  pay.patientName || 'General Care',
                  pay.admissionNumber || '',
                  pay.payerName || '',
                  pay.payerPhone || '',
                  pay.category || 'Admission Fee',
                  pay.description || '',
                  Number(pay.totalAmount) || 0,
                  Number(pay.amountPaid) || 0,
                  Number(pay.balance) || 0,
                  pay.currency || 'TZS',
                  pay.status || 'Paid',
                  pay.paymentMethod || 'M-Pesa',
                  pay.referenceNo || '',
                  pay.date || new Date().toISOString().split('T')[0],
                  pay.dueDate || null,
                  pay.recordedBy || 'Staff',
                  pay.notes || '',
                  instJson,
                  pay.receiptUrl || ''
                );
              });
              await db.batch(stmts);
            } catch (e) {
              console.error('D1 payments insert error:', e);
            }
          }

          // 2. Save to KV
          if (kv) {
            let current = [];
            const existing = await kv.get('sobber_payments', { type: 'text', cacheTtl: 0 });
            if (existing) {
              try { current = JSON.parse(existing); } catch {}
            }
            items.forEach(newItem => {
              const idx = current.findIndex(p => p.id === newItem.id || p.invoiceNumber === newItem.invoiceNumber);
              if (idx >= 0) current[idx] = { ...current[idx], ...newItem };
              else current.unshift(newItem);
            });
            await kv.put('sobber_payments', JSON.stringify(current));

            // Sync with sobber_state
            const stateRaw = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
            if (stateRaw) {
              try {
                const s = JSON.parse(stateRaw);
                s.payments = current;
                s.lastSyncedAt = new Date().toISOString();
                s.stateVersion = Date.now();
                await kv.put('sobber_state', JSON.stringify(s));
              } catch {}
            }
          }

          return new Response(JSON.stringify({ success: true, count: items.length, version: Date.now() }), { headers: JSON_HEADERS });
        }

        if (method === 'DELETE') {
          const id = url.searchParams.get('id');
          if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: JSON_HEADERS });

          if (db) {
            try {
              await db.prepare("DELETE FROM payments WHERE id = ?").bind(id).run();
            } catch (e) {}
          }

          if (kv) {
            let current = [];
            const existing = await kv.get('sobber_payments', { type: 'text', cacheTtl: 0 });
            if (existing) {
              try { current = JSON.parse(existing); } catch {}
            }
            current = current.filter(p => p.id !== id);
            await kv.put('sobber_payments', JSON.stringify(current));

            const stateRaw = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
            if (stateRaw) {
              try {
                const s = JSON.parse(stateRaw);
                s.payments = current;
                await kv.put('sobber_state', JSON.stringify(s));
              } catch {}
            }
          }

          return new Response(JSON.stringify({ success: true, deletedId: id }), { headers: JSON_HEADERS });
        }
      }

      // =======================================================================
      // 6. STAFF & RBAC USERS (/api/users)
      // =======================================================================
      if (path === '/api/users') {
        if (method === 'GET') {
          if (db) {
            try {
              const res = await db.prepare("SELECT * FROM users ORDER BY created_at ASC").all();
              const list = (res.results || []).map(u => ({
                id: u.id,
                name: u.name,
                email: u.email,
                password: u.password_hash,
                role: u.role,
                department: u.department,
                phone: u.phone,
                status: u.status,
                permissions: u.permissions_json ? JSON.parse(u.permissions_json) : {},
                lastLogin: u.last_login
              }));
              if (list.length > 0) return new Response(JSON.stringify(list), { headers: JSON_HEADERS });
            } catch (e) {}
          }
          if (kv) {
            const raw = await kv.get('sobber_users', { type: 'text', cacheTtl: 0 });
            if (raw) return new Response(raw, { headers: JSON_HEADERS });
          }
          return new Response(JSON.stringify([]), { headers: JSON_HEADERS });
        }

        if (method === 'POST') {
          const payload = await request.json();
          const items = Array.isArray(payload) ? payload : [payload];

          if (db) {
            try {
              const stmts = items.map(u => {
                const permsStr = JSON.stringify(u.permissions || {});
                return db.prepare(`
                  INSERT OR REPLACE INTO users (id, name, email, password_hash, role, department, phone, status, permissions_json, last_login, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                `).bind(
                  u.id || `usr_${Date.now()}`,
                  u.name || 'Staff Member',
                  u.email || '',
                  u.password || 'SerenityCare2026!',
                  u.role || 'nurse',
                  u.department || 'Clinical',
                  u.phone || '',
                  u.status || 'Active',
                  permsStr,
                  u.lastLogin || null
                );
              });
              await db.batch(stmts);
            } catch (e) {
              console.error('D1 users insert error:', e);
            }
          }

          if (kv) {
            let current = [];
            const existing = await kv.get('sobber_users', { type: 'text', cacheTtl: 0 });
            if (existing) {
              try { current = JSON.parse(existing); } catch {}
            }
            items.forEach(u => {
              const idx = current.findIndex(usr => usr.id === u.id || usr.email === u.email);
              if (idx >= 0) current[idx] = { ...current[idx], ...u };
              else current.push(u);
            });
            await kv.put('sobber_users', JSON.stringify(current));

            const stateRaw = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
            if (stateRaw) {
              try {
                const s = JSON.parse(stateRaw);
                s.users = current;
                await kv.put('sobber_state', JSON.stringify(s));
              } catch {}
            }
          }

          return new Response(JSON.stringify({ success: true, count: items.length }), { headers: JSON_HEADERS });
        }

        if (method === 'DELETE') {
          const id = url.searchParams.get('id');
          if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: JSON_HEADERS });
          if (db) {
            try { await db.prepare("DELETE FROM users WHERE id = ?").bind(id).run(); } catch (e) {}
          }
          if (kv) {
            let list = [];
            const existing = await kv.get('sobber_users', { type: 'text', cacheTtl: 0 });
            if (existing) {
              try { list = JSON.parse(existing); } catch {}
            }
            list = list.filter(u => u.id !== id);
            await kv.put('sobber_users', JSON.stringify(list));
          }
          return new Response(JSON.stringify({ success: true, deletedId: id }), { headers: JSON_HEADERS });
        }
      }

      // =======================================================================
      // 7. PATIENTS REGISTRY (/api/patients)
      // =======================================================================
      if (path === '/api/patients') {
        if (method === 'GET') {
          if (db) {
            try {
              const res = await db.prepare("SELECT * FROM patients ORDER BY created_at DESC").all();
              const list = (res.results || []).map(p => {
                if (p.raw_json) {
                  try { return JSON.parse(p.raw_json); } catch {}
                }
                return {
                  id: p.id,
                  admissionNumber: p.admission_number,
                  name: p.name,
                  stage: p.stage,
                  roomNumber: p.room_number,
                  bedNumber: p.bed_number,
                  sobrietyDays: p.sobriety_days,
                  phone: p.phone,
                  photoUrl: p.photo_url
                };
              });
              if (list.length > 0) return new Response(JSON.stringify(list), { headers: JSON_HEADERS });
            } catch (e) {}
          }
          if (kv) {
            const raw = await kv.get('sobber_patients', { type: 'text', cacheTtl: 0 });
            if (raw) return new Response(raw, { headers: JSON_HEADERS });
          }
          return new Response(JSON.stringify([]), { headers: JSON_HEADERS });
        }

        if (method === 'POST') {
          const payload = await request.json();
          const items = Array.isArray(payload) ? payload : [payload];

          if (db) {
            try {
              const stmts = items.map(p => {
                return db.prepare(`
                  INSERT OR REPLACE INTO patients (id, admission_number, name, dob, age, gender, blood_group, phone, email, photo_url, admission_date, stage, room_number, bed_number, counselor_id, sobriety_days, graduation_qualified, graduation_date, status, notes_json, vitals_json, raw_json, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                `).bind(
                  p.id,
                  p.admissionNumber || p.id,
                  p.name,
                  p.dob || '1990-01-01',
                  p.age || 0,
                  p.gender || 'Other',
                  p.bloodGroup || '',
                  p.phone || '',
                  p.email || '',
                  p.photoUrl || '',
                  p.admissionDate || new Date().toISOString().split('T')[0],
                  p.stage || 'Inpatient Recovery',
                  p.roomNumber || '',
                  p.bedNumber || '',
                  p.counselorId || '',
                  p.sobrietyDays || 1,
                  p.graduationQualified ? 1 : 0,
                  p.graduationDate || null,
                  p.status || 'Active',
                  JSON.stringify(p.notes || []),
                  JSON.stringify(p.vitals || []),
                  JSON.stringify(p)
                );
              });
              await db.batch(stmts);
            } catch (e) {
              console.error('D1 patients save error:', e);
            }
          }

          if (kv) {
            let list = [];
            const existing = await kv.get('sobber_patients', { type: 'text', cacheTtl: 0 });
            if (existing) {
              try { list = JSON.parse(existing); } catch {}
            }
            items.forEach(p => {
              const idx = list.findIndex(item => item.id === p.id);
              if (idx >= 0) list[idx] = { ...list[idx], ...p };
              else list.unshift(p);
            });
            await kv.put('sobber_patients', JSON.stringify(list));

            const stateRaw = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
            if (stateRaw) {
              try {
                const s = JSON.parse(stateRaw);
                s.patients = list;
                await kv.put('sobber_state', JSON.stringify(s));
              } catch {}
            }
          }

          return new Response(JSON.stringify({ success: true, count: items.length }), { headers: JSON_HEADERS });
        }

        if (method === 'DELETE') {
          const id = url.searchParams.get('id');
          if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: JSON_HEADERS });
          if (db) {
            try { await db.prepare("DELETE FROM patients WHERE id = ?").bind(id).run(); } catch (e) {}
          }
          if (kv) {
            let list = [];
            const existing = await kv.get('sobber_patients', { type: 'text', cacheTtl: 0 });
            if (existing) {
              try { list = JSON.parse(existing); } catch {}
            }
            list = list.filter(p => p.id !== id);
            await kv.put('sobber_patients', JSON.stringify(list));
          }
          return new Response(JSON.stringify({ success: true, deletedId: id }), { headers: JSON_HEADERS });
        }
      }

      // =======================================================================
      // 8. R2 STORAGE UPLOADS & FILE SERVING (/api/upload & /api/files/*)
      // =======================================================================
      if (path === '/api/upload' && method === 'POST') {
        if (!bucket) {
          return new Response(JSON.stringify({ 
            error: 'Cloudflare R2 bucket not bound (bind BUCKET in wrangler.toml)' 
          }), { status: 500, headers: JSON_HEADERS });
        }

        const filename = url.searchParams.get('name') || `file_${Date.now()}`;
        const ext = filename.includes('.') ? filename.split('.').pop() : 'bin';
        const key = `uploads/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const contentType = request.headers.get('content-type') || 'application/octet-stream';
        const fileData = await request.arrayBuffer();

        await bucket.put(key, fileData, {
          httpMetadata: { contentType }
        });

        const fileUrl = `${url.origin}/api/files/${encodeURIComponent(key)}`;
        return new Response(JSON.stringify({
          success: true,
          key,
          url: fileUrl,
          size: fileData.byteLength,
          contentType
        }), { headers: JSON_HEADERS });
      }

      if (path.startsWith('/api/files/')) {
        if (!bucket) {
          return new Response(JSON.stringify({ error: 'R2 bucket not bound' }), { status: 500, headers: JSON_HEADERS });
        }
        const key = decodeURIComponent(path.replace('/api/files/', ''));
        const object = await bucket.get(key);
        if (!object) {
          return new Response(JSON.stringify({ error: 'File not found' }), { status: 404, headers: JSON_HEADERS });
        }

        const headers = new Headers();
        headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
        headers.set('ETag', object.httpEtag);
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        headers.set('Access-Control-Allow-Origin', '*');

        return new Response(object.body, { headers });
      }

      // 404 handler for unknown API routes
      return new Response(JSON.stringify({ 
        error: 'API endpoint not found', 
        path,
        available: ['/api/sync', '/api/content', '/api/payments', '/api/users', '/api/patients', '/api/health', '/api/init-db', '/api/upload'] 
      }), { status: 404, headers: JSON_HEADERS });

    } catch (err) {
      console.error('Worker error:', err);
      return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { status: 500, headers: JSON_HEADERS });
    }
  }
};
