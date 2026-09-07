/**
 * Cloudflare Pages Function: /api/payments
 * 
 * Production-grade Billing & Payments API for SerenityCare Sober House:
 * - Persists to Cloudflare D1 SQL Relational Database (`context.env.DB`)
 * - Syncs to Cloudflare Workers KV Cache (`context.env.SOBBER_KV` or `context.env.KV`)
 * - Bypasses edge cache with strict anti-caching headers
 * - Currency strictly in Tanzanian Shillings (TZS)
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

function isKV(val, key = '') {
  if (!val || typeof val !== 'object') return false;
  const upper = String(key).toUpperCase();
  if (upper === 'ASSETS' || upper === 'DB' || upper === 'BUCKET' || upper === 'CF_PAGES') return false;
  if (typeof val.fetch === 'function') return false;
  if (typeof val.prepare === 'function' || typeof val.exec === 'function') return false;
  return typeof val.get === 'function' && typeof val.put === 'function' && typeof val.list === 'function';
}

function getKV(context) {
  const env = context?.env;
  if (!env || typeof env !== 'object') return null;

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
    const url = new URL(context.request.url);
    const patientId = url.searchParams.get('patientId');
    const paymentId = url.searchParams.get('id');

    let list = [];

    // 1. Query Cloudflare D1 SQL Database if bound
    if (db && typeof db.prepare === 'function') {
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
        console.warn('D1 payments read notice:', e.message);
      }
    }

    // 2. Fallback to Cloudflare KV Cache
    if (list.length === 0 && kv) {
      let raw = await safeKvGet(kv, 'sobber_payments');
      if (raw) {
        try { list = JSON.parse(raw); } catch {}
      } else {
        const stateRaw = await safeKvGet(kv, 'sobber_state');
        if (stateRaw) {
          try {
            const parsed = JSON.parse(stateRaw);
            if (Array.isArray(parsed.payments)) {
              list = parsed.payments;
              safeKvPut(kv, 'sobber_payments', list).catch(() => {});
            }
          } catch {}
        }
      }
      if (paymentId) list = list.filter(p => p.id === paymentId);
      else if (patientId) list = list.filter(p => p.patientId === patientId);
    }

    if (!Array.isArray(list)) list = [];

    if (paymentId) {
      const match = list.find(p => p.id === paymentId);
      if (!match) {
        return new Response(JSON.stringify({ error: 'Payment not found' }), { status: 404, headers: JSON_HEADERS });
      }
      return new Response(JSON.stringify(match), { status: 200, headers: JSON_HEADERS });
    }

    return new Response(JSON.stringify(list), { status: 200, headers: JSON_HEADERS });
  } catch (err) {
    console.error('Payments GET error:', err.message);
    return new Response(JSON.stringify([]), { status: 200, headers: JSON_HEADERS });
  }
}

export async function onRequestPost(context) {
  try {
    if (!isAuthorized(context)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS });
    }

    const db = context.env?.DB;
    const kv = getKV(context);
    let payload;
    try {
      payload = await context.request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: JSON_HEADERS });
    }
    const items = Array.isArray(payload) ? payload : [payload];

    // 1. Save to D1
    if (db && typeof db.prepare === 'function') {
      try {
        const stmts = items.map(pay => {
          const instJson = JSON.stringify(pay.installments || []);
          return db.prepare(`
            INSERT OR REPLACE INTO payments (
              id, invoice_number, patient_id, patient_name, admission_number, 
              payer_name, payer_phone, category, description, total_amount, 
              amount_paid, balance, currency, status, payment_method, reference_no, 
              date, due_date, recorded_by, notes, installments_json, receipt_url, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `).bind(
            pay.id || `pay_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            pay.invoiceNumber || `INV-${Date.now()}`,
            pay.patientId || null,
            pay.patientName || 'General',
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
        if (typeof db.batch === 'function') {
          await db.batch(stmts);
        }
      } catch (e) {
        console.error('D1 payments insert error:', e.message);
      }
    }

    // 2. Persist to Cloudflare KV Cache
    let currentList = [];
    if (kv) {
      const existing = await safeKvGet(kv, 'sobber_payments');
      if (existing) {
        try { currentList = JSON.parse(existing); } catch {}
      }
      items.forEach(newItem => {
        const idx = currentList.findIndex(p => p.id === newItem.id || p.invoiceNumber === newItem.invoiceNumber);
        if (idx >= 0) currentList[idx] = { ...currentList[idx], ...newItem };
        else currentList.unshift(newItem);
      });
      await safeKvPut(kv, 'sobber_payments', currentList);

      // Sync with sobber_state
      const stateRaw = await safeKvGet(kv, 'sobber_state');
      if (stateRaw) {
        try {
          const s = JSON.parse(stateRaw);
          s.payments = currentList;
          s.lastSyncedAt = new Date().toISOString();
          s.stateVersion = Date.now();
          await safeKvPut(kv, 'sobber_state', s);
        } catch {}
      }
    }

    return new Response(JSON.stringify({
      success: true,
      count: items.length,
      version: Date.now()
    }), { status: 200, headers: JSON_HEADERS });

  } catch (err) {
    console.error('Payments POST error:', err.message);
    return new Response(JSON.stringify({ success: true, localOnly: true, warning: err.message }), { status: 200, headers: JSON_HEADERS });
  }
}

export async function onRequestDelete(context) {
  try {
    if (!isAuthorized(context)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: JSON_HEADERS });
    }

    const db = context.env?.DB;
    const kv = getKV(context);
    const url = new URL(context.request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: JSON_HEADERS });
    }

    if (db && typeof db.prepare === 'function') {
      try {
        await db.prepare("DELETE FROM payments WHERE id = ?").bind(id).run();
      } catch (e) {}
    }

    if (kv) {
      let list = [];
      const raw = await safeKvGet(kv, 'sobber_payments');
      if (raw) {
        try { list = JSON.parse(raw); } catch {}
      }
      list = list.filter(p => p.id !== id);
      await safeKvPut(kv, 'sobber_payments', list);

      const stateRaw = await safeKvGet(kv, 'sobber_state');
      if (stateRaw) {
        try {
          const s = JSON.parse(stateRaw);
          s.payments = list;
          await safeKvPut(kv, 'sobber_state', s);
        } catch {}
      }
    }

    return new Response(JSON.stringify({ success: true, deletedId: id }), { status: 200, headers: JSON_HEADERS });
  } catch (err) {
    console.error('Payments DELETE error:', err.message);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: JSON_HEADERS });
  }
}
