/**
 * Cloudflare Pages Function: /api/users
 * 
 * Provides dedicated Staff & RBAC user synchronization across browsers
 * via Cloudflare Workers KV.
 * 
 * KV Binding: SOBBER_KV (primary) or KV (fallback)
 * Storage Key: "sobber_users"
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

const JSON_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate'
};

const DEFAULT_ADMIN_USER = {
  id: 'usr_admin',
  name: 'System Administrator',
  email: 'admin@serenitycare.org',
  password: 'Admin@Serenity2026!',
  role: 'admin',
  phone: '+1 (800) 555-7623',
  department: 'Clinical Administration',
  status: 'Active',
  lastLogin: null,
  permissions: {
    dashboard: true,
    patients: true,
    medications: true,
    timetable: true,
    inventory: true,
    certificates: true,
    batch_upload: true,
    users: true,
    settings: true
  }
};

function getKV(context) {
  return context.env?.SOBBER_KV || context.env?.KV || context.env?.SERENITYCARE_KV;
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS
  });
}

export async function onRequestGet(context) {
  try {
    const kv = getKV(context);
    if (!kv) {
      return new Response(JSON.stringify([DEFAULT_ADMIN_USER]), { 
        status: 200, 
        headers: JSON_HEADERS 
      });
    }

    let raw = await kv.get('sobber_users');
    if (!raw) {
      // Check legacy key
      raw = await kv.get('serenitycare_users');
    }

    let users = [];
    if (raw) {
      try { 
        users = JSON.parse(raw); 
      } catch {}
    }

    // If still empty, attempt to read from sobber_state
    if (!users || users.length === 0) {
      const stateRaw = await kv.get('sobber_state');
      if (stateRaw) {
        try {
          const parsedState = JSON.parse(stateRaw);
          if (Array.isArray(parsedState.users) && parsedState.users.length > 0) {
            users = parsedState.users;
            await kv.put('sobber_users', JSON.stringify(users));
          }
        } catch {}
      }
    }

    if (!Array.isArray(users) || users.length === 0) {
      users = [DEFAULT_ADMIN_USER];
      await kv.put('sobber_users', JSON.stringify(users));
    }

    return new Response(JSON.stringify(users), {
      status: 200,
      headers: JSON_HEADERS
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: JSON_HEADERS 
    });
  }
}

export async function onRequestPost(context) {
  try {
    const kv = getKV(context);
    if (!kv) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Cloudflare KV namespace binding missing (bind SOBBER_KV or KV)' 
      }), { 
        status: 500, 
        headers: JSON_HEADERS 
      });
    }

    let payload;
    try {
      payload = await context.request.json();
    } catch {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid JSON payload' 
      }), { 
        status: 400, 
        headers: JSON_HEADERS 
      });
    }

    if (!payload) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Empty payload' 
      }), { 
        status: 400, 
        headers: JSON_HEADERS 
      });
    }

    let usersList = [];
    if (Array.isArray(payload)) {
      usersList = payload;
    } else if (typeof payload === 'object') {
      const raw = await kv.get('sobber_users') || await kv.get('serenitycare_users');
      if (raw) {
        try { usersList = JSON.parse(raw); } catch {}
      }
      if (!Array.isArray(usersList)) usersList = [];

      const userItem = { ...payload };
      if (!userItem.id) {
        userItem.id = 'usr_' + Date.now().toString(36);
      }

      const idx = usersList.findIndex(u => u.id === userItem.id || (u.email && u.email.toLowerCase() === userItem.email?.toLowerCase()));
      if (idx !== -1) {
        usersList[idx] = { ...usersList[idx], ...userItem };
      } else {
        usersList.push(userItem);
      }
    }

    // Persist to sobber_users in KV
    await kv.put('sobber_users', JSON.stringify(usersList));

    // Also update sobber_state if present
    const rawState = await kv.get('sobber_state') || await kv.get('serenitycare_state');
    if (rawState) {
      try {
        const stateObj = JSON.parse(rawState);
        stateObj.users = usersList;
        stateObj.lastSyncedAt = new Date().toISOString();
        await kv.put('sobber_state', JSON.stringify(stateObj));
      } catch {}
    }

    return new Response(JSON.stringify({ 
      success: true, 
      count: usersList.length, 
      users: usersList 
    }), {
      status: 200,
      headers: JSON_HEADERS
    });
  } catch (err) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: err.message 
    }), { 
      status: 500, 
      headers: JSON_HEADERS 
    });
  }
}

export async function onRequestDelete(context) {
  try {
    const kv = getKV(context);
    if (!kv) {
      return new Response(JSON.stringify({ error: 'KV missing' }), { status: 500, headers: JSON_HEADERS });
    }

    const url = new URL(context.request.url);
    let userId = url.searchParams.get('id');

    if (!userId) {
      try {
        const body = await context.request.json();
        userId = body?.id;
      } catch {}
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), { status: 400, headers: JSON_HEADERS });
    }

    const raw = await kv.get('sobber_users');
    let usersList = [];
    if (raw) {
      try { usersList = JSON.parse(raw); } catch {}
    }
    if (!Array.isArray(usersList)) usersList = [];

    const beforeLen = usersList.length;
    usersList = usersList.filter(u => u.id !== userId);

    await kv.put('sobber_users', JSON.stringify(usersList));

    // Also update in sobber_state
    const rawState = await kv.get('sobber_state');
    if (rawState) {
      try {
        const stateObj = JSON.parse(rawState);
        stateObj.users = usersList;
        stateObj.lastSyncedAt = new Date().toISOString();
        await kv.put('sobber_state', JSON.stringify(stateObj));
      } catch {}
    }

    return new Response(JSON.stringify({ 
      success: true, 
      deletedId: userId,
      remainingCount: usersList.length,
      wasRemoved: beforeLen !== usersList.length
    }), {
      status: 200,
      headers: JSON_HEADERS
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
  }
}
