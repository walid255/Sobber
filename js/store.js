/**
 * SerenityCare Global Reactive State Store (Production Ready)
 * Implements Observer pattern with LocalStorage persistence and Cloudflare sync hook.
 * Guarantees that any update by a user immediately triggers global UI updates.
 */

const STORAGE_KEY = 'serenitycare_prod_v2';

// Clean Initial State for Production Deployment
const INITIAL_STATE = {
  facility: {
    name: 'SerenityCare Sober House & Recovery Center',
    licenseNumber: 'SH-84920-CLINICAL',
    address: '742 Hope Valley Road, Building B, Austin, TX 78701',
    phone: '+1 (800) 555-7623',
    email: 'admissions@serenitycare.org',
    director: 'Dr. Evelyn Vance, MD, FASAM',
    leadCounselor: 'Marcus Sterling, MSW, LCDC',
    totalBeds: 32,
    currency: 'TZS',
    logoUrl: 'assets/logo.svg',
    faviconUrl: 'assets/favicon.svg'
  },
  currency: 'TZS',
  currentUser: null, // Unauthenticated on initial load
  sessionToken: null,
  users: [
    {
      id: 'usr_admin',
      name: 'System Administrator',
      email: 'admin@serenitycare.org',
      password: 'Admin@Serenity2026!', // Initial production administrative password
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
        settings: true,
        payments: true
      }
    }
  ],
  patients: [],
  medicationLogs: [],
  inventory: [],
  inventoryTransactions: [],
  timetable: [],
  payments: [],
  reminders: [],
  activityLogs: [
    {
      id: 'act_init',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      user: 'System',
      action: 'Production Ready',
      details: 'SerenityCare production environment initialized with zero dummy records'
    }
  ]
};

