/**
 * SerenityCare Cloudflare Worker / Pages API Router
 * 
 * Provides serverless edge execution with:
 * - Cloudflare Workers KV (`env.SOBBER_KV` or `env.KV`)
 * - Cloudflare D1 SQL Relational Database (`env.DB`) [optional]
 * - Cloudflare R2 Object Storage for Resident Photos & PDF Dossiers (`env.BUCKET`) [optional]
 */

function isAuthorized(request, env) {
  const secret = env.ADMIN_SECRET || env.AUTH_SECRET || env.SOBBER_ADMIN_SECRET;
  if (!secret) return true; // Backward compatibility if no secret configured in Cloudflare environment
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  return token === secret.trim();
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Edge Cache Bypassing & CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Cache-Control, Pragma',
      'Access-Control-Max-Age': '0',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store',
      'CDN-Cache-Control': 'no-store',
      'Cloudflare-CDN-Cache-Control': 'no-store'
    };

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Protect write operations with Bearer token authentication if ADMIN_SECRET is configured
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      if (!isAuthorized(request, env)) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Unauthorized: Invalid or missing Bearer token in Authorization header' 
        }), { status: 401, headers: corsHeaders });
      }
    }

    const kv = env.SOBBER_KV || env.MY_KV_NAMESPACE || env.KV;

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
            '/api/content',
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

      // 2. /api/content (Global Content & KV Submission)
      if (path === '/api/content') {
        if (method === 'GET') {
          if (!kv) return new Response(JSON.stringify({ online: false, message: 'KV namespace not bound' }), { headers: corsHeaders });
          let rawData = await kv.get('site_data', { type: 'text', cacheTtl: 0 });
          if (!rawData) {
            rawData = await kv.get('sobber_content', { type: 'text', cacheTtl: 0 });
          }
          if (!rawData) {
            rawData = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
          }
          let parsed = {};
          if (rawData) {
            try { parsed = JSON.parse(rawData); } catch { parsed = { raw: rawData }; }
          }
          return new Response(JSON.stringify(parsed), { headers: corsHeaders });
        }
        if (method === 'POST') {
          if (!kv) return new Response(JSON.stringify({ success: false, error: 'KV binding missing (bind SOBBER_KV, MY_KV_NAMESPACE, or KV)' }), { status: 500, headers: corsHeaders });
          const newData = await request.json();
          const timestamp = new Date().toISOString();
          const version = Date.now();

          if (newData && typeof newData === 'object' && !Array.isArray(newData)) {
            newData.lastUpdated = timestamp;
            newData.contentVersion = version;
          }

          const stringified = JSON.stringify(newData);
          await kv.put('site_data', stringified);
          await kv.put('sobber_content', stringified);

          if (newData && typeof newData === 'object') {
            if (Array.isArray(newData.users) || Array.isArray(newData.patients)) {
              await kv.put('sobber_state', JSON.stringify(newData));
              if (Array.isArray(newData.users)) await kv.put('sobber_users', JSON.stringify(newData.users));
              if (Array.isArray(newData.patients)) await kv.put('sobber_patients', JSON.stringify(newData.patients));
              if (Array.isArray(newData.medicationLogs)) await kv.put('sobber_medications', JSON.stringify(newData.medicationLogs));
              if (Array.isArray(newData.inventory)) await kv.put('sobber_inventory', JSON.stringify(newData.inventory));
              if (Array.isArray(newData.timetable)) await kv.put('sobber_timetable', JSON.stringify(newData.timetable));
            }
          }

          return new Response(JSON.stringify({
            success: true,
            message: 'Updated globally in KV',
            timestamp,
            version,
            data: newData
          }), { headers: corsHeaders });
        }
      }

      // 3. /api/sync (Global SerenityCare Sober House State Replication)
      if (path === '/api/sync') {
        if (method === 'GET') {
          if (!kv) {
            return new Response(JSON.stringify({ online: false, message: 'KV namespace not bound' }), { headers: corsHeaders });
          }
          let stateData = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
          if (!stateData) {
            stateData = await kv.get('serenitycare_state', { type: 'text', cacheTtl: 0 });
          }
          return new Response(stateData || '{}', { headers: corsHeaders });
        }
        if (method === 'POST') {
          if (!kv) {
            return new Response(JSON.stringify({ success: false, error: 'KV binding missing (bind SOBBER_KV or KV)' }), { status: 500, headers: corsHeaders });
          }
          const stateObj = await request.json();
          stateObj.lastSyncedAt = new Date().toISOString();
          stateObj.stateVersion = Date.now();
          await kv.put('sobber_state', JSON.stringify(stateObj));

          // Mirror collections
          if (Array.isArray(stateObj.users)) await kv.put('sobber_users', JSON.stringify(stateObj.users));
          if (Array.isArray(stateObj.patients)) await kv.put('sobber_patients', JSON.stringify(stateObj.patients));
          if (Array.isArray(stateObj.medicationLogs)) await kv.put('sobber_medications', JSON.stringify(stateObj.medicationLogs));
          if (Array.isArray(stateObj.inventory)) await kv.put('sobber_inventory', JSON.stringify(stateObj.inventory));
          if (Array.isArray(stateObj.timetable)) await kv.put('sobber_timetable', JSON.stringify(stateObj.timetable));

          return new Response(JSON.stringify({ 
            success: true, 
            timestamp: stateObj.lastSyncedAt,
            version: stateObj.stateVersion,
            state: stateObj
          }), { headers: corsHeaders });
        }
      }

      // 3. /api/users (Staff & RBAC global sync)
      if (path === '/api/users') {
        if (method === 'GET') {
          if (!kv) return new Response(JSON.stringify([]), { headers: corsHeaders });
          let usersData = await kv.get('sobber_users', { type: 'text', cacheTtl: 0 });
          if (!usersData) usersData = await kv.get('serenitycare_users', { type: 'text', cacheTtl: 0 });
          return new Response(usersData || '[]', { headers: corsHeaders });
        }
        if (method === 'POST') {
          if (!kv) return new Response(JSON.stringify({ error: 'KV missing' }), { status: 500, headers: corsHeaders });
          const userPayload = await request.json();
          let currentUsers = [];
          const existing = await kv.get('sobber_users', { type: 'text', cacheTtl: 0 });
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
          const rawState = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
          let version = Date.now();
          if (rawState) {
            try {
              const stateObj = JSON.parse(rawState);
              stateObj.users = currentUsers;
              stateObj.lastSyncedAt = new Date().toISOString();
              stateObj.stateVersion = Date.now();
              version = stateObj.stateVersion;
              await kv.put('sobber_state', JSON.stringify(stateObj));
            } catch {}
          }

          return new Response(JSON.stringify({ success: true, count: currentUsers.length, users: currentUsers, version }), { headers: corsHeaders });
        }
        if (method === 'DELETE') {
          if (!kv) return new Response(JSON.stringify({ error: 'KV missing' }), { status: 500, headers: corsHeaders });
          const id = url.searchParams.get('id');
          if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: corsHeaders });
          let currentUsers = [];
          const existing = await kv.get('sobber_users', { type: 'text', cacheTtl: 0 });
          if (existing) {
            try { currentUsers = JSON.parse(existing); } catch {}
          }
          currentUsers = currentUsers.filter(u => u.id !== id);
          await kv.put('sobber_users', JSON.stringify(currentUsers));

          // Sync with sobber_state
          const rawState = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
          let version = Date.now();
          if (rawState) {
            try {
              const stateObj = JSON.parse(rawState);
              stateObj.users = currentUsers;
              stateObj.lastSyncedAt = new Date().toISOString();
              stateObj.stateVersion = Date.now();
              version = stateObj.stateVersion;
              await kv.put('sobber_state', JSON.stringify(stateObj));
            } catch {}
          }

          return new Response(JSON.stringify({ success: true, deletedId: id, version }), { headers: corsHeaders });
        }
      }

      // 4. /api/patients (Resident Registry)
      if (path === '/api/patients') {
        if (method === 'GET') {
          if (!kv) return new Response(JSON.stringify([]), { headers: corsHeaders });
          const data = await kv.get('sobber_patients', { type: 'text', cacheTtl: 0 });
          return new Response(data || '[]', { headers: corsHeaders });
        }
        if (method === 'POST') {
          if (!kv) return new Response(JSON.stringify({ error: 'KV missing' }), { status: 500, headers: corsHeaders });
          const payload = await request.json();
          let patients = [];
          const existing = await kv.get('sobber_patients', { type: 'text', cacheTtl: 0 });
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

          const rawState = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
          let version = Date.now();
          if (rawState) {
            try {
              const stateObj = JSON.parse(rawState);
              stateObj.patients = patients;
              stateObj.lastSyncedAt = new Date().toISOString();
              stateObj.stateVersion = Date.now();
              version = stateObj.stateVersion;
              await kv.put('sobber_state', JSON.stringify(stateObj));
            } catch {}
          }

          return new Response(JSON.stringify({ success: true, count: patients.length, patients, version }), { headers: corsHeaders });
        }
        if (method === 'DELETE') {
          if (!kv) return new Response(JSON.stringify({ error: 'KV missing' }), { status: 500, headers: corsHeaders });
          const id = url.searchParams.get('id');
          if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: corsHeaders });
          let list = [];
          const existing = await kv.get('sobber_patients', { type: 'text', cacheTtl: 0 });
          if (existing) {
            try { list = JSON.parse(existing); } catch {}
          }
          list = list.filter(p => p.id !== id);
          await kv.put('sobber_patients', JSON.stringify(list));

          const rawState = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
          let version = Date.now();
          if (rawState) {
            try {
              const stateObj = JSON.parse(rawState);
              stateObj.patients = list;
              stateObj.lastSyncedAt = new Date().toISOString();
              stateObj.stateVersion = Date.now();
              version = stateObj.stateVersion;
              await kv.put('sobber_state', JSON.stringify(stateObj));
            } catch {}
          }

          return new Response(JSON.stringify({ success: true, deletedId: id, version }), { headers: corsHeaders });
        }
      }

      // 5. /api/medications (MAR logs)
      if (path === '/api/medications') {
        if (method === 'GET') {
          if (!kv) return new Response(JSON.stringify([]), { headers: corsHeaders });
          const data = await kv.get('sobber_medications', { type: 'text', cacheTtl: 0 });
          return new Response(data || '[]', { headers: corsHeaders });
        }
        if (method === 'POST') {
          if (!kv) return new Response(JSON.stringify({ error: 'KV missing' }), { status: 500, headers: corsHeaders });
          const payload = await request.json();
          let logs = [];
          const existing = await kv.get('sobber_medications', { type: 'text', cacheTtl: 0 });
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

          const rawState = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
          let version = Date.now();
          if (rawState) {
            try {
              const stateObj = JSON.parse(rawState);
              stateObj.medicationLogs = logs;
              stateObj.lastSyncedAt = new Date().toISOString();
              stateObj.stateVersion = Date.now();
              version = stateObj.stateVersion;
              await kv.put('sobber_state', JSON.stringify(stateObj));
            } catch {}
          }

          return new Response(JSON.stringify({ success: true, count: logs.length, data: logs, version }), { headers: corsHeaders });
        }
      }

      // 6. /api/inventory
      if (path === '/api/inventory') {
        if (method === 'GET') {
          if (!kv) return new Response(JSON.stringify([]), { headers: corsHeaders });
          const data = await kv.get('sobber_inventory', { type: 'text', cacheTtl: 0 });
          return new Response(data || '[]', { headers: corsHeaders });
        }
        if (method === 'POST') {
          if (!kv) return new Response(JSON.stringify({ error: 'KV missing' }), { status: 500, headers: corsHeaders });
          const payload = await request.json();
          let items = [];
          const existing = await kv.get('sobber_inventory', { type: 'text', cacheTtl: 0 });
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

          const rawState = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
          let version = Date.now();
          if (rawState) {
            try {
              const stateObj = JSON.parse(rawState);
              stateObj.inventory = items;
              stateObj.lastSyncedAt = new Date().toISOString();
              stateObj.stateVersion = Date.now();
              version = stateObj.stateVersion;
              await kv.put('sobber_state', JSON.stringify(stateObj));
            } catch {}
          }

          return new Response(JSON.stringify({ success: true, count: items.length, data: items, version }), { headers: corsHeaders });
        }
      }

      // 7. /api/timetable
      if (path === '/api/timetable') {
        if (method === 'GET') {
          if (!kv) return new Response(JSON.stringify([]), { headers: corsHeaders });
          const data = await kv.get('sobber_timetable', { type: 'text', cacheTtl: 0 });
          return new Response(data || '[]', { headers: corsHeaders });
        }
        if (method === 'POST') {
          if (!kv) return new Response(JSON.stringify({ error: 'KV missing' }), { status: 500, headers: corsHeaders });
          const payload = await request.json();
          await kv.put('sobber_timetable', JSON.stringify(payload));

          const rawState = await kv.get('sobber_state', { type: 'text', cacheTtl: 0 });
          let version = Date.now();
          if (rawState) {
            try {
              const stateObj = JSON.parse(rawState);
              stateObj.timetable = Array.isArray(payload) ? payload : [];
              stateObj.lastSyncedAt = new Date().toISOString();
              stateObj.stateVersion = Date.now();
              version = stateObj.stateVersion;
              await kv.put('sobber_state', JSON.stringify(stateObj));
            } catch {}
          }

          return new Response(JSON.stringify({ success: true, version }), { headers: corsHeaders });
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
