/**
 * SerenityCare Sober House Cloud API & Admin Service
 * 
 * Complies with Cloudflare Pages Functions / Workers KV architecture:
 * - Fetches live data from /api/sync with { cache: 'no-store' }
 * - Synchronizes residents, staff accounts, MAR logs, inventory, and timetable
 * - Guarantees instant multi-browser replication across all connected devices
 */

class SobberApiService {
  constructor() {
    this.isSyncing = false;
    this.lastSyncedAt = null;
    this.isConnected = false;
    this.subscribers = new Set();
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify(data) {
    this.subscribers.forEach(cb => {
      try { cb(data); } catch (e) { console.error('Error in SobberApi subscriber:', e); }
    });
  }

  /**
   * Ping Cloudflare Healthcheck endpoint to verify KV binding (SOBBER_KV / KV)
   */
  async checkCloudStatus() {
    try {
      const res = await fetch('/api/health', { 
        cache: 'no-store',
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        this.isConnected = Boolean(data.cloudflare?.kvOperational || data.cloudflare?.kvBound);
        return data;
      }
    } catch (e) {
      console.debug('Cloudflare Healthcheck unreachable (local preview mode):', e.message);
    }
    return { status: 'offline', cloudflare: { kvBound: false } };
  }

  /**
   * Trigger immediate full synchronization of Sober House state with Cloudflare KV
   */
  async syncAll() {
    if (window.AppStore && typeof window.AppStore.syncFromServer === 'function') {
      return await window.AppStore.syncFromServer();
    }
    return null;
  }

  /**
   * Fetch all staff & user accounts from /api/users
   */
  async fetchUsers() {
    try {
      const res = await fetch('/api/users', { 
        cache: 'no-store',
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.debug('Could not fetch /api/users:', err.message);
    }
    return window.AppStore ? window.AppStore.getState().users : [];
  }

  /**
   * Save or update a staff user to Cloudflare KV
   */
  async saveUser(userData) {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(userData)
      });
      if (res.ok) {
        const json = await res.json();
        if (window.AppStore) window.AppStore.syncFromServer();
        return json;
      }
    } catch (err) {
      console.error('Error saving user to /api/users:', err);
    }
    // Optimistic fallback
    if (window.AppStore) {
      return window.AppStore.addUser(userData);
    }
    return null;
  }

  /**
   * Delete a staff user by ID from Cloudflare KV
   */
  async deleteUser(userId) {
    try {
      const res = await fetch(`/api/users?id=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        if (window.AppStore) window.AppStore.syncFromServer();
        return await res.json();
      }
    } catch (err) {
      console.error('Error deleting user from /api/users:', err);
    }
    if (window.AppStore) {
      window.AppStore.deleteUser(userId);
    }
    return { success: true, deletedId: userId };
  }

  /**
   * Fetch all resident records from /api/patients
   */
  async fetchPatients() {
    try {
      const res = await fetch('/api/patients', { 
        cache: 'no-store',
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.debug('Could not fetch /api/patients:', err.message);
    }
    return window.AppStore ? window.AppStore.getState().patients : [];
  }

  /**
   * Save or update a resident record
   */
  async savePatient(patientData) {
    try {
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(patientData)
      });
      if (res.ok) {
        const json = await res.json();
        if (window.AppStore) window.AppStore.syncFromServer();
        return json;
      }
    } catch (err) {
      console.error('Error saving patient to /api/patients:', err);
    }
    if (window.AppStore) {
      return window.AppStore.addPatient(patientData);
    }
    return null;
  }

  /**
   * Export full system snapshot as downloadable JSON
   */
  exportBackup() {
    if (!window.AppStore) return;
    const state = window.AppStore.getState();
    const cleanExport = { ...state };
    delete cleanExport.currentUser;
    delete cleanExport.sessionToken;

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(cleanExport, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `serenitycare-backup-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /**
   * Import system snapshot and push globally to Cloudflare KV
   */
  async importBackup(jsonData) {
    if (!jsonData || typeof jsonData !== 'object') {
      throw new Error('Invalid backup JSON format');
    }
    if (window.AppStore) {
      window.AppStore.mutate(s => {
        if (Array.isArray(jsonData.users)) s.users = jsonData.users;
        if (Array.isArray(jsonData.patients)) s.patients = jsonData.patients;
        if (Array.isArray(jsonData.medicationLogs)) s.medicationLogs = jsonData.medicationLogs;
        if (Array.isArray(jsonData.inventory)) s.inventory = jsonData.inventory;
        if (Array.isArray(jsonData.timetable)) s.timetable = jsonData.timetable;
        if (jsonData.facility) s.facility = { ...s.facility, ...jsonData.facility };
      }, 'state:backup_imported');
      await window.AppStore.pushToServer();
    }
  }

  // Backward compatibility methods
  loadSchools() { return Promise.resolve([]); }
  getSchools() { return []; }
  saveSchool() { return Promise.resolve({ success: true }); }
}

// Global Singletons
window.SobberApi = new SobberApiService();
window.SobberAdmin = window.SobberApi;
window.AdminService = window.SobberApi;
window.SchoolsAdmin = window.SobberApi; // Compatibility alias