class ReactiveStore {
  constructor() {
    this.subscribers = new Map();
    this.state = this.loadState();
    this.isSyncing = false;
    this.lastSyncedAt = null;
    this.isCloudConnected = false;

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

    // Immediate Cloudflare Workers KV synchronization
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
        if (now - lastTouchSync > 4000) {
          lastTouchSync = now;
          this.syncFromServer();
        }
      }, { passive: true });
      // Rapid background heartbeat sync every 3 seconds for instant multi-device replication
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

  getAuthHeaders(customHeaders = {}) {
    const headers = { ...customHeaders };
    let secret = '';
    try {
      secret = (typeof localStorage !== 'undefined' && localStorage.getItem('sobber_admin_secret')) ||
               (typeof window !== 'undefined' && window.SOBBER_ADMIN_SECRET) || '';
    } catch (e) {}
    if (secret && secret.trim()) {
      headers['Authorization'] = `Bearer ${secret.trim()}`;
    }
    return headers;
  }

  loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const merged = { ...INITIAL_STATE, ...parsed };
        if (!Array.isArray(merged.payments)) merged.payments = [];
        // Ensure admin user always retains payments permission
        if (Array.isArray(merged.users)) {
          const admin = merged.users.find(u => u.role === 'admin');
          if (admin) {
            admin.permissions = admin.permissions || {};
            if (typeof admin.permissions.payments === 'undefined') admin.permissions.payments = true;
          }
        }
        return merged;
      }
    } catch (e) {
      console.warn('Could not load from localStorage, initializing defaults:', e);
    }
    this.saveState(INITIAL_STATE, false);
    return JSON.parse(JSON.stringify(INITIAL_STATE));
  }

  saveState(stateToSave, syncToCloud = true) {
    const currentState = stateToSave || this.state;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
    } catch (e) {
      console.error('Error saving state to localStorage:', e);
    }

    if (syncToCloud) {
      return this.pushToServer(currentState);
    }
    return Promise.resolve({ success: true, localOnly: true });
  }

  /**
   * Fetch live global state from Cloudflare KV endpoint
   * Guarantees all browsers and mobile devices see updates immediately
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
          if (remote.online === false || remote.error) {
            this.isCloudConnected = false;
            this.cloudError = remote.message || remote.error || 'KV namespace binding missing';
            this.emit('sync:error', { error: this.cloudError });
          } else if (Array.isArray(remote.users)) {
            this.isCloudConnected = true;
            this.cloudError = null;
            this.applyRemoteState(remote, true);
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
   * Apply remote state received from Cloudflare Workers KV
   */
  applyRemoteState(remoteState, saveToLocal = true) {
    if (!remoteState || !Array.isArray(remoteState.users)) return;

    // Check version timestamp to ensure monotonic updates
    if (remoteState.stateVersion && this.state.stateVersion && remoteState.stateVersion < this.state.stateVersion) {
      // Remote is older than our local state, don't overwrite with stale replica
      return;
    }

    const currentUserId = this.state.currentUser ? this.state.currentUser.id : null;

    // Merge collections
    this.state.users = remoteState.users;
    if (remoteState.patients) this.state.patients = remoteState.patients;
    if (remoteState.medicationLogs) this.state.medicationLogs = remoteState.medicationLogs;
    if (remoteState.inventory) this.state.inventory = remoteState.inventory;
    if (remoteState.inventoryTransactions) this.state.inventoryTransactions = remoteState.inventoryTransactions;
    if (remoteState.timetable) this.state.timetable = remoteState.timetable;
    if (remoteState.payments) this.state.payments = remoteState.payments;
    if (remoteState.reminders) this.state.reminders = remoteState.reminders;
    if (remoteState.facility) {
      this.state.facility = { ...this.state.facility, ...remoteState.facility };
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
    }

    this.lastSyncedAt = remoteState.lastSyncedAt || new Date().toISOString();

    if (saveToLocal) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (e) {}
    }

    this.emit('state:changed', this.state);
    this.emit('sync:updated', { timestamp: this.lastSyncedAt, version: this.state.stateVersion });
  }

  /**
   * Push state to Cloudflare KV storage
   */
  async pushToServer(stateToPush) {
    const payload = stateToPush || this.state;
    payload.lastSyncedAt = new Date().toISOString();
    payload.stateVersion = Date.now();

    // Instant local broadcast to other tabs
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: 'STATE_UPDATED', state: payload });
      } catch (e) {}
    }

    try {
      const url = this.getApiUrl('/api/sync');
      const res = await fetch(url, {
        method: 'POST',
        headers: this.getAuthHeaders({
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache'
        }),
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

  /**
   * Subscribe to state changes or specific events
   */
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

  /**
   * Emit event to all registered listeners
   */
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

    // Always emit the global state:changed event on mutations
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
   * Mutate state and broadcast globally
   */
  async mutate(mutationFn, eventName = 'state:changed', eventPayload = null) {
    mutationFn(this.state);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {}
    this.emit(eventName, eventPayload);
    return await this.pushToServer(this.state);
  }

  // --- AUTH ACTIONS ---

  loginUser(email, password) {
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

    // Direct write to /api/users
    try {
      await fetch(this.getApiUrl('/api/users'), {
        method: 'POST',
        headers: this.getAuthHeaders({
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-store, no-cache',
          'Pragma': 'no-cache'
        }),
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
          headers: this.getAuthHeaders({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Cache-Control': 'no-store, no-cache',
            'Pragma': 'no-cache'
          }),
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
        headers: this.getAuthHeaders({
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-store, no-cache',
          'Pragma': 'no-cache'
        })
      });
    } catch (e) {}
    return true;
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

    try {
      await fetch(this.getApiUrl('/api/patients'), {
        method: 'POST',
        headers: this.getAuthHeaders({
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-store, no-cache',
          'Pragma': 'no-cache'
        }),
        body: JSON.stringify(newPatient)
      });
    } catch (e) {
      console.warn('Direct /api/patients write failed, continuing with full sync:', e);
    }

    await this.mutate(s => {
      const exists = s.patients.some(p => p.id === newPatient.id);
      if (!exists) s.patients.unshift(newPatient);
      s.activityLogs.unshift({
        id: 'act_' + Date.now(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        user: s.currentUser ? s.currentUser.name : 'Staff',
        action: 'Admitted Patient',
        details: `${newPatient.name} (${newPatient.id})`
      });
    }, 'patient:added', newPatient);

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
          headers: this.getAuthHeaders({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Cache-Control': 'no-store, no-cache',
            'Pragma': 'no-cache'
          }),
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
      // Remove any pending MAR logs for this patient
      s.medicationLogs = s.medicationLogs.filter(l => l.patientId !== patientId);

      if (patient) {
        s.activityLogs.unshift({
          id: 'act_' + Date.now(),
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          user: s.currentUser ? s.currentUser.name : 'Admin',
          action: 'Deleted Patient Record',
          details: `${patient.name} (${patient.id}) permanently removed`
        });
      }
    }, 'patient:deleted', patientId);

    try {
      await fetch(this.getApiUrl(`/api/patients?id=${encodeURIComponent(patientId)}`), {
        method: 'DELETE',
        headers: this.getAuthHeaders({
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-store, no-cache',
          'Pragma': 'no-cache'
        })
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
        photo: data.photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=80',
        nextOfKin: data.nextOfKin || {
          name: data.nok_name || 'Not Provided',
          relationship: data.nok_rel || 'Relative',
          phone: data.nok_phone || '',
          email: '',
          address: '',
          emergencyConsent: true
        },
        psychiatricHistory: data.psychiatricHistory || {
          primarySubstance: data.primarySubstance || 'Alcohol',
          secondarySubstance: data.secondarySubstance || 'None',
          addictionDurationYears: parseInt(data.addictionYears) || 1,
          priorRehabs: parseInt(data.priorRehabs) || 0,
          diagnoses: data.diagnoses ? (Array.isArray(data.diagnoses) ? data.diagnoses : data.diagnoses.split(';')) : ['Substance Use Disorder'],
          suicideRisk: data.suicideRisk || 'Low',
          allergies: data.allergies ? (Array.isArray(data.allergies) ? data.allergies : data.allergies.split(';')) : ['None reported'],
          notes: data.notes || 'Batch imported intake profile.'
        },
        ...data
      };
      added.push(patient);
    });

    try {
      await fetch(this.getApiUrl('/api/patients'), {
        method: 'POST',
        headers: this.getAuthHeaders({
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-store, no-cache',
          'Pragma': 'no-cache'
        }),
        body: JSON.stringify(added)
      });
    } catch (e) {}

    await this.mutate(s => {
      added.forEach(p => s.patients.unshift(p));
      s.activityLogs.unshift({
        id: 'act_' + Date.now(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        user: s.currentUser ? s.currentUser.name : 'Admin',
        action: 'Batch Imported Patients',
        details: `Imported ${added.length} patient records from CSV`
      });
    }, 'patients:batch_imported', added);

    return added;
  }

  async addProgressNote(patientId, noteData) {
    const note = {
      id: 'note_' + Date.now(),
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      author: this.state.currentUser ? this.state.currentUser.name : 'Counselor',
      ...noteData
    };

    await this.mutate(s => {
      const patient = s.patients.find(p => p.id === patientId);
      if (patient) {
        if (!patient.progressNotes) patient.progressNotes = [];
        patient.progressNotes.unshift(note);
      }
    }, 'patient:note_added', { patientId, note });

    return note;
  }

  async addVitalRecord(patientId, vitalData) {
    const vital = {
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      recordedBy: this.state.currentUser ? this.state.currentUser.name : 'Nurse',
      ...vitalData
    };

    await this.mutate(s => {
      const patient = s.patients.find(p => p.id === patientId);
      if (patient) {
        if (!patient.vitals) patient.vitals = [];
        patient.vitals.unshift(vital);
      }
    }, 'patient:vital_added', { patientId, vital });

    return vital;
  }

  async addPrescription(patientId, rxData) {
    const rx = {
      id: 'rx_' + Date.now().toString(36),
      startDate: new Date().toISOString().split('T')[0],
      prescribingDoctor: this.state.currentUser ? this.state.currentUser.name : 'Doctor',
      status: 'Active',
      ...rxData
    };

    await this.mutate(s => {
      const patient = s.patients.find(p => p.id === patientId);
      if (patient) {
        if (!patient.prescriptions) patient.prescriptions = [];
        patient.prescriptions.push(rx);

        // Schedule MAR logs for today
        if (rx.times && rx.times.length > 0) {
          rx.times.forEach(t => {
            s.medicationLogs.push({
              id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
              patientId: patient.id,
              patientName: patient.name,
              prescriptionId: rx.id,
              medName: `${rx.medicationName} ${rx.dosage}`,
              scheduledTime: t,
              status: 'Pending',
              administeredAt: null,
              nurseName: null,
              notes: rx.instructions || 'Scheduled dose'
            });
          });
        }
      }
    }, 'prescription:added', { patientId, rx });

    return rx;
  }

  // --- MEDICATION MAR ACTIONS ---

  async logMedicationAdministration(logId, status, notes = '') {
    let updatedLog = null;
    await this.mutate(s => {
      const log = s.medicationLogs.find(l => l.id === logId);
      if (log) {
        log.status = status; // Administered, Refused, Missed
        log.administeredAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
        log.nurseName = s.currentUser ? s.currentUser.name : 'Staff Nurse';
        log.notes = notes || log.notes;
        updatedLog = { ...log };

        s.activityLogs.unshift({
          id: 'act_' + Date.now(),
          timestamp: log.administeredAt,
          user: log.nurseName,
          action: `Medication ${status}`,
          details: `${log.medName} to ${log.patientName}`
        });
      }
    }, 'medication:logged', { logId, status });

    if (updatedLog) {
      try {
        await fetch(this.getApiUrl('/api/medications'), {
          method: 'POST',
          headers: this.getAuthHeaders({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Cache-Control': 'no-store, no-cache',
            'Pragma': 'no-cache'
          }),
          body: JSON.stringify(updatedLog)
        });
      } catch (e) {}
    }
    return updatedLog;
  }

  // --- GRADUATION ACTIONS ---

  async markGraduationQualified(patientId, qualified, graduationDate = null) {
    await this.mutate(s => {
      const patient = s.patients.find(p => p.id === patientId);
      if (patient) {
        patient.graduationQualified = qualified;
        patient.graduationDate = graduationDate || (qualified ? new Date().toISOString().split('T')[0] : null);
        if (qualified) {
          patient.stage = 'Graduated';
        }

        s.activityLogs.unshift({
          id: 'act_' + Date.now(),
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          user: s.currentUser ? s.currentUser.name : 'Director',
          action: qualified ? 'Marked Qualified for Graduation' : 'Revoked Graduation Status',
          details: `${patient.name} (${patient.id})`
        });
      }
    }, 'patient:graduation_qualified', { patientId, qualified });
  }

  // --- INVENTORY ACTIONS ---

  async addInventoryItem(itemData) {
    const newItem = {
      id: 'INV-' + String(this.state.inventory.length + 1).padStart(3, '0'),
      code: itemData.code || 'ITEM-' + Date.now().toString(36).toUpperCase(),
      quantity: parseInt(itemData.quantity) || 0,
      minThreshold: parseInt(itemData.minThreshold) || 10,
      cost: parseFloat(itemData.cost) || 0.00,
      ...itemData
    };

    try {
      await fetch(this.getApiUrl('/api/inventory'), {
        method: 'POST',
        headers: this.getAuthHeaders({
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-store, no-cache',
          'Pragma': 'no-cache'
        }),
        body: JSON.stringify(newItem)
      });
    } catch (e) {}

    await this.mutate(s => {
      s.inventory.push(newItem);
      s.inventoryTransactions.unshift({
        id: 'TX-' + Date.now(),
        itemId: newItem.id,
        itemName: newItem.name,
        type: 'Stock In',
        quantity: newItem.quantity,
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        user: s.currentUser ? s.currentUser.name : 'Store Manager',
        notes: 'Initial inventory registration'
      });
    }, 'inventory:added', newItem);

    return newItem;
  }

  async updateInventoryStock(itemId, quantityChange, type = 'Dispensed', notes = '') {
    const qty = parseInt(quantityChange);
    let updatedItem = null;
    await this.mutate(s => {
      const item = s.inventory.find(i => i.id === itemId);
      if (item) {
        if (type === 'Dispensed') {
          item.quantity = Math.max(0, item.quantity - qty);
        } else if (type === 'Stock In') {
          item.quantity += qty;
        }
        updatedItem = { ...item };

        s.inventoryTransactions.unshift({
          id: 'TX-' + Date.now(),
          itemId: item.id,
          itemName: item.name,
          type: type,
          quantity: qty,
          date: new Date().toISOString().replace('T', ' ').substring(0, 16),
          user: s.currentUser ? s.currentUser.name : 'Store Staff',
          notes: notes || `${type} ${qty} ${item.unit}`
        });
      }
    }, 'inventory:updated', { itemId, quantityChange, type });

    if (updatedItem) {
      try {
        await fetch(this.getApiUrl('/api/inventory'), {
          method: 'POST',
          headers: this.getAuthHeaders({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Cache-Control': 'no-store, no-cache',
            'Pragma': 'no-cache'
          }),
          body: JSON.stringify(updatedItem)
        });
      } catch (e) {}
    }
    return updatedItem;
  }

  // --- TIMETABLE ACTIONS ---

  async addTimetableEvent(eventData) {
    const newEvent = {
      id: 'TT-' + Date.now().toString(36),
      ...eventData
    };

    await this.mutate(s => {
      s.timetable.push(newEvent);
    }, 'timetable:added', newEvent);

    try {
      await fetch(this.getApiUrl('/api/timetable'), {
        method: 'POST',
        headers: this.getAuthHeaders({
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-store, no-cache',
          'Pragma': 'no-cache'
        }),
        body: JSON.stringify(this.state.timetable)
      });
    } catch (e) {}

    return newEvent;
  }

  async deleteTimetableEvent(eventId) {
    await this.mutate(s => {
      s.timetable = s.timetable.filter(e => e.id !== eventId);
    }, 'timetable:deleted', eventId);

    try {
      await fetch(this.getApiUrl('/api/timetable'), {
        method: 'POST',
        headers: this.getAuthHeaders({
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-store, no-cache',
          'Pragma': 'no-cache'
        }),
        body: JSON.stringify(this.state.timetable)
      });
  // --- BILLING & PAYMENTS ACTIONS (TZS) ---

  formatCurrency(amount) {
    return `${Number(amount || 0).toLocaleString()} TZS`;
  }

  getPayments() {
    return Array.isArray(this.state.payments) ? this.state.payments : [];
  }

  getPaymentById(paymentId) {
    return this.getPayments().find(p => p.id === paymentId) || null;
  }

  getPaymentsByPatientId(patientId) {
    return this.getPayments().filter(p => p.patientId === patientId);
  }

  calculatePaymentStatus(totalAmount, amountPaid, dueDate) {
    const total = Number(totalAmount) || 0;
    const paid = Number(amountPaid) || 0;
    if (paid >= total && total > 0) return 'Paid';
    if (paid > 0 && paid < total) return 'Partial';
    if (dueDate) {
      const due = new Date(dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (due < today) return 'Overdue';
    }
    return 'Pending';
  }

  async addPayment(paymentData) {
    const currentList = this.getPayments();
    const count = currentList.length + 1;
    const newId = 'PAY-' + (1000 + count);
    const now = new Date();
    const invoiceNo = `INV-${now.getFullYear()}-${String(count).padStart(4, '0')}`;
    const dateStr = paymentData.date || now.toISOString().split('T')[0];
    const dueStr = paymentData.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
    const total = Math.max(0, Number(paymentData.totalAmount) || 0);
    const paid = Math.max(0, Number(paymentData.amountPaid) || 0);
    const balance = Math.max(0, total - paid);
    const status = paymentData.status || this.calculatePaymentStatus(total, paid, dueStr);

    const initialInstallments = [];
    if (paid > 0) {
      initialInstallments.push({
        id: 'INST-' + newId + '-1',
        date: dateStr,
        amount: paid,
        paymentMethod: paymentData.paymentMethod || 'Cash',
        referenceNo: paymentData.referenceNo || 'INITIAL-' + Date.now().toString().slice(-6),
        recordedBy: this.state.currentUser ? this.state.currentUser.name : 'Clinical Staff',
        notes: paymentData.notes || 'Initial Payment / Deposit'
      });
    }

    const newPayment = {
      id: newId,
      invoiceNumber: invoiceNo,
      patientId: paymentData.patientId || null,
      patientName: paymentData.patientName || 'General Facility Fee',
      category: paymentData.category || 'Admission Fee',
      description: paymentData.description || 'Facility service and care charge',
      totalAmount: total,
      amountPaid: paid,
      balance: balance,
      status: status,
      paymentMethod: paymentData.paymentMethod || 'M-Pesa',
      referenceNo: paymentData.referenceNo || '',
      payerName: paymentData.payerName || '',
      payerPhone: paymentData.payerPhone || '',
      date: dateStr,
      dueDate: dueStr,
      recordedBy: this.state.currentUser ? this.state.currentUser.name : 'Clinical Staff',
      notes: paymentData.notes || '',
      installments: initialInstallments,
      ...paymentData,
      id: newId,
      invoiceNumber: invoiceNo,
      totalAmount: total,
      amountPaid: paid,
      balance: balance,
      status: status,
      installments: initialInstallments
    };

    try {
      await fetch(this.getApiUrl('/api/payments'), {
        method: 'POST',
        headers: this.getAuthHeaders({
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-store, no-cache',
          'Pragma': 'no-cache'
        }),
        body: JSON.stringify(newPayment)
      });
    } catch (e) {
      console.warn('Direct /api/payments write failed, proceeding with local reactive mutation:', e);
    }

    await this.mutate(s => {
      if (!Array.isArray(s.payments)) s.payments = [];
      s.payments.unshift(newPayment);
      s.activityLogs.unshift({
        id: 'act_' + Date.now(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        user: s.currentUser ? s.currentUser.name : 'Staff',
        action: 'Recorded Payment / Invoice',
        details: `${newPayment.invoiceNumber}: ${newPayment.patientName} (${this.formatCurrency(newPayment.totalAmount)}) via ${newPayment.paymentMethod}`
      });
    }, 'payment:added', newPayment);

    return newPayment;
  }

  async recordPaymentInstallment(paymentId, installmentData) {
    let updatedPayment = null;
    const amount = Math.max(0, Number(installmentData.amount) || 0);

    await this.mutate(s => {
      if (!Array.isArray(s.payments)) s.payments = [];
      const idx = s.payments.findIndex(p => p.id === paymentId);
      if (idx !== -1) {
        const p = s.payments[idx];
        const newPaid = p.amountPaid + amount;
        const newBalance = Math.max(0, p.totalAmount - newPaid);
        const newStatus = this.calculatePaymentStatus(p.totalAmount, newPaid, p.dueDate);
        const instList = Array.isArray(p.installments) ? [...p.installments] : [];

        const newInstallment = {
          id: 'INST-' + p.id + '-' + (instList.length + 1),
          date: installmentData.date || new Date().toISOString().split('T')[0],
          amount: amount,
          paymentMethod: installmentData.paymentMethod || p.paymentMethod || 'M-Pesa',
          referenceNo: installmentData.referenceNo || '',
          recordedBy: s.currentUser ? s.currentUser.name : 'Staff',
          notes: installmentData.notes || ''
        };
        instList.push(newInstallment);

        s.payments[idx] = {
          ...p,
          amountPaid: newPaid,
          balance: newBalance,
          status: newStatus,
          paymentMethod: installmentData.paymentMethod || p.paymentMethod,
          referenceNo: installmentData.referenceNo || p.referenceNo,
          installments: instList
        };
        updatedPayment = s.payments[idx];

        s.activityLogs.unshift({
          id: 'act_' + Date.now(),
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          user: s.currentUser ? s.currentUser.name : 'Staff',
          action: 'Recorded Payment Installment',
          details: `${p.invoiceNumber}: ${p.patientName} +${this.formatCurrency(amount)} via ${installmentData.paymentMethod || p.paymentMethod}`
        });
      }
    }, 'payment:installment_added', { paymentId, installmentData });

    if (updatedPayment) {
      try {
        await fetch(this.getApiUrl('/api/payments'), {
          method: 'POST',
          headers: this.getAuthHeaders({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Cache-Control': 'no-store, no-cache',
            'Pragma': 'no-cache'
          }),
          body: JSON.stringify(updatedPayment)
        });
      } catch (e) {}
    }

    return updatedPayment;
  }

  async updatePayment(paymentId, updates) {
    let updated = null;
    await this.mutate(s => {
      if (!Array.isArray(s.payments)) s.payments = [];
      const idx = s.payments.findIndex(p => p.id === paymentId);
      if (idx !== -1) {
        const merged = { ...s.payments[idx], ...updates };
        const total = Math.max(0, Number(merged.totalAmount) || 0);
        const paid = Math.max(0, Number(merged.amountPaid) || 0);
        merged.totalAmount = total;
        merged.amountPaid = paid;
        merged.balance = Math.max(0, total - paid);
        merged.status = updates.status || this.calculatePaymentStatus(total, paid, merged.dueDate);
        s.payments[idx] = merged;
        updated = merged;
      }
    }, 'payment:updated', { paymentId, updates });

    if (updated) {
      try {
        await fetch(this.getApiUrl('/api/payments'), {
          method: 'POST',
          headers: this.getAuthHeaders({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Cache-Control': 'no-store, no-cache',
            'Pragma': 'no-cache'
          }),
          body: JSON.stringify(updated)
        });
      } catch (e) {}
    }
    return updated;
  }

  async deletePayment(paymentId) {
    let deletedPayment = null;
    await this.mutate(s => {
      if (!Array.isArray(s.payments)) s.payments = [];
      deletedPayment = s.payments.find(p => p.id === paymentId);
      s.payments = s.payments.filter(p => p.id !== paymentId);

      if (deletedPayment) {
        s.activityLogs.unshift({
          id: 'act_' + Date.now(),
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          user: s.currentUser ? s.currentUser.name : 'Admin',
          action: 'Deleted Payment Record',
          details: `Invoice ${deletedPayment.invoiceNumber} (${deletedPayment.patientName} - ${this.formatCurrency(deletedPayment.totalAmount)}) removed`
        });
      }
    }, 'payment:deleted', paymentId);

    try {
      await fetch(this.getApiUrl(`/api/payments?id=${encodeURIComponent(paymentId)}`), {
        method: 'DELETE',
        headers: this.getAuthHeaders({
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-store, no-cache',
          'Pragma': 'no-cache'
        })
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

  // Reset to clean production initial state
  resetToDefaults() {
    localStorage.removeItem(STORAGE_KEY);
    this.state = JSON.parse(JSON.stringify(INITIAL_STATE));
    this.saveState();
    this.emit('state:changed', { reset: true });
  }

  /**
   * Global Content & KV Submission
   * Fulfills authenticated submission to Cloudflare KV at /api/content
   */
  async saveContent(newData) {
    try {
      let customEndpoint = '';
      let secret = '';
      try {
        customEndpoint = localStorage.getItem('sobber_cloud_endpoint') || '';
        secret = localStorage.getItem('sobber_admin_secret') || (typeof window !== 'undefined' && window.SOBBER_ADMIN_SECRET) || '';
      } catch (e) {}

      let base = '';
      if (customEndpoint && customEndpoint.trim().startsWith('http')) {
        base = customEndpoint.trim().replace(/\/+$/, '');
      }
      const sep = base.includes('?') ? '&' : '?';
      const url = `${base}/api/content${sep}_t=${Date.now()}`;

      const headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache"
      };
      if (secret && secret.trim()) {
        headers["Authorization"] = `Bearer ${secret.trim()}`;
      }

      const response = await fetch(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(newData)
      });

      if (!response.ok) {
        let errDetails = `HTTP ${response.status}`;
        try {
          const errJson = await response.json();
          errDetails = errJson.error || errJson.message || errDetails;
        } catch {
          const errText = await response.text().catch(() => '');
          if (errText) errDetails += ` - ${errText}`;
        }
        throw new Error(errDetails);
      }

      // Update local state/cache after successful save if state-compatible
      if (newData && typeof newData === 'object') {
        if (Array.isArray(newData.users) || Array.isArray(newData.patients) || newData.facility) {
          this.applyRemoteState(newData, true);
        }
      }
      console.log("Updated globally in KV");
      this.emit('content:saved', { data: newData, timestamp: new Date().toISOString() });
      return { success: true, message: "Updated globally in KV" };
    } catch (err) {
      console.error("Save failed:", err);
      throw err;
    }
  }

  /**
   * Global Content Retrieval from Cloudflare Workers KV
   * Fulfills client loading from /api/content
   */
  async loadContent() {
    try {
      let customEndpoint = '';
      try {
        customEndpoint = localStorage.getItem('sobber_cloud_endpoint') || '';
      } catch (e) {}

      let base = '';
      if (customEndpoint && customEndpoint.trim().startsWith('http')) {
        base = customEndpoint.trim().replace(/\/+$/, '');
      }
      const sep = base.includes('?') ? '&' : '?';
      const url = `${base}/api/content${sep}_t=${Date.now()}`;

      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load content from KV: HTTP ${response.status}`);
      }

      const data = await response.json();
      this.siteContent = data;

      // Render data in UI
      if (typeof window.renderApp === 'function') {
        window.renderApp(data);
      } else if (data && typeof data === 'object') {
        if (Array.isArray(data.users) || Array.isArray(data.patients) || data.facility) {
          this.applyRemoteState(data, true);
        }
      }

      this.emit('content:loaded', { data, timestamp: new Date().toISOString() });
      return data;
    } catch (err) {
      console.debug('loadContent failed, falling back to standard sync:', err.message);
      return null;
    }
  }
}

// Global Singleton Instance
window.AppStore = new ReactiveStore();

// Globally accessible submission helper
window.saveContent = async function(newData) {
  return await window.AppStore.saveContent(newData);
};

// Globally accessible loader helper
window.loadContent = async function() {
  return await window.AppStore.loadContent();
};


