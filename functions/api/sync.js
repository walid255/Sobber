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

async function loadFromD1(db) {
  if (!db) return null;
  try {
    const usersRes = await db.prepare("SELECT * FROM users ORDER BY created_at ASC").all();
    const patRes = await db.prepare("SELECT * FROM patients ORDER BY created_at DESC").all();
    const payRes = await db.prepare("SELECT * FROM payments ORDER BY created_at DESC").all();

    const users = (usersRes.results || []).map(u => ({
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

    const patients = (patRes.results || []).map(p => {
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

    const payments = (payRes.results || []).map(p => ({
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

    if (users.length > 0 || patients.length > 0 || payments.length > 0) {
      return {
        ...SEED_SOBBER_STATE,
        users,
        patients,
        payments,
        stateVersion: Date.now(),
        lastSyncedAt: new Date().toISOString()
      };
    }
    return null;
  } catch (err) {
    console.warn('Pages D1 query error:', err);
    return null;
  }
}

async function saveToD1(db, state) {
  if (!db || !state) return false;
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
    if (statements.length > 0) {
      await db.batch(statements);
    }
    return true;
  } catch (err) {
    console.error('Pages D1 save error:', err);
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
      const d1Data = await loadFromD1(db);
      if (d1Data) {
        if (kv) {
          context.waitUntil(kv.put('sobber_state', JSON.stringify(d1Data)));
        }
        return new Response(JSON.stringify(d1Data), { headers: JSON_HEADERS });
      }
    }

    // 2. Try KV
    if (kv) {
      let raw = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
      if (!raw) raw = await kv.get('serenitycare_state', { type: 'text', cacheTtl: 0 });
      if (raw) {
        return new Response(raw, { headers: JSON_HEADERS });
      }
    }

    return new Response(JSON.stringify(SEED_SOBBER_STATE), { headers: JSON_HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
  }
}

export async function onRequestPost(context) {
  try {
    if (!isAuthorized(context)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS });
    }

    const db = context.env?.DB;
    const kv = getKV(context);
    const stateObj = await context.request.json();

    stateObj.lastSyncedAt = new Date().toISOString();
    stateObj.stateVersion = Date.now();

    if (db) {
      await saveToD1(db, stateObj);
    }

    if (kv) {
      const str = JSON.stringify(stateObj);
      await kv.put('sobber_state', str);
      if (Array.isArray(stateObj.users)) await kv.put('sobber_users', JSON.stringify(stateObj.users));
      if (Array.isArray(stateObj.patients)) await kv.put('sobber_patients', JSON.stringify(stateObj.patients));
      if (Array.isArray(stateObj.payments)) await kv.put('sobber_payments', JSON.stringify(stateObj.payments));
    }

    return new Response(JSON.stringify({
      success: true,
      timestamp: stateObj.lastSyncedAt,
      version: stateObj.stateVersion
    }), { headers: JSON_HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
  }
}
