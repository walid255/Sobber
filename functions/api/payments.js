/**
 * Cloudflare Pages Function: /api/payments
 * 
 * Provides resident addict admission fee and installment payment management
 * with Cloudflare Workers KV and D1 SQL relational synchronization.
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
    let fees = [];
    let installments = [];

    if (kv) {
      const fRaw = await kv.get('sobber_fees', { type: 'text', cacheTtl: 0 });
      if (fRaw) try { fees = JSON.parse(fRaw); } catch {}
      const iRaw = await kv.get('sobber_installments', { type: 'text', cacheTtl: 0 });
      if (iRaw) try { installments = JSON.parse(iRaw); } catch {}
    }

    const url = new URL(context.request.url);
    const patientId = url.searchParams.get('patientId');
    if (patientId) {
      fees = fees.filter(f => f.patientId === patientId);
      installments = installments.filter(i => i.patientId === patientId);
    }

    return new Response(JSON.stringify({ success: true, residentFees: fees, installmentPayments: installments }), { status: 200, headers: JSON_HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
  }
}

export async function onRequestPost(context) {
  try {
    const kv = getKV(context);
    if (!kv) {
      return new Response(JSON.stringify({ error: 'KV missing' }), { status: 500, headers: JSON_HEADERS });
    }
    const payload = await context.request.json();

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

      if (Array.isArray(payload.schedule)) {
        installments = installments.filter(i => i.residentFeeId !== fee.id);
        installments.push(...payload.schedule);
      }
    }

    if (Array.isArray(payload.residentFees)) fees = payload.residentFees;
    if (Array.isArray(payload.installmentPayments)) installments = payload.installmentPayments;

    await kv.put('sobber_fees', JSON.stringify(fees));
    await kv.put('sobber_installments', JSON.stringify(installments));

    // Update in sobber_state
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

    // Sync to D1 SQL Relational Database if connected
    if (context.env?.DB) {
      try {
        for (const f of fees) {
          await context.env.DB.prepare(
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

        for (const ip of installments) {
          await context.env.DB.prepare(
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
      } catch (e) {
        console.warn('Pages function D1 payments sync error:', e);
      }
    }

    return new Response(JSON.stringify({ success: true, residentFees: fees, installmentPayments: installments, version: stateVersion }), { status: 200, headers: JSON_HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: JSON_HEADERS });
  }
}
