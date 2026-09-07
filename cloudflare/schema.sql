-- ============================================================================
-- SerenityCare Cloudflare D1 Relational SQLite Database Schema
-- Production Ready for Cloudflare D1 SQL Serverless Database
-- 
-- Execution methods:
-- 1. Cloudflare Dashboard: Workers & Pages -> D1 -> serenitycare-db -> Console -> Paste & Execute
-- 2. Wrangler CLI: wrangler d1 execute serenitycare-db --file=./cloudflare/schema.sql
-- ============================================================================

-- 1. Staff & User Access Control (RBAC) Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'doctor', 'nurse', 'counselor')),
    department TEXT,
    phone TEXT,
    status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive', 'Suspended')),
    permissions_json TEXT DEFAULT '{"dashboard":true,"patients":true,"medications":true,"timetable":true,"inventory":true,"certificates":true,"batch_upload":true,"users":true,"settings":true,"payments":true}',
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Patients / Residents Registry
CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    admission_number TEXT UNIQUE,
    name TEXT NOT NULL,
    dob DATE NOT NULL,
    age INTEGER,
    gender TEXT,
    blood_group TEXT,
    phone TEXT,
    email TEXT,
    photo_url TEXT,
    admission_date DATE DEFAULT (DATE('now')),
    stage TEXT DEFAULT 'Inpatient Recovery' CHECK(stage IN ('Detoxification', 'Inpatient Recovery', 'Transition / Halfway', 'Intensive Outpatient', 'Graduated')),
    room_number TEXT,
    bed_number TEXT,
    counselor_id TEXT,
    sobriety_days INTEGER DEFAULT 1,
    graduation_qualified INTEGER DEFAULT 0,
    graduation_date DATE,
    status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Discharged', 'Transferred', 'Graduated')),
    notes_json TEXT,
    vitals_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Next of Kin & Emergency Contacts
CREATE TABLE IF NOT EXISTS next_of_kin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id TEXT NOT NULL,
    name TEXT NOT NULL,
    relationship TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    emergency_consent INTEGER DEFAULT 1,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- 4. Psychiatric & Substance Abuse History
CREATE TABLE IF NOT EXISTS psychiatric_histories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id TEXT NOT NULL UNIQUE,
    primary_substance TEXT NOT NULL,
    secondary_substance TEXT,
    addiction_duration_years INTEGER,
    prior_rehabs INTEGER DEFAULT 0,
    suicide_risk TEXT DEFAULT 'Low',
    diagnoses_json TEXT,
    allergies_json TEXT,
    clinical_notes TEXT,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- 5. Daily Vital Signs & Screenings
CREATE TABLE IF NOT EXISTS patient_vitals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id TEXT NOT NULL,
    bp TEXT NOT NULL,
    pulse INTEGER NOT NULL,
    temp TEXT NOT NULL,
    o2 TEXT NOT NULL,
    drug_screen_result TEXT NOT NULL,
    recorded_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- 6. Clinical & Counseling Progress Notes
CREATE TABLE IF NOT EXISTS progress_notes (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    author TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('Clinical', 'Counseling', 'Behavioral', 'Incident')),
    sobriety_days INTEGER,
    note TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- 7. Physician Prescriptions
CREATE TABLE IF NOT EXISTS prescriptions (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    medication_name TEXT NOT NULL,
    dosage TEXT NOT NULL,
    frequency TEXT NOT NULL,
    times_json TEXT NOT NULL,
    instructions TEXT,
    prescribing_doctor TEXT NOT NULL,
    status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Discontinued')),
    start_date DATE DEFAULT (DATE('now')),
    end_date DATE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- 8. Medication Administration Records (MAR) Daily Logs
CREATE TABLE IF NOT EXISTS medication_logs (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    patient_name TEXT,
    prescription_id TEXT,
    med_name TEXT NOT NULL,
    dosage TEXT,
    scheduled_time TEXT NOT NULL,
    status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Administered', 'Refused', 'Missed')),
    administered_at DATETIME,
    nurse_name TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- 9. Facility Store & Pharmacy Inventory
CREATE TABLE IF NOT EXISTS inventory_items (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    unit TEXT NOT NULL,
    min_threshold INTEGER NOT NULL DEFAULT 10,
    cost REAL DEFAULT 0.00,
    batch_number TEXT,
    expiry_date DATE,
    location TEXT,
    controlled INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. Inventory Audit Transactions Log
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('Stock In', 'Dispensed', 'Adjustment')),
    quantity INTEGER NOT NULL,
    user TEXT NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
);

-- 11. House Routine & Timetable Events
CREATE TABLE IF NOT EXISTS timetable_events (
    id TEXT PRIMARY KEY,
    day TEXT NOT NULL CHECK(day IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
    time_slot TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    facilitator TEXT NOT NULL,
    location TEXT NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 12. Billing, Invoices & Payment Collections (TZS)
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
    status TEXT DEFAULT 'Paid' CHECK(status IN ('Paid', 'Partial', 'Pending', 'Overdue')),
    payment_method TEXT DEFAULT 'M-Pesa' CHECK(payment_method IN ('Cash', 'M-Pesa', 'Tigo Pesa', 'Airtel Money', 'HaloPesa', 'Bank Transfer')),
    reference_no TEXT,
    date DATE DEFAULT (DATE('now')),
    due_date DATE,
    recorded_by TEXT,
    notes TEXT,
    installments_json TEXT DEFAULT '[]',
    receipt_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL
);

-- 13. System Reminders & Task Alerts
CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    patient_id TEXT,
    patient_name TEXT,
    due_time TEXT,
    priority TEXT DEFAULT 'Medium' CHECK(priority IN ('Low', 'Medium', 'High', 'Urgent')),
    status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Completed', 'Dismissed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 14. Activity Audit Trail Log
CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT
);

-- 15. Facility Operational Settings & Branding Configuration
CREATE TABLE IF NOT EXISTS facility_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Indexes for Fast Query Performance on Cloudflare D1 Edge
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_patients_stage ON patients(stage);
CREATE INDEX IF NOT EXISTS idx_medication_logs_patient ON medication_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_medication_logs_status ON medication_logs(status);
CREATE INDEX IF NOT EXISTS idx_payments_patient ON payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_number);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_inventory_code ON inventory_items(code);

-- ============================================================================
-- Default Production Initial Seed Data
-- ============================================================================

-- Seed Administrator User with Full Privileges (including Payments)
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

-- Seed Facility Profile in TZS
INSERT OR REPLACE INTO facility_settings (setting_key, setting_value)
VALUES 
    ('facility_name', 'SerenityCare Sober House & Recovery Center'),
    ('license_number', 'SH-84920-CLINICAL'),
    ('address', '742 Hope Valley Road, Building B, Austin, TX 78701'),
    ('phone', '+1 (800) 555-7623'),
    ('email', 'admissions@serenitycare.org'),
    ('director', 'Dr. Evelyn Vance, MD, FASAM'),
    ('currency', 'TZS'),
    ('total_beds', '32');
