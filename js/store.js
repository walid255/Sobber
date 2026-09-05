/**
 * SerenityCare Global Reactive State Store (Production Ready)
 * 
 * ARCHITECTURE PRINCIPLES:
 * 1. Global Single Source of Truth: Canonical clinical and operational state is persisted
 *    strictly on Cloudflare backend (Workers KV, D1 SQL Relational Database, and R2 Object Storage).
 * 2. Zero Client-Side Data Storing: No clinical/PHI business data (patients, rooms, beds, fees,
 *    medications, users) is stored in browser localStorage. Client state is in-memory only,
 *    with session tokens retained only for maintaining active workstation authentication.
 * 3. Immediate Edge Sync: Subscribes to live Cloudflare KV state replication with zero-latency
 *    cross-tab broadcast, high-frequency background polling, and monotonic version propagation.
 */

// Initial Seed Rooms & Beds for Recovery Facility
const SEED_ROOMS = [
  { id: 'rm_101', roomNumber: 'Room 101', name: 'Cedar Wing 101', floor: '1st Floor', type: 'Double', capacity: 2, status: 'Active', notes: 'Standard double occupancy recovery room' },
  { id: 'rm_102', roomNumber: 'Room 102', name: 'Cedar Wing 102', floor: '1st Floor', type: 'Double', capacity: 2, status: 'Active', notes: 'Standard double occupancy recovery room' },
  { id: 'rm_103', roomNumber: 'Room 103', name: 'Pine Wing 103', floor: '1st Floor', type: 'Single', capacity: 1, status: 'Active', notes: 'Private single transition room' },
  { id: 'rm_201', roomNumber: 'Room 201', name: 'Maple Hall 201', floor: '2nd Floor', type: 'Ward', capacity: 4, status: 'Active', notes: 'Four-bed group recovery unit' },
  { id: 'rm_dx1', roomNumber: 'Detox 01', name: 'Clinical Detox Suite 01', floor: 'Ground Floor', type: 'Detox', capacity: 2, status: 'Active', notes: 'Monitored medical detoxification suite' }
];

const SEED_BEDS = [
  { id: 'bed_101a', roomId: 'rm_101', bedNumber: 'Bed 101-A', type: 'Standard', status: 'Available', patientId: null, notes: '' },
  { id: 'bed_101b', roomId: 'rm_101', bedNumber: 'Bed 101-B', type: 'Standard', status: 'Available', patientId: null, notes: '' },
  { id: 'bed_102a', roomId: 'rm_102', bedNumber: 'Bed 102-A', type: 'Standard', status: 'Available', patientId: null, notes: '' },
  { id: 'bed_102b', roomId: 'rm_102', bedNumber: 'Bed 102-B', type: 'Standard', status: 'Available', patientId: null, notes: '' },
  { id: 'bed_103a', roomId: 'rm_103', bedNumber: 'Bed 103-A', type: 'Standard', status: 'Available', patientId: null, notes: '' },
  { id: 'bed_201a', roomId: 'rm_201', bedNumber: 'Bed 201-A', type: 'Standard', status: 'Available', patientId: null, notes: '' },
  { id: 'bed_201b', roomId: 'rm_201', bedNumber: 'Bed 201-B', type: 'Standard', status: 'Available', patientId: null, notes: '' },
  { id: 'bed_201c', roomId: 'rm_201', bedNumber: 'Bed 201-C', type: 'Standard', status: 'Available', patientId: null, notes: '' },
  { id: 'bed_201d', roomId: 'rm_201', bedNumber: 'Bed 201-D', type: 'Standard', status: 'Available', patientId: null, notes: '' },
  { id: 'bed_dx1a', roomId: 'rm_dx1', bedNumber: 'Bed DX-1', type: 'Medical', status: 'Available', patientId: null, notes: 'Direct vitals telemetry equipped' },
  { id: 'bed_dx1b', roomId: 'rm_dx1', bedNumber: 'Bed DX-2', type: 'Medical', status: 'Available', patientId: null, notes: 'Direct vitals telemetry equipped' }
];

// Clean Production Initial State Template
const INITIAL_STATE = {
  facility: {
    name: 'SerenityCare Sober House & Recovery Center',
    licenseNumber: 'SH-84920-CLINICAL',
    address: '742 Hope Valley Road, Building B, Austin, TX 78701',
    phone: '+1 (800) 555-7623',
    email: 'admissions@serenitycare.org',
    director: 'Dr. Evelyn Vance, MD, FASAM',
    leadCounselor: 'Marcus Sterling, MSW, LCDC',
    totalBeds: 11,
    currency: 'TZS',
    logoUrl: 'assets/logo.svg',
    faviconUrl: 'assets/favicon.svg'
  },
  currency: 'TZS',
  currentUser: null,
  sessionToken: null,
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
      lastLogin: null,
      permissions: {
        dashboard: true,
        patients: true,
        rooms: true,
        medications: true,
        timetable: true,
        inventory: true,
        certificates: true,
        batch_upload: true,
        users: true,
        settings: true
      }
    }
  ],
  rooms: SEED_ROOMS,
  beds: SEED_BEDS,
  patients: [],
  residentFees: [],
  installmentPayments: [],
  medicationLogs: [],
  inventory: [],
  inventoryTransactions: [],
  timetable: [],
  reminders: [],
  activityLogs: [
    {
      id: 'act_init',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      user: 'System',
      action: 'Production Ready',
      details: 'SerenityCare production environment initialized with Cloudflare global state replication'
    }
  ],
  stateVersion: Date.now()
};

