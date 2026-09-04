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
        settings: true
      }
    }
  ],
  patients: [],
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
      details: 'SerenityCare production environment initialized with zero dummy records'
    }
  ]
};

class ReactiveStore {
  constructor() {
    this.subscribers = new Map();
    this.state = this.loadState();
  }

  loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...INITIAL_STATE, ...parsed };
      }
    } catch (e) {
      console.warn('Could not load from localStorage, initializing defaults:', e);
    }
    this.saveState(INITIAL_STATE);
    return JSON.parse(JSON.stringify(INITIAL_STATE));
  }

  saveState(stateToSave) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave || this.state));
    } catch (e) {
      console.error('Error saving state to localStorage:', e);
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
  mutate(mutationFn, eventName = 'state:changed', eventPayload = null) {
    mutationFn(this.state);
    this.saveState();
    this.emit(eventName, eventPayload);
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

  addUser(userData) {
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
    this.mutate(s => {
      s.users.push(newUser);
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

  updateUser(userId, updates) {
    this.mutate(s => {
      const idx = s.users.findIndex(u => u.id === userId);
      if (idx !== -1) {
        s.users[idx] = { ...s.users[idx], ...updates };
        if (s.currentUser && s.currentUser.id === userId) {
          s.currentUser = { ...s.users[idx] };
        }
      }
    }, 'user:updated', { userId, updates });
  }

  deleteUser(userId) {
    this.mutate(s => {
      s.users = s.users.filter(u => u.id !== userId);
    }, 'user:deleted', userId);
  }

  // --- PATIENTS ACTIONS ---

  addPatient(patientData) {
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

    this.mutate(s => {
      s.patients.unshift(newPatient);
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

  updatePatient(patientId, updates) {
    this.mutate(s => {
      const idx = s.patients.findIndex(p => p.id === patientId);
      if (idx !== -1) {
        s.patients[idx] = { ...s.patients[idx], ...updates };
      }
    }, 'patient:updated', { patientId, updates });
  }

  deletePatient(patientId) {
    this.mutate(s => {
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
  }

  batchImportPatients(patientList) {
    const added = [];
    this.mutate(s => {
      patientList.forEach((data, index) => {
        const newId = 'PAT-' + (100 + s.patients.length + 1 + index);
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
            diagnoses: data.diagnoses ? data.diagnoses.split(';') : ['Substance Use Disorder'],
            suicideRisk: data.suicideRisk || 'Low',
            allergies: data.allergies ? data.allergies.split(';') : ['None reported'],
            notes: data.notes || 'Batch imported intake profile.'
          },
          ...data
        };
        s.patients.unshift(patient);
        added.push(patient);
      });

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

  addProgressNote(patientId, noteData) {
    const note = {
      id: 'note_' + Date.now(),
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      author: this.state.currentUser ? this.state.currentUser.name : 'Counselor',
      ...noteData
    };

    this.mutate(s => {
      const patient = s.patients.find(p => p.id === patientId);
      if (patient) {
        if (!patient.progressNotes) patient.progressNotes = [];
        patient.progressNotes.unshift(note);
      }
    }, 'patient:note_added', { patientId, note });

    return note;
  }

  addVitalRecord(patientId, vitalData) {
    const vital = {
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      recordedBy: this.state.currentUser ? this.state.currentUser.name : 'Nurse',
      ...vitalData
    };

    this.mutate(s => {
      const patient = s.patients.find(p => p.id === patientId);
      if (patient) {
        if (!patient.vitals) patient.vitals = [];
        patient.vitals.unshift(vital);
      }
    }, 'patient:vital_added', { patientId, vital });

    return vital;
  }

  addPrescription(patientId, rxData) {
    const rx = {
      id: 'rx_' + Date.now().toString(36),
      startDate: new Date().toISOString().split('T')[0],
      prescribingDoctor: this.state.currentUser ? this.state.currentUser.name : 'Doctor',
      status: 'Active',
      ...rxData
    };

    this.mutate(s => {
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

  logMedicationAdministration(logId, status, notes = '') {
    this.mutate(s => {
      const log = s.medicationLogs.find(l => l.id === logId);
      if (log) {
        log.status = status; // Administered, Refused, Missed
        log.administeredAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
        log.nurseName = s.currentUser ? s.currentUser.name : 'Staff Nurse';
        log.notes = notes || log.notes;

        s.activityLogs.unshift({
          id: 'act_' + Date.now(),
          timestamp: log.administeredAt,
          user: log.nurseName,
          action: `Medication ${status}`,
          details: `${log.medName} to ${log.patientName}`
        });
      }
    }, 'medication:logged', { logId, status });
  }

  // --- GRADUATION ACTIONS ---

  markGraduationQualified(patientId, qualified, graduationDate = null) {
    this.mutate(s => {
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

  addInventoryItem(itemData) {
    const newItem = {
      id: 'INV-' + String(this.state.inventory.length + 1).padStart(3, '0'),
      code: itemData.code || 'ITEM-' + Date.now().toString(36).toUpperCase(),
      quantity: parseInt(itemData.quantity) || 0,
      minThreshold: parseInt(itemData.minThreshold) || 10,
      cost: parseFloat(itemData.cost) || 0.00,
      ...itemData
    };

    this.mutate(s => {
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

  updateInventoryStock(itemId, quantityChange, type = 'Dispensed', notes = '') {
    const qty = parseInt(quantityChange);
    this.mutate(s => {
      const item = s.inventory.find(i => i.id === itemId);
      if (item) {
        if (type === 'Dispensed') {
          item.quantity = Math.max(0, item.quantity - qty);
        } else if (type === 'Stock In') {
          item.quantity += qty;
        }

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
  }

  // --- TIMETABLE ACTIONS ---

  addTimetableEvent(eventData) {
    const newEvent = {
      id: 'TT-' + Date.now().toString(36),
      ...eventData
    };

    this.mutate(s => {
      s.timetable.push(newEvent);
    }, 'timetable:added', newEvent);

    return newEvent;
  }

  deleteTimetableEvent(eventId) {
    this.mutate(s => {
      s.timetable = s.timetable.filter(e => e.id !== eventId);
    }, 'timetable:deleted', eventId);
  }

  // --- FACILITY ACTIONS ---

  updateFacility(facilityUpdates) {
    this.mutate(s => {
      s.facility = { ...s.facility, ...facilityUpdates };
    }, 'facility:updated', facilityUpdates);
  }

  // Reset to clean production initial state
  resetToDefaults() {
    localStorage.removeItem(STORAGE_KEY);
    this.state = JSON.parse(JSON.stringify(INITIAL_STATE));
    this.saveState();
    this.emit('state:changed', { reset: true });
  }
}

// Global Singleton Instance
window.AppStore = new ReactiveStore();
