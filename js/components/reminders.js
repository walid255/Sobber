/**
 * SerenityCare Real-Time Reminders & Medication Alerts System
 * Features Web Audio chime synthesizer, notification polling, and centered acceptance modal alerts.
 */

class ReminderDaemon {
  constructor() {
    this.store = window.AppStore;
    this.audioCtx = null;
    this.intervalId = null;
    this.lastTriggered = new Set();
    this.init();
  }

  init() {
    // Start periodic check every 25 seconds
    this.intervalId = setInterval(() => this.checkReminders(), 25000);

    // Initial check after 2 seconds
    setTimeout(() => this.checkReminders(), 2000);
  }

  /**
   * Generates a pleasant, soothing medical notification chime using the Web Audio API
   */
  playChime() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      
      if (!this.audioCtx) {
        this.audioCtx = new AudioContext();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      
      // Tone 1: 587.33 Hz (D5)
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.2, now + 0.05);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.6);

      // Tone 2: 880 Hz (A5) slightly delayed
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.0, now + 0.15);
      gain2.gain.setValueAtTime(0, now + 0.15);
      gain2.gain.linearRampToValueAtTime(0.25, now + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.85);

    } catch (e) {
      console.warn('Web Audio chime could not play:', e);
    }
  }

  /**
   * Polls pending medication logs and upcoming timetable events
   */
  checkReminders() {
    const state = this.store.getState();
    const pendingLogs = state.medicationLogs.filter(l => l.status === 'Pending');

    // Update header badge count
    this.updateNotificationBadge(pendingLogs.length);
  }

  updateNotificationBadge(count) {
    const badge = document.getElementById('reminder-bell-count');
    const pulseRing = document.getElementById('reminder-bell-pulse');
    if (badge) {
      badge.textContent = count;
      if (count > 0) {
        badge.classList.remove('hidden');
        if (pulseRing) pulseRing.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
        if (pulseRing) pulseRing.classList.add('hidden');
      }
    }
  }

  /**
   * Manually or automatically triggers an acceptance popup for an upcoming dose
   */
  triggerMedicationAlert(logId) {
    const state = this.store.getState();
    const log = state.medicationLogs.find(l => l.id === logId) || state.medicationLogs.find(l => l.status === 'Pending');

    if (!log) {
      window.AppModal.alert('No Pending Doses', 'All scheduled medication doses for today have been completed.', 'info');
      return;
    }

    const patient = state.patients.find(p => p.id === log.patientId);
    this.playChime();

    const contentHtml = `
      <div class="p-4 bg-teal-50/70 border border-teal-100 rounded-2xl mb-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold text-teal-700 uppercase tracking-wider">MAR Scheduled Dose</span>
          <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-200 text-teal-800">${log.scheduledTime} Window</span>
        </div>
        <div class="text-lg font-bold text-slate-900 mb-1">${log.medName}</div>
        <div class="text-sm text-slate-600">Resident: <strong class="text-slate-800">${log.patientName} (${log.patientId})</strong></div>
        ${patient ? `<div class="text-xs text-slate-500 mt-1">Room: ${patient.roomNumber} &bull; Bed: ${patient.bedNumber}</div>` : ''}
        <div class="mt-2 text-xs text-teal-800 italic bg-white/80 p-2 rounded-lg border border-teal-200/60">
          Instructions: ${log.notes || 'Take with water. Nurse must verify swallowing.'}
        </div>
      </div>

      <div class="space-y-3">
        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">Clinical Nurse Verification Note</label>
        <input type="text" id="nurse-mar-note" placeholder="E.g., Dose administered with meal. Resident tolerated well." 
               class="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500" 
               value="Administered dose under direct nurse observation.">
      </div>
    `;

    window.AppModal.showAcceptanceCard({
      title: 'Medication Administration Alert',
      subtitle: `Scheduled dose window for ${log.patientName}`,
      icon: 'pill',
      badgeText: 'CLINICAL REMINDER DUE',
      badgeColor: 'badge-medical-rose',
      contentHtml: contentHtml,
      confirmText: 'Administer & Sign MAR',
      cancelText: 'Decline / Refused',
      confirmType: 'success',
      onConfirm: () => {
        const noteInput = document.getElementById('nurse-mar-note');
        const nurseNote = noteInput ? noteInput.value : 'Administered under nurse supervision';
        this.store.logMedicationAdministration(log.id, 'Administered', nurseNote);
        
        // Play gentle confirmation sound
        this.playChime();
        this.checkReminders();

        window.AppModal.alert('MAR Verified', `Successfully logged administration of ${log.medName} for ${log.patientName}.`, 'success');
      },
      onCancel: () => {
        window.AppModal.confirm(
          'Mark Dose as Refused / Missed?',
          `Are you sure you want to mark this dose for ${log.patientName} as Refused or Missed? This will be recorded in the clinical audit log.`,
          'Mark Refused',
          'danger'
        ).then(confirmed => {
          if (confirmed) {
            this.store.logMedicationAdministration(log.id, 'Refused', 'Resident refused dose or missed medication window.');
            this.checkReminders();
          }
        });
      }
    });
  }

  /**
   * Opens a centered panel of all today's pending reminders
   */
  showRemindersListModal() {
    const state = this.store.getState();
    const pendingMeds = state.medicationLogs.filter(l => l.status === 'Pending');
    const timetableEvents = state.timetable.filter(t => t.day === 'Monday'); // Default to current day

    const medItems = pendingMeds.map(l => `
      <div class="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <i data-lucide="pill" class="w-4 h-4"></i>
          </div>
          <div>
            <div class="text-sm font-bold text-slate-900">${l.medName}</div>
            <div class="text-xs text-slate-500">${l.patientName} &bull; Scheduled: ${l.scheduledTime}</div>
          </div>
        </div>
        <button class="px-3 py-1.5 rounded-lg text-xs font-bold btn-decor-primary quick-admin-btn" data-log-id="${l.id}">
          Administer
        </button>
      </div>
    `).join('');

    const html = `
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-lg font-bold text-slate-900">Today's Active Reminders &amp; Schedule</h3>
          <p class="text-xs text-slate-500">Upcoming clinical duties, MAR windows, and therapy sessions</p>
        </div>
        <button id="test-chime-btn" class="px-3 py-1.5 rounded-lg text-xs font-semibold btn-decor-secondary flex items-center gap-1.5">
          <i data-lucide="volume-2" class="w-3.5 h-3.5 text-teal-600"></i>
          <span>Test Chime</span>
        </button>
      </div>

      <div class="space-y-4">
        <div>
          <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Pending Medication Doses</span>
            <span class="badge-medical-amber px-2 py-0.5 rounded-full text-[10px] font-bold">${pendingMeds.length} Due</span>
          </div>
          <div class="space-y-2">
            ${pendingMeds.length > 0 ? medItems : '<p class="text-xs text-slate-400 italic py-2">No pending medications right now.</p>'}
          </div>
        </div>

        <div>
          <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Upcoming Facility Events</div>
          <div class="space-y-2 max-h-48 overflow-y-auto">
            ${timetableEvents.slice(0, 3).map(e => `
              <div class="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs">
                <div>
                  <span class="font-bold text-slate-800">${e.title}</span>
                  <div class="text-slate-400 text-[11px]">${e.time} &bull; ${e.location}</div>
                </div>
                <span class="px-2 py-0.5 rounded-md font-semibold text-[10px] bg-slate-100 text-slate-600">${e.category}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="mt-6 pt-3 border-t border-slate-100 flex justify-end">
        <button id="close-reminders-btn" class="px-4 py-2 rounded-xl text-xs font-semibold btn-decor-secondary">
          Dismiss
        </button>
      </div>
    `;

    window.AppModal.showCustom(html, 'max-w-lg');

    document.getElementById('test-chime-btn').onclick = () => {
      this.playChime();
    };

    document.getElementById('close-reminders-btn').onclick = () => {
      window.AppModal.close();
    };

    document.querySelectorAll('.quick-admin-btn').forEach(btn => {
      btn.onclick = () => {
        const lid = btn.getAttribute('data-log-id');
        window.AppModal.close();
        setTimeout(() => this.triggerMedicationAlert(lid), 200);
      };
    });
  }
}

window.AppReminders = new ReminderDaemon();