class ReactiveStore {
  constructor() {
    this.subscribers = new Map();
    this.isSyncing = false;
    this.lastSyncedAt = null;
    this.isCloudConnected = false;
    this.cloudError = null;

    // Purge any legacy browser storage of business data
    try {
      localStorage.removeItem('serenitycare_prod_v2');
    } catch (e) {}

    // Initialize clean in-memory state
    this.state = this.loadInitialState();

    // Cross-tab broadcast channel for instantaneous same-browser window sync
    try {
      if (typeof window !== 'undefined' && window.BroadcastChannel) {
        this.broadcastChannel = new BroadcastChannel('serenitycare_sync_channel');
        this.broadcastChannel.onmessage = (msg) => {
          if (msg.data && msg.data.type === 'STATE_UPDATED' && msg.data.state) {
            this.applyRemoteState(msg.data.state, false);
          }
        };
      }
    } catch (e) {
      this.broadcastChannel = null;
    }

    // Immediate Cloudflare Workers KV / D1 synchronization on initialization
    this.syncFromServer();

    // Background auto-sync on focus / tab visibility / mobile touch
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => this.syncFromServer());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.syncFromServer();
      });
      // Throttled mobile touch wake-up sync
      let lastTouchSync = 0;
      window.addEventListener('touchstart', () => {
        const now = Date.now();
        if (now - lastTouchSync > 3000) {
          lastTouchSync = now;
          this.syncFromServer();
        }
      }, { passive: true });
      // Background heartbeat sync every 3 seconds for instant multi-device replication
      setInterval(() => this.syncFromServer(), 3000);
    }
  }

  getApiUrl(endpoint) {
    let base = endpoint;
    try {
      const custom = localStorage.getItem('sobber_cloud_endpoint');
      if (custom && custom.trim().startsWith('http')) {
        base = custom.trim().replace(/\/+$/, '') + endpoint;
      }
    } catch (e) {}
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}_t=${Date.now()}`;
  }

  /**
   * Load clean in-memory state, recovering only active session credentials if present
   */
  loadInitialState() {
    const fresh = JSON.parse(JSON.stringify(INITIAL_STATE));

    try {
      const token = sessionStorage.getItem('serenitycare_session_token') || localStorage.getItem('serenitycare_session_token');
      const uid = sessionStorage.getItem('serenitycare_session_uid') || localStorage.getItem('serenitycare_session_uid');
      if (token && uid) {
        fresh.sessionToken = token;
        const matchingUser = fresh.users.find(u => u.id === uid);
        if (matchingUser) fresh.currentUser = { ...matchingUser };
      }
    } catch (e) {}

    return fresh;
  }

  /**
   * Save state: Pushes in-memory state to the global Cloudflare server
   * (Does NOT save database records on user side)
   */
  saveState(stateToSave, syncToCloud = true) {
    const currentState = stateToSave || this.state;
    if (syncToCloud) {
      return this.pushToServer(currentState);
    }
    return Promise.resolve({ success: true, memoryOnly: true });
  }

  /**
   * Fetch live global state from Cloudflare KV & D1 endpoint.
   * Guarantees all browsers and mobile devices see updates immediately.
   */
  async syncFromServer() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    try {
      const url = this.getApiUrl('/api/sync');
      const res = await fetch(url, { 
        cache: 'no-store',
        headers: { 
          'Accept': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          this.isCloudConnected = false;
          this.cloudError = 'Server returned HTML instead of API JSON. Ensure Cloudflare Pages Functions are deployed.';
          this.emit('sync:error', { error: this.cloudError });
          return;
        }

        const remote = await res.json();
        if (remote && typeof remote === 'object') {
          if (remote.online === false && !remote.isDemoFallback) {
            this.isCloudConnected = false;
            this.cloudError = remote.message || remote.error || 'KV namespace binding missing';
            this.emit('sync:error', { error: this.cloudError });
          } else if (Array.isArray(remote.users) || Array.isArray(remote.rooms)) {
            this.isCloudConnected = true;
            this.cloudError = null;
            this.applyRemoteState(remote);
          }
        }
      } else {
        this.isCloudConnected = false;
        try {
          const errData = await res.json();
          this.cloudError = errData.error || errData.message || `HTTP ${res.status}`;
        } catch {
          this.cloudError = `HTTP ${res.status} from ${url}`;
        }
        this.emit('sync:error', { error: this.cloudError });
      }
    } catch (err) {
      this.isCloudConnected = false;
      this.cloudError = err.message;
      this.emit('sync:error', { error: err.message });
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Apply authoritative remote state received from Cloudflare Workers KV / D1
   */
  applyRemoteState(remoteState) {
    if (!remoteState || typeof remoteState !== 'object') return;

    const currentUserId = this.state.currentUser ? this.state.currentUser.id : null;

    // Update in-memory collections with canonical global server state
    if (Array.isArray(remoteState.users)) this.state.users = remoteState.users;
    if (Array.isArray(remoteState.patients)) this.state.patients = remoteState.patients;
    if (Array.isArray(remoteState.rooms)) this.state.rooms = remoteState.rooms;
    if (Array.isArray(remoteState.beds)) this.state.beds = remoteState.beds;
    if (Array.isArray(remoteState.residentFees)) this.state.residentFees = remoteState.residentFees;
    if (Array.isArray(remoteState.installmentPayments)) this.state.installmentPayments = remoteState.installmentPayments;
    if (Array.isArray(remoteState.medicationLogs)) this.state.medicationLogs = remoteState.medicationLogs;
    if (Array.isArray(remoteState.inventory)) this.state.inventory = remoteState.inventory;
    if (Array.isArray(remoteState.inventoryTransactions)) this.state.inventoryTransactions = remoteState.inventoryTransactions;
    if (Array.isArray(remoteState.timetable)) this.state.timetable = remoteState.timetable;
    if (Array.isArray(remoteState.reminders)) this.state.reminders = remoteState.reminders;
    if (Array.isArray(remoteState.activityLogs)) this.state.activityLogs = remoteState.activityLogs;

    if (remoteState.facility) {
      this.state.facility = { ...this.state.facility, ...remoteState.facility };
    }

    // Keep facility totalBeds synchronized with active beds count
    if (Array.isArray(this.state.beds) && this.state.beds.length > 0) {
      this.state.facility.totalBeds = this.state.beds.length;
    }

    if (remoteState.stateVersion) {
      this.state.stateVersion = remoteState.stateVersion;
    }

    // Refresh active session profile if user exists in updated list
    if (currentUserId) {
      const freshUser = this.state.users.find(u => u.id === currentUserId);
      if (freshUser) {
        this.state.currentUser = { ...freshUser };
      }
    } else {
      // Try restoring from session storage
      try {
        const uid = sessionStorage.getItem('serenitycare_session_uid') || localStorage.getItem('serenitycare_session_uid');
        if (uid) {
          const freshUser = this.state.users.find(u => u.id === uid);
          if (freshUser) {
            this.state.currentUser = { ...freshUser };
            this.state.sessionToken = sessionStorage.getItem('serenitycare_session_token') || localStorage.getItem('serenitycare_session_token');
          }
        }
      } catch (e) {}
    }

    this.lastSyncedAt = remoteState.lastSyncedAt || new Date().toISOString();

    // Broadcast globally to UI
    this.emit('state:changed', this.state);
    this.emit('sync:updated', { timestamp: this.lastSyncedAt, version: this.state.stateVersion });
  }

  /**
   * Push state to Cloudflare KV & D1 global server
   */
  async pushToServer(stateToPush) {
    const payload = stateToPush || this.state;
    payload.lastSyncedAt = new Date().toISOString();
    payload.stateVersion = Date.now();

    // Instant local broadcast to other tabs in the same browser
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: 'STATE_UPDATED', state: payload });
      } catch (e) {}
    }

    try {
      const url = this.getApiUrl('/api/sync');
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        if (json.success !== false) {
          this.isCloudConnected = true;
          this.cloudError = null;
          this.lastSyncedAt = json.timestamp || payload.lastSyncedAt;
          this.state.stateVersion = json.version || payload.stateVersion;
          this.emit('sync:success', { timestamp: this.lastSyncedAt, version: this.state.stateVersion });
          return { success: true, timestamp: this.lastSyncedAt, version: this.state.stateVersion };
        } else {
          this.isCloudConnected = false;
          this.cloudError = json.error || 'Cloudflare KV save failed';
          this.emit('sync:error', { error: this.cloudError });
          return { success: false, error: this.cloudError };
        }
      } else {
        this.isCloudConnected = false;
        let errStr = `HTTP ${res.status}`;
        try {
          const errData = await res.json();
          errStr = errData.error || errData.message || errStr;
        } catch {
          errStr = `HTTP ${res.status} from cloud endpoint`;
        }
        this.cloudError = errStr;
        this.emit('sync:error', { error: this.cloudError });
        return { success: false, error: this.cloudError };
      }
    } catch (err) {
      this.isCloudConnected = false;
      this.cloudError = err.message;
      this.emit('sync:error', { error: err.message });
      return { success: false, error: err.message };
    }
  }

  async checkConnectivity() {
    const startTime = performance.now();
    try {
      const url = this.getApiUrl('/api/health');
      const res = await fetch(url, { cache: 'no-store' });
      const latency = Math.round(performance.now() - startTime);
      if (res.ok) {
        const data = await res.json();
        return {
          ok: true,
          latency,
          endpoint: url,
          data
        };
      }
      return {
        ok: false,
        latency,
        endpoint: url,
        status: res.status,
        error: `HTTP ${res.status}`
      };
    } catch (e) {
      return {
        ok: false,
        latency: Math.round(performance.now() - startTime),
        endpoint: this.getApiUrl('/api/health'),
        error: e.message
      };
    }
  }

  getState() {
    return this.state;
  }

  subscribe(event, callback) {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set());
    }
    this.subscribers.get(event).add(callback);

    return () => {
      const listeners = this.subscribers.get(event);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }

  emit(event, payload) {
    if (this.subscribers.has(event)) {
      this.subscribers.get(event).forEach(cb => {
        try {
          cb(payload, this.state);
        } catch (err) {
          console.error(`Error in subscriber callback for ${event}:`, err);
        }
      });
    }

    if (event !== 'state:changed') {
      if (this.subscribers.has('state:changed')) {
        this.subscribers.get('state:changed').forEach(cb => {
          try {
            cb({ event, payload }, this.state);
          } catch (err) {
            console.error('Error in state:changed subscriber:', err);
          }
        });
      }
    }
  }

  /**
   * Mutate state in memory and push immediately to the global Cloudflare server
   */
  async mutate(mutationFn, eventName = 'state:changed', eventPayload = null) {
    mutationFn(this.state);
    this.emit(eventName, eventPayload);
    return await this.pushToServer(this.state);
  }

  // --- AUTH ACTIONS ---

  loginUser(email, password, rememberMe = false) {
    const user = this.state.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) {
      return { success: false, message: 'No account found with this email address.' };
    }
    if (user.status !== 'Active') {
      return { success: false, message: 'Account has been deactivated. Please contact an administrator.' };
    }
    if (user.password && user.password !== password) {
      return { success: false, message: 'Incorrect password. Please verify and try again.' };
    }

    const token = 'tok_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);

    // Save session credentials
    try {
      if (rememberMe) {
        localStorage.setItem('serenitycare_session_token', token);
        localStorage.setItem('serenitycare_session_uid', user.id);
      } else {
        sessionStorage.setItem('serenitycare_session_token', token);
        sessionStorage.setItem('serenitycare_session_uid', user.id);
      }
    } catch (e) {}

    this.mutate(s => {
      const u = s.users.find(usr => usr.id === user.id);
      if (u) {
        u.lastLogin = new Date().toISOString().replace('T', ' ').substring(0, 16);
        s.currentUser = { ...u };
      }
      s.sessionToken = token;
      s.activityLogs.unshift({
        id: 'act_' + Date.now(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        user: user.name,
        action: 'User Authentication',
        details: `Logged in as ${user.role}`
      });
    }, 'auth:changed', user);

    return { success: true, user, token };
  }

  logout() {
    try {
      sessionStorage.removeItem('serenitycare_session_token');
      sessionStorage.removeItem('serenitycare_session_uid');
      localStorage.removeItem('serenitycare_session_token');
      localStorage.removeItem('serenitycare_session_uid');
    } catch (e) {}

    this.mutate(s => {
      if (s.currentUser) {
        s.activityLogs.unshift({
          id: 'act_' + Date.now(),
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          user: s.currentUser.name,
          action: 'User Logout',
          details: 'Session ended successfully'
        });
      }
      s.currentUser = null;
      s.sessionToken = null;
    }, 'auth:logout', null);
  }

  setCurrentUser(userId) {
    const user = this.state.users.find(u => u.id === userId);
    if (user) {
      this.mutate(s => {
        s.currentUser = { ...user };
        s.activityLogs.unshift({
          id: 'act_' + Date.now(),
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          user: user.name,
          action: 'Role Switched',
          details: `Role active: ${user.role}`
        });
      }, 'auth:changed', user);
    }
  }

  async addUser(userData) {
    const defaultPerms = {
      dashboard: true,
      patients: userData.role === 'admin' || userData.role === 'doctor',
      rooms: userData.role === 'admin',
      medications: userData.role === 'admin' || userData.role === 'doctor' || userData.role === 'nurse',
      timetable: userData.role === 'admin' || userData.role === 'counselor',
      inventory: userData.role === 'admin' || userData.role === 'nurse',
      certificates: userData.role === 'admin' || userData.role === 'doctor' || userData.role === 'counselor',
      batch_upload: userData.role === 'admin',
      users: userData.role === 'admin',
      settings: userData.role === 'admin'
    };

    const newUser = {
      id: 'usr_' + Date.now().toString(36),
      status: 'Active',
      lastLogin: 'Never',
      password: userData.password || 'SerenityCare2026!',
      permissions: userData.permissions || defaultPerms,
      ...userData
    };

    try {
      await fetch(this.getApiUrl('/api/users'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-store, no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify(newUser)
      });
    } catch (e) {
      console.warn('Direct /api/users write failed, continuing with state replication:', e);
    }

    await this.mutate(s => {
      const exists = s.users.some(u => u.id === newUser.id);
      if (!exists) s.users.push(newUser);
      s.activityLogs.unshift({
        id: 'act_' + Date.now(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        user: s.currentUser ? s.currentUser.name : 'Admin',
        action: 'Created Staff User',
        details: `${newUser.name} (${newUser.role})`
      });
    }, 'user:added', newUser);

    return newUser;
  }

  async updateUser(userId, updates) {
    let updated = null;
    await this.mutate(s => {
      const idx = s.users.findIndex(u => u.id === userId);
      if (idx !== -1) {
        s.users[idx] = { ...s.users[idx], ...updates };
        updated = s.users[idx];
        if (s.currentUser && s.currentUser.id === userId) {
          s.currentUser = { ...s.users[idx] };
        }
      }
    }, 'user:updated', { userId, updates });

    if (updated) {
      try {
        await fetch(this.getApiUrl('/api/users'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Cache-Control': 'no-store, no-cache',
            'Pragma': 'no-cache'
          },
          body: JSON.stringify(updated)
        });
      } catch (e) {}
    }
    return updated;
  }

  async deleteUser(userId) {
    await this.mutate(s => {
      s.users = s.users.filter(u => u.id !== userId);
    }, 'user:deleted', userId);

    try {
      await fetch(this.getApiUrl(`/api/users?id=${encodeURIComponent(userId)}`), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-store, no-cache',
          'Pragma': 'no-cache'
        }
      });
    } catch (e) {}
    return true;
  }

  // --- ROOMS & BEDS ACTIONS (ADMIN & PERMITTED USERS) ---

  async addRoom(roomData) {
    const newRoom = {
      id: roomData.id || 'rm_' + Date.now(),
      roomNumber: roomData.roomNumber,
      name: roomData.name || '',
      floor: roomData.floor || '1st Floor',
      type: roomData.type || 'Double',
      capacity: parseInt(roomData.capacity) || 2,
      status: roomData.status || 'Active',
      notes: roomData.notes || '',
      createdAt: new Date().toISOString()
    };

    const newBeds = [];
    if (roomData.initialBedsCount && parseInt(roomData.initialBedsCount) > 0) {
      const count = parseInt(roomData.initialBedsCount);
      const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      for (let i = 0; i < count; i++) {
        const label = `${newRoom.roomNumber}-${letters[i] || (i + 1)}`;
        newBeds.push({
          id: `bed_${newRoom.id}_${i + 1}`,
          roomId: newRoom.id,
          bedNumber: label,
          type: newRoom.type === 'Detox' ? 'Medical' : 'Standard',
          status: 'Available',
          patientId: null,
          notes: ''
        });
      }
    }

    try {
      await fetch(this.getApiUrl('/api/rooms'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-cache' },
        body: JSON.stringify({ room: newRoom, initialBedsCount: roomData.initialBedsCount })
      });
    } catch (e) {}

    await this.mutate(s => {
      s.rooms.push(newRoom);
      if (newBeds.length > 0) s.beds.push(...newBeds);
      s.facility.totalBeds = s.beds.length;
      s.activityLogs.unshift({
        id: 'act_' + Date.now(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        user: s.currentUser ? s.currentUser.name : 'Admin',
        action: 'Created Room',
        details: `${newRoom.roomNumber} (${newRoom.name || newRoom.type}) with ${newBeds.length} beds`
      });
    }, 'room:added', newRoom);

    return newRoom;
  }

  async updateRoom(roomId, updates) {
    let updated = null;
    await this.mutate(s => {
      const idx = s.rooms.findIndex(r => r.id === roomId);
      if (idx !== -1) {
        s.rooms[idx] = { ...s.rooms[idx], ...updates };
        updated = s.rooms[idx];
      }
    }, 'room:updated', { roomId, updates });

    if (updated) {
      try {
        await fetch(this.getApiUrl('/api/rooms'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-cache' },
          body: JSON.stringify({ room: updated })
        });
      } catch (e) {}
    }
    return updated;
  }

  async deleteRoom(roomId) {
    const occupiedBed = (this.state.beds || []).find(b => b.roomId === roomId && b.status === 'Occupied');
    if (occupiedBed) {
      return { success: false, error: 'Cannot remove room: One or more beds are currently occupied by active residents. Please reassign the residents first.' };
    }

    let deletedRoom = null;
    await this.mutate(s => {
      deletedRoom = s.rooms.find(r => r.id === roomId);
      s.rooms = s.rooms.filter(r => r.id !== roomId);
      s.beds = s.beds.filter(b => b.roomId !== roomId);
      s.facility.totalBeds = s.beds.length;
      if (deletedRoom) {
        s.activityLogs.unshift({
          id: 'act_' + Date.now(),
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          user: s.currentUser ? s.currentUser.name : 'Admin',
          action: 'Deleted Room',
          details: `${deletedRoom.roomNumber} removed from facility`
        });
      }
    }, 'room:deleted', roomId);

    try {
      await fetch(this.getApiUrl(`/api/rooms?roomId=${encodeURIComponent(roomId)}`), {
        method: 'DELETE',
        headers: { 'Cache-Control': 'no-store, no-cache' }
      });
    } catch (e) {}

    return { success: true };
  }

  async addBed(bedData) {
    const newBed = {
      id: bedData.id || 'bed_' + Date.now(),
      roomId: bedData.roomId,
      bedNumber: bedData.bedNumber,
      type: bedData.type || 'Standard',
      status: bedData.status || 'Available',
      patientId: null,
      notes: bedData.notes || '',
      createdAt: new Date().toISOString()
    };

    try {
      await fetch(this.getApiUrl('/api/rooms'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-cache' },
        body: JSON.stringify({ bed: newBed })
      });
    } catch (e) {}

    await this.mutate(s => {
      s.beds.push(newBed);
      s.facility.totalBeds = s.beds.length;
      const room = s.rooms.find(r => r.id === newBed.roomId);
      s.activityLogs.unshift({
        id: 'act_' + Date.now(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        user: s.currentUser ? s.currentUser.name : 'Admin',
        action: 'Added Bed',
        details: `${newBed.bedNumber} added to ${room ? room.roomNumber : 'Room'}`
      });
    }, 'bed:added', newBed);

    return newBed;
  }

  async updateBed(bedId, updates) {
    let updated = null;
    await this.mutate(s => {
      const idx = s.beds.findIndex(b => b.id === bedId);
      if (idx !== -1) {
        s.beds[idx] = { ...s.beds[idx], ...updates };
        updated = s.beds[idx];
      }
    }, 'bed:updated', { bedId, updates });

    if (updated) {
      try {
        await fetch(this.getApiUrl('/api/rooms'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-cache' },
          body: JSON.stringify({ bed: updated })
        });
      } catch (e) {}
    }
    return updated;
  }

  async deleteBed(bedId) {
    const target = (this.state.beds || []).find(b => b.id === bedId);
    if (target && target.status === 'Occupied') {
      return { success: false, error: 'Cannot remove bed: Bed is currently occupied by a resident.' };
    }

    await this.mutate(s => {
      s.beds = s.beds.filter(b => b.id !== bedId);
      s.facility.totalBeds = s.beds.length;
    }, 'bed:deleted', bedId);

    try {
      await fetch(this.getApiUrl(`/api/rooms?bedId=${encodeURIComponent(bedId)}`), {
        method: 'DELETE',
        headers: { 'Cache-Control': 'no-store, no-cache' }
      });
    } catch (e) {}

    return { success: true };
  }

  async vacateBed(bedId) {
    return await this.updateBed(bedId, { status: 'Available', patientId: null });
  }

  async assignBed(bedId, patientId) {
    return await this.updateBed(bedId, { status: 'Occupied', patientId: patientId });
  }

  getAvailableBeds() {
    return (this.state.beds || []).filter(b => b.status === 'Available').map(b => {
      const rm = (this.state.rooms || []).find(r => r.id === b.roomId);
      return {
        ...b,
        roomNumber: rm ? rm.roomNumber : 'Unknown Room',
        roomName: rm ? rm.name : '',
        floor: rm ? rm.floor : ''
      };
    });
  }

  getRoomsWithBeds() {
    const rooms = this.state.rooms || [];
    const beds = this.state.beds || [];
    const patients = this.state.patients || [];

    return rooms.map(rm => {
      const roomBeds = beds.filter(b => b.roomId === rm.id).map(b => {
        const patient = b.patientId ? patients.find(p => p.id === b.patientId) : null;
        return {
          ...b,
          patient
        };
      });
      const occupiedCount = roomBeds.filter(b => b.status === 'Occupied').length;
      return {
        ...rm,
        beds: roomBeds,
        totalBeds: roomBeds.length,
        occupiedCount,
        availableCount: roomBeds.filter(b => b.status === 'Available').length
      };
    });
  }

  // --- RESIDENT ADDICT FEES & INSTALLMENT ACTIONS ---

  async addResidentFee(feeData) {
    const feeId = feeData.id || 'fee_' + Date.now();
    const totalFee = Number(feeData.totalFee) || 0;
    const initialDeposit = Number(feeData.initialDeposit) || 0;
    const totalInstallments = Math.max(1, parseInt(feeData.totalInstallments) || 1);
    const frequency = feeData.frequency || 'Monthly';
    const amountPaid = initialDeposit;
    const remainingBalance = Math.max(0, totalFee - initialDeposit);
    const status = remainingBalance <= 0 ? 'Fully Paid' : (initialDeposit > 0 ? 'Partially Paid' : 'Pending');

    const newFee = {
      id: feeId,
      patientId: feeData.patientId,
      totalFee,
      currency: feeData.currency || this.state.currency || 'TZS',
      paymentPlan: feeData.paymentPlan || (totalInstallments > 1 ? 'Installments' : 'Full Payment'),
      totalInstallments,
      frequency,
      initialDeposit,
      amountPaid,
      remainingBalance,
      paymentMethod: feeData.paymentMethod || 'Cash',
      referenceNo: feeData.referenceNo || `INT-${Date.now().toString().slice(-6)}`,
      status,
      notes: feeData.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const schedule = [];
    const today = new Date();
    const freqDays = frequency === 'Weekly' ? 7 : (frequency === 'Bi-weekly' ? 14 : 30);

    if (newFee.paymentPlan === 'Installments' && totalInstallments > 1) {
      // Installment #1: Down payment at intake
      schedule.push({
        id: `inst_${feeId}_1`,
        residentFeeId: feeId,
        patientId: feeData.patientId,
        installmentNumber: 1,
        amount: initialDeposit > 0 ? initialDeposit : Math.round(totalFee / totalInstallments),
        dueDate: today.toISOString().split('T')[0],
        paidDate: initialDeposit > 0 ? today.toISOString().split('T')[0] : null,
        paymentMethod: feeData.paymentMethod || 'Cash',
        referenceNo: initialDeposit > 0 ? (feeData.referenceNo || `REC-${Date.now().toString().slice(-6)}`) : '',
        status: initialDeposit > 0 ? 'Paid' : 'Pending',
        recordedBy: this.state.currentUser ? this.state.currentUser.name : 'Admissions Staff',
        receiptUrl: null,
        notes: initialDeposit > 0 ? 'Initial registration deposit paid at intake' : 'First scheduled payment'
      });

      // Subsequent scheduled installments
      const remCount = totalInstallments - 1;
      const splitAmount = remCount > 0 ? Math.round(remainingBalance / remCount) : 0;

      for (let i = 1; i <= remCount; i++) {
        const dueDateObj = new Date(today.getTime() + (i * freqDays * 24 * 60 * 60 * 1000));
        const installmentAmount = (i === remCount) ? (remainingBalance - (splitAmount * (remCount - 1))) : splitAmount;

        schedule.push({
          id: `inst_${feeId}_${i + 1}`,
          residentFeeId: feeId,
          patientId: feeData.patientId,
          installmentNumber: i + 1,
          amount: Math.max(0, installmentAmount),
          dueDate: dueDateObj.toISOString().split('T')[0],
          paidDate: null,
          paymentMethod: null,
          referenceNo: '',
          status: 'Pending',
          recordedBy: null,
          receiptUrl: null,
          notes: `Scheduled installment #${i + 1} (${frequency})`
        });
      }
    } else {
      // Full Payment
      schedule.push({
        id: `inst_${feeId}_1`,
        residentFeeId: feeId,
        patientId: feeData.patientId,
        installmentNumber: 1,
        amount: totalFee,
        dueDate: today.toISOString().split('T')[0],
        paidDate: initialDeposit >= totalFee ? today.toISOString().split('T')[0] : null,
        paymentMethod: feeData.paymentMethod || 'Cash',
        referenceNo: feeData.referenceNo || `REC-${Date.now().toString().slice(-6)}`,
        status: initialDeposit >= totalFee ? 'Paid' : 'Pending',
        recordedBy: this.state.currentUser ? this.state.currentUser.name : 'Admissions Staff',
        receiptUrl: null,
        notes: 'Full program fee'
      });
    }

    try {
      await fetch(this.getApiUrl('/api/payments'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-cache' },
        body: JSON.stringify({ residentFee: newFee, schedule })
      });
    } catch (e) {}

    await this.mutate(s => {
      s.residentFees = s.residentFees.filter(f => f.patientId !== newFee.patientId);
      s.installmentPayments = s.installmentPayments.filter(i => i.patientId !== newFee.patientId);
      s.residentFees.push(newFee);
      s.installmentPayments.push(...schedule);
      s.activityLogs.unshift({
        id: 'act_' + Date.now(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        user: s.currentUser ? s.currentUser.name : 'Staff',
        action: 'Configured Fee Ledger',
        details: `Set ${newFee.paymentPlan} for ${newFee.patientId}: Total ${newFee.totalFee} ${newFee.currency}`
      });
    }, 'fee:added', { fee: newFee, schedule });

    return { success: true, fee: newFee, schedule };
  }

  async recordInstallmentPayment({ feeId, patientId, installmentId, amount, paymentMethod, referenceNo, notes, paidDate }) {
    const payAmount = Number(amount);
    let updatedFee = null;
    let updatedInstallment = null;

    await this.mutate(s => {
      const instIdx = s.installmentPayments.findIndex(i => i.id === installmentId);
      if (instIdx !== -1) {
        s.installmentPayments[instIdx] = {
          ...s.installmentPayments[instIdx],
          amount: payAmount || s.installmentPayments[instIdx].amount,
          paidDate: paidDate || new Date().toISOString().split('T')[0],
          paymentMethod: paymentMethod || 'Cash',
          referenceNo: referenceNo || `REC-${Date.now().toString().slice(-6)}`,
          status: 'Paid',
          recordedBy: s.currentUser ? s.currentUser.name : 'Finance Staff',
          notes: notes || s.installmentPayments[instIdx].notes
        };
        updatedInstallment = s.installmentPayments[instIdx];
      }

      const targetFeeId = feeId || (updatedInstallment ? updatedInstallment.residentFeeId : null);
      const feeIdx = s.residentFees.findIndex(f => f.id === targetFeeId || f.patientId === patientId);
      if (feeIdx !== -1) {
        const related = s.installmentPayments.filter(i => i.residentFeeId === s.residentFees[feeIdx].id);
        const totalPaid = related.filter(i => i.status === 'Paid').reduce((sum, i) => sum + Number(i.amount), 0);
        s.residentFees[feeIdx].amountPaid = totalPaid;
        s.residentFees[feeIdx].remainingBalance = Math.max(0, s.residentFees[feeIdx].totalFee - totalPaid);
        s.residentFees[feeIdx].status = s.residentFees[feeIdx].remainingBalance <= 0 ? 'Fully Paid' : 'Partially Paid';
        s.residentFees[feeIdx].updatedAt = new Date().toISOString();
        updatedFee = s.residentFees[feeIdx];
      }

      s.activityLogs.unshift({
        id: 'act_' + Date.now(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        user: s.currentUser ? s.currentUser.name : 'Finance Staff',
        action: 'Recorded Installment Payment',
        details: `Received ${payAmount} via ${paymentMethod || 'Cash'} (Ref: ${referenceNo || 'None'})`
      });
    }, 'payment:recorded', { updatedFee, updatedInstallment });

    try {
      await fetch(this.getApiUrl('/api/payments'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-cache' },
        body: JSON.stringify({ installmentPayment: updatedInstallment })
      });
    } catch (e) {}

    return { success: true, fee: updatedFee, installment: updatedInstallment };
  }

  getResidentFee(patientId) {
    return (this.state.residentFees || []).find(f => f.patientId === patientId) || null;
  }

  getInstallmentPayments(patientId) {
    return (this.state.installmentPayments || []).filter(i => i.patientId === patientId).sort((a, b) => a.installmentNumber - b.installmentNumber);
  }

  // --- PATIENTS ACTIONS ---

  async addPatient(patientData) {
    const newId = 'PAT-' + (100 + this.state.patients.length + 1);
    const newPatient = {
      id: newId,
      admissionDate: new Date().toISOString().split('T')[0],
      stage: 'Inpatient Recovery',
      sobrietyDays: 1,
      graduationQualified: false,
      graduationDate: null,
      vitals: [],
      progressNotes: [],
      prescriptions: [],
      photo: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=80',
      ...patientData
    };

    // Bed allocation
    if (patientData.bedId || patientData.bedNumber) {
      const bed = (this.state.beds || []).find(b => (patientData.bedId && b.id === patientData.bedId) || (patientData.bedNumber && b.bedNumber === patientData.bedNumber));
      if (bed) {
        bed.status = 'Occupied';
        bed.patientId = newId;
        newPatient.bedId = bed.id;
        newPatient.bedNumber = bed.bedNumber;
        const rm = (this.state.rooms || []).find(r => r.id === bed.roomId);
        if (rm) newPatient.roomNumber = rm.roomNumber;
      }
    }

    try {
      await fetch(this.getApiUrl('/api/patients'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-store, no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify(newPatient)
      });
    } catch (e) {
      console.warn('Direct /api/patients write failed, continuing with full sync:', e);
    }

    await this.mutate(s => {
      const exists = s.patients.some(p => p.id === newPatient.id);
      if (!exists) s.patients.unshift(newPatient);
      if (newPatient.bedId) {
        const bd = s.beds.find(b => b.id === newPatient.bedId);
        if (bd) {
          bd.status = 'Occupied';
          bd.patientId = newId;
        }
      }
      s.activityLogs.unshift({
        id: 'act_' + Date.now(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        user: s.currentUser ? s.currentUser.name : 'Staff',
        action: 'Admitted Patient',
        details: `${newPatient.name} (${newPatient.id}) assigned to ${newPatient.roomNumber || 'Room'} ${newPatient.bedNumber || ''}`
      });
    }, 'patient:added', newPatient);

    // If feeData is present, add fee and installment schedule
    if (patientData.feeData) {
      await this.addResidentFee({
        ...patientData.feeData,
        patientId: newId
      });
    }

    return newPatient;
  }

  async updatePatient(patientId, updates) {
    let updated = null;
    await this.mutate(s => {
      const idx = s.patients.findIndex(p => p.id === patientId);
      if (idx !== -1) {
        s.patients[idx] = { ...s.patients[idx], ...updates };
        updated = s.patients[idx];
      }
    }, 'patient:updated', { patientId, updates });

    if (updated) {
      try {
        await fetch(this.getApiUrl('/api/patients'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Cache-Control': 'no-store, no-cache',
            'Pragma': 'no-cache'
          },
          body: JSON.stringify(updated)
        });
      } catch (e) {}
    }
    return updated;
  }

  async deletePatient(patientId) {
    await this.mutate(s => {
      const patient = s.patients.find(p => p.id === patientId);
      s.patients = s.patients.filter(p => p.id !== patientId);
      s.medicationLogs = s.medicationLogs.filter(l => l.patientId !== patientId);

      // Release any bed allocated to this resident
      s.beds.forEach(b => {
        if (b.patientId === patientId) {
          b.status = 'Available';
          b.patientId = null;
        }
      });

      // Remove fee & installment records
      s.residentFees = s.residentFees.filter(f => f.patientId !== patientId);
      s.installmentPayments = s.installmentPayments.filter(i => i.patientId !== patientId);

      if (patient) {
        s.activityLogs.unshift({
          id: 'act_' + Date.now(),
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          user: s.currentUser ? s.currentUser.name : 'Admin',
          action: 'Discharged/Deleted Patient Record',
          details: `${patient.name} (${patient.id}) discharged and bed released`
        });
      }
    }, 'patient:deleted', patientId);

    try {
      await fetch(this.getApiUrl(`/api/patients?id=${encodeURIComponent(patientId)}`), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-store, no-cache',
          'Pragma': 'no-cache'
        }
      });
    } catch (e) {}
    return true;
  }

  async batchImportPatients(patientList) {
    const added = [];
    patientList.forEach((data, index) => {
      const newId = 'PAT-' + (100 + this.state.patients.length + 1 + index);
      const patient = {
        id: newId,
        admissionDate: data.admissionDate || new Date().toISOString().split('T')[0],
        stage: data.stage || 'Inpatient Recovery',
        sobrietyDays: parseInt(data.sobrietyDays) || 1,
        graduationQualified: false,
        graduationDate: null,
        vitals: [],
        progressNotes: [],
        prescriptions: [],
        photo: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=80',
        ...data
      };
      added.push(patient);
    });

    try {
      await fetch(this.getApiUrl('/api/patients'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-store, no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify(added)
      });
    } catch (e) {}

    await this.mutate(s => {
      s.patients.unshift(...added);
      s.activityLogs.unshift({
        id: 'act_' + Date.now(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        user: s.currentUser ? s.currentUser.name : 'Admin',
        action: 'Batch Import Patients',
        details: `Imported ${added.length} records via CSV`
      });
    }, 'patients:batch_added', added);

    return added;
  }

  // Clinical Sub-records
  async addVitals(patientId, vitalsData) {
    const entry = {
      id: 'vit_' + Date.now(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      recordedBy: this.state.currentUser ? this.state.currentUser.name : 'Nurse On Duty',
      ...vitalsData
    };

    await this.mutate(s => {
      const p = s.patients.find(pt => pt.id === patientId);
      if (p) {
        if (!p.vitals) p.vitals = [];
        p.vitals.unshift(entry);
      }
    }, 'vitals:added', { patientId, entry });

    return entry;
  }

  async addProgressNote(patientId, noteData) {
    const note = {
      id: 'note_' + Date.now(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      author: this.state.currentUser ? this.state.currentUser.name : 'Clinical Staff',
      ...noteData
    };

    await this.mutate(s => {
      const p = s.patients.find(pt => pt.id === patientId);
      if (p) {
        if (!p.progressNotes) p.progressNotes = [];
        p.progressNotes.unshift(note);
      }
    }, 'note:added', { patientId, note });

    return note;
  }

  async addPrescription(patientId, rxData) {
    const rx = {
      id: 'rx_' + Date.now(),
      prescribingDoctor: this.state.currentUser ? this.state.currentUser.name : 'Dr. Evelyn Vance, MD',
      status: 'Active',
      startDate: new Date().toISOString().split('T')[0],
      ...rxData
    };

    await this.mutate(s => {
      const p = s.patients.find(pt => pt.id === patientId);
      if (p) {
        if (!p.prescriptions) p.prescriptions = [];
        p.prescriptions.unshift(rx);
      }
    }, 'rx:added', { patientId, rx });

    return rx;
  }

  async discontinuePrescription(patientId, rxId) {
    await this.mutate(s => {
      const p = s.patients.find(pt => pt.id === patientId);
      if (p && p.prescriptions) {
        const rx = p.prescriptions.find(r => r.id === rxId);
        if (rx) {
          rx.status = 'Discontinued';
          rx.endDate = new Date().toISOString().split('T')[0];
        }
      }
    }, 'rx:discontinued', { patientId, rxId });
  }

  async qualifyForGraduation(patientId) {
    await this.mutate(s => {
      const p = s.patients.find(pt => pt.id === patientId);
      if (p) {
        p.graduationQualified = true;
        p.graduationDate = new Date().toISOString().split('T')[0];
        s.activityLogs.unshift({
          id: 'act_' + Date.now(),
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          user: s.currentUser ? s.currentUser.name : 'Director',
          action: 'Graduation Approved',
          details: `${p.name} (${p.id}) qualified for certificate release`
        });
      }
    }, 'patient:qualified', patientId);
  }

  // --- MEDICATION MAR ACTIONS ---

  async logMedicationDose(logData) {
    const log = {
      id: 'mar_' + Date.now(),
      status: 'Pending',
      nurseName: this.state.currentUser ? this.state.currentUser.name : 'On-Duty Nurse',
      ...logData
    };

    try {
      await fetch(this.getApiUrl('/api/medications'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-store, no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify(log)
      });
    } catch (e) {}

    await this.mutate(s => {
      s.medicationLogs.unshift(log);
    }, 'medication:logged', log);

    return log;
  }

  async updateMedicationStatus(logId, status, notes = '') {
    let updatedLog = null;
    await this.mutate(s => {
      const log = s.medicationLogs.find(l => l.id === logId);
      if (log) {
        log.status = status;
        log.administeredAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
        log.nurseName = s.currentUser ? s.currentUser.name : 'Clinical Nurse';
        log.notes = notes;
        updatedLog = log;
      }
    }, 'medication:status_changed', { logId, status });

    if (updatedLog) {
      try {
        await fetch(this.getApiUrl('/api/medications'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Cache-Control': 'no-store, no-cache',
            'Pragma': 'no-cache'
          },
          body: JSON.stringify(updatedLog)
        });
      } catch (e) {}
    }
  }

  // --- INVENTORY ACTIONS ---

  async addInventoryItem(itemData) {
    const newItem = {
      id: 'inv_' + Date.now().toString(36),
      quantity: 0,
      minThreshold: 10,
      cost: 0,
      controlled: false,
      ...itemData
    };

    try {
      await fetch(this.getApiUrl('/api/inventory'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-store, no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify(newItem)
      });
    } catch (e) {}

    await this.mutate(s => {
      s.inventory.unshift(newItem);
    }, 'inventory:added', newItem);

    return newItem;
  }

  async adjustInventory(itemId, qtyDelta, type = 'Adjustment', notes = '') {
    let targetItem = null;
    await this.mutate(s => {
      const item = s.inventory.find(i => i.id === itemId);
      if (item) {
        item.quantity = Math.max(0, item.quantity + qtyDelta);
        targetItem = item;

        const tx = {
          id: 'tx_' + Date.now(),
          itemId,
          itemName: item.name,
          type,
          quantity: qtyDelta,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          user: s.currentUser ? s.currentUser.name : 'Staff',
          notes
        };
        s.inventoryTransactions.unshift(tx);
      }
    }, 'inventory:adjusted', { itemId, qtyDelta, type });

    if (targetItem) {
      try {
        await fetch(this.getApiUrl('/api/inventory'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Cache-Control': 'no-store, no-cache',
            'Pragma': 'no-cache'
          },
          body: JSON.stringify(targetItem)
        });
      } catch (e) {}
    }
  }

  // --- TIMETABLE ACTIONS ---

  async updateTimetable(timetableList) {
    await this.mutate(s => {
      s.timetable = timetableList;
    }, 'timetable:updated', timetableList);

    try {
      await fetch(this.getApiUrl('/api/timetable'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-store, no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify(this.state.timetable)
      });
    } catch (e) {}
    return true;
  }

  // --- FACILITY ACTIONS ---

  async updateFacility(facilityUpdates) {
    await this.mutate(s => {
      s.facility = { ...s.facility, ...facilityUpdates };
    }, 'facility:updated', facilityUpdates);
    return this.state.facility;
  }

  // Reset to clean initial production state
  resetToDefaults() {
    try {
      localStorage.removeItem('serenitycare_prod_v2');
      sessionStorage.clear();
    } catch (e) {}
    this.state = JSON.parse(JSON.stringify(INITIAL_STATE));
    this.saveState(this.state, true);
    this.emit('state:changed', { reset: true });
  }
}

// Global Singleton Instance
window.AppStore = new ReactiveStore();
