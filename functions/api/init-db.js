/**
 * Cloudflare Pages Function: /api/init-db
 * 
 * Automatically initializes and seeds Cloudflare D1 SQL Relational Database schema
 * for SerenityCare Sober House (`context.env.DB`).
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

const D1_SCHEMA = `
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
    reorder_level INTEGER DEFAULT 10,
    expiry_date DATE,
    batch_number TEXT,
    unit_cost REAL DEFAULT 0,
    status TEXT DEFAULT 'In Stock',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS timetable_events (
    id TEXT PRIMARY KEY,
    day TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT,
    facilitator TEXT,
    room TEXT,
    attendance_required INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

  CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT
  );

  CREATE TABLE IF NOT EXISTS facility_settings (
    key TEXT PRIMARY KEY,
    value_json TEXT,
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

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequest(context) {
  const db = context.env?.DB;
  if (!db) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Cloudflare D1 database binding missing. In Cloudflare Dashboard -> Pages -> Settings -> Functions: Bind D1 Database with variable name "DB" to your D1 database.'
    }), { status: 400, headers: JSON_HEADERS });
  }

  try {
    await db.exec(D1_SCHEMA);
    const tablesRes = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name ASC").all();
    const tables = (tablesRes.results || []).map(t => t.name);

    return new Response(JSON.stringify({
      success: true,
      message: 'Cloudflare D1 SQLite tables initialized successfully',
      tables
    }), { status: 200, headers: JSON_HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message
    }), { status: 500, headers: JSON_HEADERS });
  }
}
