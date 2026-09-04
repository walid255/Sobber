/**
 * SerenityCare Cloudflare Worker / Pages API Router
 * 
 * Provides serverless edge execution with:
 * - Cloudflare Workers KV (`env.SOBBER_KV` or `env.KV`)
 * - Cloudflare D1 SQL Relational Database (`env.DB`) [optional]
 * - Cloudflare R2 Object Storage for Resident Photos & PDF Dossiers (`env.BUCKET`) [optional]
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
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const kv = env.SOBBER_KV || env.KV;

    try {
      // 1. Health Ping
      if (path === '/api/health') {
        return new Response(JSON.stringify({
          status: 'online',
          system: 'SerenityCare Recovery Management System',
          edgeLocation: request.cf?.colo || 'LocalEdge',
          kvConnected: Boolean(kv),
          d1Connected: Boolean(env.DB),
          r2Connected: Boolean(env.BUCKET),
          timestamp: new Date().toISOString(),
          endpoints: [
            '/api/sync',
            '/api/users',
            '/api/patients',
            '/api/medications',
            '/api/inventory',
            '/api/timetable',
            '/api/health'
          ]
        }), { headers: corsHeaders });
      }

      // 2. /api/sync (Global SerenityCare Sober House State Replication)
      if (path === '/api/sync') {
        if (method === 'GET') {
          if (!kv) {
            return new Response(JSON.stringify({ online: false, message: 'KV namespace not bound' }), { headers: corsHeaders });
          }
          let stateData = await kv.get('sobber_state');
          if (!stateData) {
            stateData = await kv.get('serenitycare_state');
          }
          return new Response(stateData || '{}', { headers: corsHeaders });
        }
        if (method === 'POST') {
          if (!kv) {
            return new Response(JSON.stringify({ success: false, error: 'KV binding missing (bind SOBBER_KV or KV)' }), { status: 500, headers: corsHeaders });
          }
          const stateObj = await request.json();
          stateObj.lastSyncedAt = new Date().toISOString();
          await kv.put('sobber_state', JSON.stringify(stateObj));

          // Mirror collections
          if (Array.isArray(stateObj.users)) await kv.put('sobber_users', JSON.stringify(stateObj.users));
          if (Array.isArray(stateObj.patients)) await kv.put('sobber_patients', JSON.stringify(stateObj.patients));
          if (Array.isArray(stateObj.medicationLogs)) await kv.put('sobber_medications', JSON.stringify(stateObj.medicationLogs));
          if (Array.isArray(stateObj.inventory)) await kv.put('sobber_inventory', JSON.stringify(stateObj.inventory));
          if (Array.isArray(stateObj.timetable)) await kv.put('sobber_timetable', JSON.stringify(stateObj.timetable));

          return new Response(JSON.stringify({ success: true, timestamp: stateObj.lastSyncedAt }), { headers: corsHeaders });
        }
      }

      // 3. /api/users (Staff & RBAC global sync)
      if (path === '/api/users') {
        if (method === 'GET') {
          if (!kv) return new Response(JSON.stringify([]), { headers: corsHeaders });
          let usersData = await kv.get('sobber_users');
          if (!usersData) usersData = await kv.get('serenitycare_users');
          return new Response(usersData || '[]', { headers: corsHeaders });
        }
        if (method === 'POST') {
          if (!kv) return new Response(JSON.stringify({ error: 'KV missing' }), { status: 500, headers: corsHeaders });
          const userPayload = await request.json();
          let currentUsers = [];
          const existing = await kv.get('sobber_users');
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

          // Sync with sobber_state
          const rawState = await kv.get('sobber_state');
          if (rawState) {
            try {
              const stateObj = JSON.parse(rawState);
              stateObj.users = currentUsers;
              stateObj.lastSyncedAt = new Date().toISOString();
              await kv.put('sobber_state', JSON.stringify(stateObj));
            } catch {}
          }

          return new Response(JSON.stringify({ success: true, count: currentUsers.length, users: currentUsers }), { headers: corsHeaders });
        }
        if (method === 'DELETE') {
          if (!kv) return new Response(JSON.stringify({ error: 'KV missing' }), { status: 500, headers: corsHeaders });
          const id = url.searchParams.get('id');
          if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: corsHeaders });
          let currentUsers = [];
          const existing = await kv.get('sobber_users');
          if (existing) {
            try { currentUsers = JSON.parse(existing); } catch {}
          }
          currentUsers = currentUsers.filter(u => u.id !== id);
          await kv.put('sobber_users', JSON.stringify(currentUsers));

          // Sync with sobber_state
          const rawState = await kv.get('sobber_state');
          if (rawState) {
            try {
              const stateObj = JSON.parse(rawState);
              stateObj.users = currentUsers;
              stateObj.lastSyncedAt = new Date().toISOString();
              await kv.put('sobber_state', JSON.stringify(stateObj));
            } catch {}
          }

          return new Response(JSON.stringify({ success: true, deletedId: id }), { headers: corsHeaders });
        }
      }

      // 4. /api/patients (Resident Registry)
      if (path === '/api/patients') {
        if (method === 'GET') {
          if (!kv) return new Response(JSON.stringify([]), { headers: corsHeaders });
          const data = await kv.get('sobber_patients');
          return new Response(data || '[]', { headers: corsHeaders });
        }
        if (method === 'POST') {
          if (!kv) return new Response(JSON.stringify({ error: 'KV missing' }), { status: 500, headers: corsHeaders });
          const payload = await request.json();
          let patients = [];
          const existing = await kv.get('sobber_patients');
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

          const rawState = await kv.get('sobber_state');
          if (rawState) {
            try {
              const stateObj = JSON.parse(rawState);
              stateObj.patients = patients;
              stateObj.lastSyncedAt = new Date().toISOString();
              await kv.put('sobber_state', JSON.stringify(stateObj));
            } catch {}
          }

          return new Response(JSON.stringify({ success: true, count: patients.length, patients }), { headers: corsHeaders });
        }
      }

      // 5. /api/medications (MAR logs)
      if (path === '/api/medications') {
        if (method === 'GET') {
          if (!kv) return new Response(JSON.stringify([]), { headers: corsHeaders });
          const data = await kv.get('sobber_medications');
          return new Response(data || '[]', { headers: corsHeaders });
        }
        if (method === 'POST') {
          if (!kv) return new Response(JSON.stringify({ error: 'KV missing' }), { status: 500, headers: corsHeaders });
          const payload = await request.json();
          let logs = [];
          const existing = await kv.get('sobber_medications');
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

          const rawState = await kv.get('sobber_state');
          if (rawState) {
            try {
              const stateObj = JSON.parse(rawState);
              stateObj.medicationLogs = logs;
              stateObj.lastSyncedAt = new Date().toISOString();
              await kv.put('sobber_state', JSON.stringify(stateObj));
            } catch {}
          }

          return new Response(JSON.stringify({ success: true, count: logs.length, data: logs }), { headers: corsHeaders });
        }
      }

      // 6. /api/inventory
      if (path === '/api/inventory') {
        if (method === 'GET') {
          if (!kv) return new Response(JSON.stringify([]), { headers: corsHeaders });
          const data = await kv.get('sobber_inventory');
          return new Response(data || '[]', { headers: corsHeaders });
        }
        if (method === 'POST') {
          if (!kv) return new Response(JSON.stringify({ error: 'KV missing' }), { status: 500, headers: corsHeaders });
          const payload = await request.json();
          let items = [];
          const existing = await kv.get('sobber_inventory');
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

          const rawState = await kv.get('sobber_state');
          if (rawState) {
            try {
              const stateObj = JSON.parse(rawState);
              stateObj.inventory = items;
              stateObj.lastSyncedAt = new Date().toISOString();
              await kv.put('sobber_state', JSON.stringify(stateObj));
            } catch {}
          }

          return new Response(JSON.stringify({ success: true, count: items.length, data: items }), { headers: corsHeaders });
        }
      }

      // 7. /api/timetable
      if (path === '/api/timetable') {
        if (method === 'GET') {
          if (!kv) return new Response(JSON.stringify([]), { headers: corsHeaders });
          const data = await kv.get('sobber_timetable');
          return new Response(data || '[]', { headers: corsHeaders });
        }
        if (method === 'POST') {
          if (!kv) return new Response(JSON.stringify({ error: 'KV missing' }), { status: 500, headers: corsHeaders });
          const payload = await request.json();
          await kv.put('sobber_timetable', JSON.stringify(payload));

          const rawState = await kv.get('sobber_state');
          if (rawState) {
            try {
              const stateObj = JSON.parse(rawState);
              stateObj.timetable = Array.isArray(payload) ? payload : [];
              stateObj.lastSyncedAt = new Date().toISOString();
              await kv.put('sobber_state', JSON.stringify(stateObj));
            } catch {}
          }

          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }
      }

      // 8. R2 Storage Upload (POST /api/upload)
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

      // 9. Default 404 for unknown API routes
      return new Response(JSON.stringify({ error: 'API endpoint not found', path }), { status: 404, headers: corsHeaders });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { status: 500, headers: corsHeaders });
    }
  }
};
