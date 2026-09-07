/**
 * Cloudflare Pages Function: /api/sync
 * 
 * Synchronizes global SerenityCare Sober House state
 * across Cloudflare D1 SQL Relational Database (`context.env.DB`)
 * and Cloudflare Workers KV Cache (`context.env.SOBBER_KV` or `context.env.KV`).
 * 
 * Enforces strong edge-cache bypassing with strict headers:
 * - Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0
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

const SEED_SOBBER_STATE = {
  facility: {
    name: 'SerenityCare Sober House & Recovery Center',
    licenseNumber: 'SH-84920-CLINICAL',
    address: '742 Hope Valley Road, Building B, Austin, TX 78701',
    phone: '+1 (800) 555-7623',
    email: 'admissions@serenitycare.org',
    director: 'Dr. Evelyn Vance, MD, FASAM',
    currency: 'TZS',
    totalBeds: 32
  },
  currency: 'TZS',
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
      permissions: {
        dashboard: true,
        patients: true,
        medications: true,
        timetable: true,
        inventory: true,
        certificates: true,
        batch_upload: true,
        users: true,
        settings: true,
        payments: true
      }
    }
  ],
  patients: [],
  medicationLogs: [],
  inventory: [],
  timetable: [],
  payments: [],
  stateVersion: Date.now(),
  lastSyncedAt: new Date().toISOString()
};

function isKV(val, key = '') {
  if (!val || typeof val !== 'object') return false;
  const upper = String(key).toUpperCase();
  if (upper === 'ASSETS' || upper === 'DB' || upper === 'BUCKET' || upper === 'CF_PAGES') return false;
  // Exclude Fetchers / Service bindings which have .fetch()
  if (typeof val.fetch === 'function') return false;
  // Exclude D1 databases which have .prepare()
  if (typeof val.prepare === 'function' || typeof val.exec === 'function') return false;
  // Real KV namespaces have get, put, delete, list
  return typeof val.get === 'function' && typeof val.put === 'function' && typeof val.list === 'function';
}

function getKV(context) {
  const env = context?.env;
  if (!env || typeof env !== 'object') return null;

  // 1. Specific known variable names
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

  // 2. Scan other bindings, strictly excluding reserved objects
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

const D1_SCHEMA_SYNC = `
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
  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL,
    patient_id TEXT,
    patient_name TEXT NOT NULL,
    admission_number TEXT,
    payer_name TEXT NOT NULL,
    payer_phone TEXT,
    category TEXT NOT NULL,
    description TEXT,
    total_amount REAL NOT NULL DEFAULT 0,
    amount_paid REAL NOT NULL DEFAULT 0,
    balance REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'TZS',
    status TEXT NOT NULL DEFAULT 'Paid',
    payment_method TEXT NOT NULL,
    reference_no TEXT,
    date DATE NOT NULL,
    due_date DATE,
    recorded_by TEXT NOT NULL,
    notes TEXT,
    installments_json TEXT DEFAULT '[]',
    receipt_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  INSERT OR IGNORE INTO users (id, name, email, password_hash, role, department, status, permissions_json)
  VALUES (
    'usr_admin',
    'System Administrator',
    'admin@serenitycare.org',
    'Admin@Serenity2026!',
    'admin',
    'Clinical Administration',
    'Active',
    '{"dashboard":true,"patients":true,"medications":true,"timetable":true,"inventory":true,"certificates":true,"batch_upload":true,"users":true,"settings":true,"payments":true}'
  );
`;

async function loadFromD1(db) {
  if (!db || typeof db.prepare !== 'function') return null;
  try {
    // Check if tables exist, auto-init if empty
    try {
      const tblCheck = await db.prepare("SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='users'").first();
      if (!tblCheck || tblCheck.cnt === 0) {
        if (typeof db.exec === 'function') {
          await db.exec(D1_SCHEMA_SYNC);
        }
      }
    } catch (tblErr) {
      console.warn('D1 table check notice:', tblErr.message);
    }

    let users = [];
    try {
      const usersRes = await db.prepare("SELECT * FROM users ORDER BY created_at ASC").all();
      users = (usersRes.results || []).map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        password: u.password_hash,
        role: u.role,
        department: u.department,
        phone: u.phone,
        status: u.status,
        permissions: u.permissions_json ? JSON.parse(u.permissions_json) : { dashboard: true, payments: true, users: true, settings: true },
        lastLogin: u.last_login
      }));
    } catch (uErr) {
      console.warn('D1 users read notice:', uErr.message);
    }

    let patients = [];
    try {
      const patRes = await db.prepare("SELECT * FROM patients ORDER BY created_at DESC").all();
      patients = (patRes.results || []).map(p => {
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
          phone: p.phone
        };
      });
    } catch (pErr) {
      console.warn('D1 patients read notice:', pErr.message);
    }

    let payments = [];
    try {
      const payRes = await db.prepare("SELECT * FROM payments ORDER BY created_at DESC").all();
      payments = (payRes.results || []).map(p => ({
        id: p.id,
        invoiceNumber: p.invoice_number,
        patientId: p.patient_id,
        patientName: p.patient_name,
        totalAmount: p.total_amount,
        amountPaid: p.amount_paid,
        balance: p.balance,
        currency: p.currency || 'TZS',
        status: p.status,
        paymentMethod: p.payment_method,
        referenceNo: p.reference_no,
        date: p.date,
        installments: p.installments_json ? JSON.parse(p.installments_json) : []
      }));
    } catch (payErr) {
      console.warn('D1 payments read notice:', payErr.message);
    }

    if (users.length > 0 || patients.length > 0 || payments.length > 0) {
      return {
        ...SEED_SOBBER_STATE,
        users: users.length > 0 ? users : SEED_SOBBER_STATE.users,
        patients,
        payments,
        stateVersion: Date.now(),
        lastSyncedAt: new Date().toISOString()
      };
    }
    return null;
  } catch (err) {
    console.warn('Pages D1 query error:', err.message);
    return null;
  }
}

async function saveToD1(db, state) {
  if (!db || !state || typeof db.prepare !== 'function') return false;
  try {
    const statements = [];
    if (Array.isArray(state.users)) {
      for (const u of state.users) {
        statements.push(
          db.prepare(`
            INSERT OR REPLACE INTO users (id, name, email, password_hash, role, department, phone, status, permissions_json, last_login, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `).bind(
            u.id, u.name, u.email, u.password || 'SerenityCare2026!', u.role || 'nurse',
            u.department || 'Clinical', u.phone || '', u.status || 'Active',
            JSON.stringify(u.permissions || {}), u.lastLogin || null
          )
        );
      }
    }
    if (Array.isArray(state.payments)) {
      for (const pay of state.payments) {
        statements.push(
          db.prepare(`
            INSERT OR REPLACE INTO payments (id, invoice_number, patient_id, patient_name, admission_number, payer_name, payer_phone, category, description, total_amount, amount_paid, balance, currency, status, payment_method, reference_no, date, due_date, recorded_by, notes, installments_json, receipt_url, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `).bind(
            pay.id, pay.invoiceNumber || `INV-${Date.now()}`, pay.patientId || null,
            pay.patientName || 'General', pay.admissionNumber || '', pay.payerName || '',
            pay.payerPhone || '', pay.category || 'Admission Fee', pay.description || '',
            Number(pay.totalAmount) || 0, Number(pay.amountPaid) || 0, Number(pay.balance) || 0,
            pay.currency || 'TZS', pay.status || 'Paid', pay.paymentMethod || 'M-Pesa',
            pay.referenceNo || '', pay.date || new Date().toISOString().split('T')[0],
            pay.dueDate || null, pay.recordedBy || 'Staff', pay.notes || '',
            JSON.stringify(pay.installments || []), pay.receiptUrl || ''
          )
        );
      }
    }
    if (statements.length > 0 && typeof db.batch === 'function') {
      await db.batch(statements);
    }
    return true;
  } catch (err) {
    console.error('Pages D1 save error:', err.message);
    return false;
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS
  });
}

export async function onRequestGet(context) {
  try {
    const db = context.env?.DB;
    const kv = getKV(context);

    // 1. Try D1 first
    if (db) {
      try {
        const d1Data = await loadFromD1(db);
        if (d1Data) {
          if (kv) {
            safeKvPut(kv, 'sobber_state', d1Data).catch(() => {});
          }
          return new Response(JSON.stringify(d1Data), { status: 200, headers: JSON_HEADERS });
        }
      } catch (d1Err) {
        console.warn('D1 fetch exception:', d1Err.message);
      }
    }

    // 2. Try KV
    if (kv) {
      let raw = await safeKvGet(kv, 'sobber_state');
      if (!raw) raw = await safeKvGet(kv, 'serenitycare_state');
      if (raw) {
        return new Response(raw, { status: 200, headers: JSON_HEADERS });
      }
    }

    // 3. Fallback to default state (Status 200 OK so UI never receives 500)
    return new Response(JSON.stringify(SEED_SOBBER_STATE), { status: 200, headers: JSON_HEADERS });
  } catch (err) {
    console.error('Pages /api/sync unhandled GET error:', err.message);
    return new Response(JSON.stringify(SEED_SOBBER_STATE), { status: 200, headers: JSON_HEADERS });
  }
}

export async function onRequestPost(context) {
  try {
    if (!isAuthorized(context)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS });
    }

    const db = context.env?.DB;
    const kv = getKV(context);
    let stateObj;
    try {
      stateObj = await context.request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), { status: 400, headers: JSON_HEADERS });
    }

    stateObj.lastSyncedAt = new Date().toISOString();
    stateObj.stateVersion = Date.now();

    let d1Saved = false;
    if (db) {
      d1Saved = await saveToD1(db, stateObj);
    }

    let kvSaved = false;
    if (kv) {
      kvSaved = await safeKvPut(kv, 'sobber_state', stateObj);
      if (Array.isArray(stateObj.users)) await safeKvPut(kv, 'sobber_users', stateObj.users);
      if (Array.isArray(stateObj.patients)) await safeKvPut(kv, 'sobber_patients', stateObj.patients);
      if (Array.isArray(stateObj.payments)) await safeKvPut(kv, 'sobber_payments', stateObj.payments);
    }

    return new Response(JSON.stringify({
      success: true,
      d1Saved,
      kvSaved,
      timestamp: stateObj.lastSyncedAt,
      version: stateObj.stateVersion
    }), { status: 200, headers: JSON_HEADERS });
  } catch (err) {
    console.error('Pages /api/sync unhandled POST error:', err.message);
    return new Response(JSON.stringify({ 
      success: true, 
      localOnly: true, 
      warning: err.message 
    }), { status: 200, headers: JSON_HEADERS });
  }
}
