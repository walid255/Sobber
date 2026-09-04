/**
 * SerenityCare Cloudflare Worker / Pages Functions API Router
 * 
 * Provides serverless edge execution with:
 * - Cloudflare D1 SQL Relational Database (`env.DB`)
 * - Cloudflare KV Namespace for Fast Sessions & Caching (`env.KV`)
 * - Cloudflare R2 Object Storage for Resident Photos & PDF Dossiers (`env.BUCKET`)
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json'
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 1. Health & Sync Ping
      if (path === '/api/health' || path === '/api/sync') {
        return new Response(JSON.stringify({
          status: 'online',
          edgeLocation: request.cf?.colo || 'LocalEdge',
          d1Connected: Boolean(env.DB),
          kvConnected: Boolean(env.KV),
          r2Connected: Boolean(env.BUCKET),
          timestamp: new Date().toISOString()
        }), { headers: corsHeaders });
      }

      // 1.1 POST /api/login (Authentication)
      if (path === '/api/login' && method === 'POST') {
        const { email, password } = await request.json();
        if (!env.DB) {
          return new Response(JSON.stringify({ error: 'D1 binding missing' }), { status: 500, headers: corsHeaders });
        }
        const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email.toLowerCase().trim()).first();
        if (!user) {
          return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401, headers: corsHeaders });
        }
        const token = crypto.randomUUID();
        if (env.KV) {
          await env.KV.put(`session:${token}`, JSON.stringify(user), { expirationTtl: 86400 });
        }
        return new Response(JSON.stringify({ success: true, token, user }), { headers: corsHeaders });
      }

      // 2. GET /api/patients
      if (path === '/api/patients' && method === 'GET') {
        if (!env.DB) {
          return new Response(JSON.stringify({ error: 'D1 binding missing' }), { status: 500, headers: corsHeaders });
        }
        const { results } = await env.DB.prepare('SELECT * FROM patients ORDER BY created_at DESC').all();
        return new Response(JSON.stringify(results), { headers: corsHeaders });
      }

      // 3. POST /api/patients (Intake new resident)
      if (path === '/api/patients' && method === 'POST') {
        const body = await request.json();
        const id = 'PAT-' + Date.now().toString(36).toUpperCase();

        await env.DB.prepare(`
          INSERT INTO patients (id, name, dob, age, gender, blood_group, phone, email, photo_url, room_number, bed_number, stage, sobriety_days)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id, body.name, body.dob, body.age, body.gender, body.bloodGroup, body.phone, body.email,
          body.photo, body.roomNumber, body.bedNumber, body.stage || 'Inpatient Recovery', body.sobrietyDays || 1
        ).run();

        // Also insert next of kin if provided
        if (body.nextOfKin) {
          await env.DB.prepare(`
            INSERT INTO next_of_kin (patient_id, name, relationship, phone, address)
            VALUES (?, ?, ?, ?, ?)
          `).bind(id, body.nextOfKin.name, body.nextOfKin.relationship, body.nextOfKin.phone, body.nextOfKin.address).run();
        }

        // Cache update in KV
        if (env.KV) {
          await env.KV.put(`patient:${id}`, JSON.stringify(body));
        }

        return new Response(JSON.stringify({ success: true, id }), { headers: corsHeaders });
      }

      // 4. POST /api/patients/batch (Batch CSV Import)
      if (path === '/api/patients/batch' && method === 'POST') {
        const batch = await request.json();
        const inserted = [];

        for (const item of batch) {
          const id = 'PAT-' + (100 + Math.floor(Math.random() * 9000));
          await env.DB.prepare(`
            INSERT INTO patients (id, name, dob, age, gender, blood_group, phone, email, photo_url, room_number, bed_number, stage, sobriety_days)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            id, item.name, item.dob, item.age || 30, item.gender || 'Male', item.bloodGroup || 'O+',
            item.phone || '', item.email || '', item.photo || '', item.roomNumber || 'Room 101',
            item.bedNumber || 'Bed A', item.stage || 'Inpatient Recovery', item.sobrietyDays || 1
          ).run();
          inserted.push(id);
        }

        return new Response(JSON.stringify({ success: true, count: inserted.length, ids: inserted }), { headers: corsHeaders });
      }

      // 5. GET /api/mar & POST /api/mar/administer
      if (path === '/api/mar' && method === 'GET') {
        const { results } = await env.DB.prepare('SELECT * FROM medication_logs ORDER BY scheduled_time ASC').all();
        return new Response(JSON.stringify(results), { headers: corsHeaders });
      }

      if (path === '/api/mar/administer' && method === 'POST') {
        const { logId, status, nurseName, notes } = await request.json();
        await env.DB.prepare(`
          UPDATE medication_logs 
          SET status = ?, administered_at = CURRENT_TIMESTAMP, nurse_name = ?, notes = ?
          WHERE id = ?
        `).bind(status, nurseName, notes, logId).run();

        return new Response(JSON.stringify({ success: true, logId, status }), { headers: corsHeaders });
      }

      // 6. R2 Storage Upload (POST /api/upload)
      if (path === '/api/upload' && method === 'POST') {
        if (!env.BUCKET) {
          return new Response(JSON.stringify({ error: 'R2 bucket not bound' }), { status: 500, headers: corsHeaders });
        }
        const key = `uploads/${Date.now()}-${crypto.randomUUID()}`;
        const data = await request.arrayBuffer();
        await env.BUCKET.put(key, data, {
          httpMetadata: { contentType: request.headers.get('content-type') || 'application/octet-stream' }
        });

        const fileUrl = `${url.origin}/api/files/${key}`;
        return new Response(JSON.stringify({ success: true, key, url: fileUrl }), { headers: corsHeaders });
      }

      // 7. GET /api/inventory
      if (path === '/api/inventory' && method === 'GET') {
        const { results } = await env.DB.prepare('SELECT * FROM inventory_items ORDER BY category ASC').all();
        return new Response(JSON.stringify(results), { headers: corsHeaders });
      }

      // 8. Default 404 for unknown API routes
      return new Response(JSON.stringify({ error: 'API endpoint not found', path }), { status: 404, headers: corsHeaders });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { status: 500, headers: corsHeaders });
    }
  }
};
