-- SerenityCare Cloudflare D1 Relational SQLite Database Schema
-- Ready for: wrangler d1 execute serenitycare-db --file=./cloudflare/schema.sql

-- 1. Staff & Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'doctor', 'nurse', 'counselor')),
    department TEXT,
    phone TEXT,
    status TEXT DEFAULT 'Active',
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Patients / Residents Registry
CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
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
    sobriety_days INTEGER DEFAULT 1,
    graduation_qualified INTEGER DEFAULT 0, -- 0 = false, 1 = true
    graduation_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    diagnoses_json TEXT, -- JSON array of strings
    allergies_json TEXT, -- JSON array of strings
    clinical_notes TEXT,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- 5. Daily Vitals Signs & Drug Screenings
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
    times_json TEXT NOT NULL, -- JSON array, e.g. ["08:00", "20:00"]
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
    prescription_id TEXT NOT NULL,
    med_name TEXT NOT NULL,
    scheduled_time TEXT NOT NULL,
    status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Administered', 'Refused', 'Missed')),
    administered_at DATETIME,
    nurse_name TEXT,
    notes TEXT,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE
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
    controlled INTEGER DEFAULT 0
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
    notes TEXT
);

-- 12. Facility Operational Settings & Branding
CREATE TABLE IF NOT EXISTS facility_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 13. Facility Rooms Management
CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    room_number TEXT UNIQUE NOT NULL,
    name TEXT,
    floor TEXT DEFAULT '1st Floor',
    type TEXT DEFAULT 'Double' CHECK(type IN ('Single', 'Double', 'Ward', 'Detox', 'Intensive')),
    capacity INTEGER NOT NULL DEFAULT 2,
    status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Maintenance', 'Inactive')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 14. Facility Beds Management & Dynamic Allocation
CREATE TABLE IF NOT EXISTS beds (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    bed_number TEXT NOT NULL,
    type TEXT DEFAULT 'Standard' CHECK(type IN ('Standard', 'Medical', 'Detox', 'Orthopedic')),
    status TEXT DEFAULT 'Available' CHECK(status IN ('Available', 'Occupied', 'Maintenance', 'Reserved')),
    patient_id TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL
);

-- 15. Resident & Addict Admission Fees Ledger
CREATE TABLE IF NOT EXISTS resident_fees (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL UNIQUE,
    total_fee REAL NOT NULL DEFAULT 0.00,
    currency TEXT DEFAULT 'TZS',
    payment_plan TEXT DEFAULT 'Installments' CHECK(payment_plan IN ('Full Payment', 'Installments')),
    total_installments INTEGER DEFAULT 1,
    frequency TEXT DEFAULT 'Monthly' CHECK(frequency IN ('Weekly', 'Bi-weekly', 'Monthly', 'Custom')),
    initial_deposit REAL DEFAULT 0.00,
    amount_paid REAL DEFAULT 0.00,
    remaining_balance REAL DEFAULT 0.00,
    payment_method TEXT,
    reference_no TEXT,
    status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Partially Paid', 'Fully Paid', 'Overdue')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- 16. Installment Payment Schedule & Transactions
CREATE TABLE IF NOT EXISTS installment_payments (
    id TEXT PRIMARY KEY,
    resident_fee_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    installment_number INTEGER NOT NULL,
    amount REAL NOT NULL,
    due_date DATE NOT NULL,
    paid_date DATE,
    payment_method TEXT,
    reference_no TEXT,
    status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Paid', 'Overdue', 'Waived')),
    recorded_by TEXT,
    receipt_url TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (resident_fee_id) REFERENCES resident_fees(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

