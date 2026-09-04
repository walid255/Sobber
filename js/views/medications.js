/**
 * SerenityCare Medication Administration Record (MAR) & Prescriptions View
 * Manages supervised medication doses, scheduled windows, administration logging, and active prescriptions.
 */

class MedicationsView {
  constructor() {
    this.statusFilter = 'all'; // all, Pending, Administered, Refused
    this.timeFilter = 'all';   // all, 08:00, 12:00, 13:00, 18:00
  }

  render(container) {
    const state = window.AppStore.getState();
    const logs = state.medicationLogs;
    const patients = state.patients;

    const filteredLogs = logs.filter(l => {
      const matchStatus = this.statusFilter === 'all' || l.status === this.statusFilter;
      const matchTime = this.timeFilter === 'all' || l.scheduledTime === this.timeFilter;
      return matchStatus && matchTime;
    });

    const pendingCount = logs.filter(l => l.status === 'Pending').length;
    const administeredCount = logs.filter(l => l.status === 'Administered').length;
    const refusedCount = logs.filter(l => l.status === 'Refused' || l.status === 'Missed').length;

    container.innerHTML = `
      <div class="space-y-6">
        
        <!-- Header -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 class="text-2xl font-black text-slate-900 tracking-tight">Medication Administration Record (MAR)</h2>
            <p class="text-xs text-slate-500 mt-0.5">Supervised clinical dose delivery, scheduled verification, and active prescriptions</p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <button id="test-reminder-alarm-btn" class="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 flex items-center gap-2 shadow-sm">
              <i data-lucide="bell-ring" class="w-4 h-4 text-amber-600 animate-bounce"></i>
              <span>Test Audio/Visual Reminder</span>
            </button>
            <button id="open-new-rx-btn" class="px-4 py-2.5 rounded-xl text-xs font-bold btn-decor-primary flex items-center gap-2">
              <i data-lucide="plus-circle" class="w-4 h-4"></i>
              <span>Prescribe Medication</span>
            </button>
          </div>
        </div>

        <!-- Metric KPI Strips -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="medical-card p-4 flex items-center gap-4 border-l-4 border-l-amber-500">
            <div class="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <i data-lucide="clock" class="w-5 h-5"></i>
            </div>
            <div>
              <span class="text-xs text-slate-500 font-semibold uppercase">Pending Doses Today</span>
              <div class="text-2xl font-black text-slate-900">${pendingCount}</div>
            </div>
          </div>

          <div class="medical-card p-4 flex items-center gap-4 border-l-4 border-l-emerald-500">
            <div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <i data-lucide="check-circle" class="w-5 h-5"></i>
            </div>
            <div>
              <span class="text-xs text-slate-500 font-semibold uppercase">Successfully Given</span>
              <div class="text-2xl font-black text-slate-900">${administeredCount}</div>
            </div>
          </div>

          <div class="medical-card p-4 flex items-center gap-4 border-l-4 border-l-rose-500">
            <div class="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0">
              <i data-lucide="alert-triangle" class="w-5 h-5"></i>
            </div>
            <div>
              <span class="text-xs text-slate-500 font-semibold uppercase">Refused / Missed</span>
              <div class="text-2xl font-black text-slate-900">${refusedCount}</div>
            </div>
          </div>
        </div>

        <!-- Filter Bar -->
        <div class="medical-card p-4 flex flex-wrap items-center justify-between gap-4">
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span class="font-bold text-slate-500 mr-1">Status:</span>
            ${[
              { key: 'all', label: 'All Doses' },
              { key: 'Pending', label: 'Pending Window' },
              { key: 'Administered', label: 'Administered' },
              { key: 'Refused', label: 'Refused' }
            ].map(f => `
              <button class="mar-status-filter-btn px-3 py-1.5 rounded-lg font-semibold transition ${this.statusFilter === f.key ? 'bg-teal-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
                      data-status="${f.key}">
                ${f.label}
              </button>
            `).join('')}
          </div>

          <div class="flex items-center gap-2 text-xs">
            <span class="font-bold text-slate-500">Time Window:</span>
            <select id="time-filter-select" class="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:border-teal-500">
              <option value="all" ${this.timeFilter === 'all' ? 'selected' : ''}>All Windows</option>
              <option value="08:00" ${this.timeFilter === '08:00' ? 'selected' : ''}>08:00 AM (Morning)</option>
              <option value="12:00" ${this.timeFilter === '12:00' ? 'selected' : ''}>12:00 PM (Noon)</option>
              <option value="13:00" ${this.timeFilter === '13:00' ? 'selected' : ''}>01:00 PM (Lunch)</option>
              <option value="18:00" ${this.timeFilter === '18:00' ? 'selected' : ''}>06:00 PM (Dinner)</option>
              <option value="20:00" ${this.timeFilter === '20:00' ? 'selected' : ''}>08:00 PM (Night)</option>
            </select>
          </div>
        </div>

        <!-- MAR Administration Log Table -->
        <div class="medical-card overflow-hidden">
          <div class="p-4 border-b border-slate-100 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <i data-lucide="clipboard-list" class="w-4 h-4 text-teal-600"></i>
              <h3 class="text-sm font-bold text-slate-900">Today's Scheduled Medication Administration Schedule</h3>
            </div>
            <span class="text-xs text-slate-400 font-mono">${new Date().toISOString().split('T')[0]}</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="border-b border-slate-200 bg-slate-50 text-[11px] text-slate-500 font-semibold uppercase">
                  <th class="py-3 px-4">Scheduled Window</th>
                  <th class="py-3 px-4">Resident</th>
                  <th class="py-3 px-4">Prescribed Medication</th>
                  <th class="py-3 px-4">Administration Status</th>
                  <th class="py-3 px-4">Clinical Sign-Off</th>
                  <th class="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${filteredLogs.length > 0 ? filteredLogs.map(l => {
                  const patient = patients.find(p => p.id === l.patientId);
                  const isPending = l.status === 'Pending';
                  return `
                    <tr class="hover:bg-slate-50/70 transition">
                      <td class="py-3 px-4">
                        <span class="px-2.5 py-1 rounded-md font-mono font-bold ${isPending ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}">
                          ${l.scheduledTime}
                        </span>
                      </td>
                      <td class="py-3 px-4">
                        <div class="flex items-center gap-2.5">
                          ${patient ? `<img src="${patient.photo}" class="w-8 h-8 rounded-lg object-cover border border-slate-200">` : ''}
                          <div>
                            <strong class="text-slate-900 block">${l.patientName}</strong>
                            <span class="text-[10px] text-slate-400">${patient ? `${patient.roomNumber} &bull; ${patient.bedNumber}` : l.patientId}</span>
                          </div>
                        </div>
                      </td>
                      <td class="py-3 px-4">
                        <div class="font-bold text-slate-800">${l.medName}</div>
                        <div class="text-[10px] text-slate-400 italic">${l.notes || 'As prescribed'}</div>
                      </td>
                      <td class="py-3 px-4">
                        ${l.status === 'Administered' ? `
                          <span class="badge-medical-emerald px-2.5 py-0.5 rounded-full font-bold text-[10px] inline-flex items-center gap-1">
                            <i data-lucide="check" class="w-3 h-3"></i> Administered
                          </span>
                        ` : l.status === 'Refused' ? `
                          <span class="badge-medical-rose px-2.5 py-0.5 rounded-full font-bold text-[10px] inline-flex items-center gap-1">
                            <i data-lucide="x" class="w-3 h-3"></i> Refused / Missed
                          </span>
                        ` : `
                          <span class="badge-medical-amber px-2.5 py-0.5 rounded-full font-bold text-[10px] inline-flex items-center gap-1">
                            <i data-lucide="clock" class="w-3 h-3"></i> Awaiting Delivery
                          </span>
                        `}
                      </td>
                      <td class="py-3 px-4 text-[11px]">
                        ${l.nurseName ? `
                          <div class="font-semibold text-slate-700">${l.nurseName}</div>
                          <div class="text-slate-400 text-[10px] font-mono">${l.administeredAt}</div>
                        ` : '<span class="text-slate-400 italic">Not logged</span>'}
                      </td>
                      <td class="py-3 px-4 text-right">
                        ${isPending ? `
                          <button class="btn-decor-primary px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 mar-admin-btn" data-log-id="${l.id}">
                            <i data-lucide="check-circle" class="w-3.5 h-3.5"></i>
                            <span>Administer</span>
                          </button>
                        ` : `
                          <span class="text-xs font-bold text-slate-400">Completed</span>
                        `}
                      </td>
                    </tr>
                  `;
                }).join('') : `
                  <tr>
                    <td colspan="6" class="py-10 text-center text-slate-400 text-xs">
                      <i data-lucide="pill" class="w-8 h-8 mx-auto text-slate-300 mb-2"></i>
                      <p class="font-bold text-slate-600">No Medication Administration Logs Scheduled</p>
                      <p class="text-[11px] text-slate-400 mt-1">Doses will appear here automatically when resident prescriptions are authorized.</p>
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Master Active Prescriptions Table across Residents -->
        <div class="medical-card p-5">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="text-sm font-bold text-slate-900">Active Medical Prescriptions Across All Residents</h3>
              <p class="text-xs text-slate-500">Physician authorized medication regimens</p>
            </div>
            <span class="badge-medical-teal text-xs px-2.5 py-0.5 rounded-full font-bold">
              ${patients.reduce((acc, p) => acc + (p.prescriptions || []).length, 0)} Active Prescriptions
            </span>
          </div>

          <div class="space-y-2">
            ${patients.flatMap(p => (p.prescriptions || []).map(rx => ({ ...rx, patient: p }))).length > 0 ? 
              patients.flatMap(p => (p.prescriptions || []).map(rx => ({ ...rx, patient: p }))).map(item => `
                <div class="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-teal-200 transition flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                      <i data-lucide="pill" class="w-4 h-4"></i>
                    </div>
                    <div>
                      <div class="font-bold text-slate-900 text-sm">${item.medicationName} (${item.dosage})</div>
                      <div class="text-slate-500 text-[11px]">Resident: <strong class="text-slate-700">${item.patient.name}</strong> (${item.patient.id}) &bull; ${item.patient.roomNumber}</div>
                    </div>
                  </div>

                  <div class="grid grid-cols-3 gap-4 text-slate-600 text-[11px]">
                    <div><span class="text-slate-400 block text-[10px]">Frequency</span> ${item.frequency}</div>
                    <div><span class="text-slate-400 block text-[10px]">Timing</span> ${(item.times || []).join(', ')}</div>
                    <div><span class="text-slate-400 block text-[10px]">Prescribed By</span> ${item.prescribingDoctor}</div>
                  </div>

                  <div>
                    <span class="badge-medical-emerald text-[10px] font-bold px-2.5 py-0.5 rounded-full">${item.status}</span>
                  </div>
                </div>
              `).join('') : `
                <div class="py-8 text-center text-xs text-slate-400">
                  <p class="font-semibold text-slate-600">No Active Prescriptions on File</p>
                  <p class="text-[11px] text-slate-400 mt-0.5">Use the "Prescribe Medication" button above to order resident treatment regimens.</p>
                </div>
              `}
          </div>
        </div>

      </div>
    `;

    // Bind Filter Events
    document.querySelectorAll('.mar-status-filter-btn').forEach(btn => {
      btn.onclick = () => {
        this.statusFilter = btn.getAttribute('data-status');
        this.render(container);
      };
    });

    const timeSelect = document.getElementById('time-filter-select');
    if (timeSelect) {
      timeSelect.onchange = (e) => {
        this.timeFilter = e.target.value;
        this.render(container);
      };
    }

    // Action buttons
    document.querySelectorAll('.mar-admin-btn').forEach(btn => {
      btn.onclick = () => {
        const lid = btn.getAttribute('data-log-id');
        window.AppReminders.triggerMedicationAlert(lid);
      };
    });

    // Test Audio/Visual Reminder Alarm
    document.getElementById('test-reminder-alarm-btn').onclick = () => {
      window.AppReminders.triggerMedicationAlert();
    };

    // Open Prescribe Modal
    document.getElementById('open-new-rx-btn').onclick = () => {
      this.openPrescribeModal();
    };

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  /**
   * Modal to add a new physician prescription
   */
  openPrescribeModal() {
    const state = window.AppStore.getState();
    const patients = state.patients.filter(p => p.stage !== 'Graduated');

    const patientOptions = patients.map(p => `
      <option value="${p.id}">${p.name} (${p.id}) - ${p.roomNumber}</option>
    `).join('');

    const html = `
      <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
            <i data-lucide="file-plus" class="w-5 h-5"></i>
          </div>
          <div>
            <h3 class="text-lg font-bold text-slate-900">Clinical Prescription Order</h3>
            <p class="text-xs text-slate-500">Authorize medication dosage and scheduled MAR windows</p>
          </div>
        </div>
        <button id="close-rx-modal" class="p-1 text-slate-400 hover:bg-slate-100 rounded-lg">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <form id="new-rx-form" class="space-y-4 text-xs">
        <div>
          <label class="block font-bold text-slate-700 mb-1">Select Resident *</label>
          <select id="rx-patient-select" required class="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-teal-500">
            ${patientOptions}
          </select>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Medication Name *</label>
            <input type="text" id="rx-med-name" required placeholder="E.g., Suboxone, Campral, Zoloft" class="w-full px-3 py-2 rounded-lg border border-slate-200">
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Dosage &amp; Strength *</label>
            <input type="text" id="rx-dosage" required placeholder="E.g., 8mg / 2mg, 666 mg, 50 mg" class="w-full px-3 py-2 rounded-lg border border-slate-200">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Frequency *</label>
            <select id="rx-frequency" class="w-full px-3 py-2 rounded-lg border border-slate-200">
              <option value="Once daily (Morning)">Once daily (Morning)</option>
              <option value="Twice daily (BID)">Twice daily (BID - Morning &amp; Night)</option>
              <option value="Three times daily (TID)">Three times daily (TID)</option>
              <option value="As needed (PRN)">As needed (PRN)</option>
            </select>
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Scheduled Time Slots (Comma-separated)</label>
            <input type="text" id="rx-times" value="08:00" placeholder="08:00, 20:00" class="w-full px-3 py-2 rounded-lg border border-slate-200">
          </div>
        </div>

        <div>
          <label class="block font-bold text-slate-700 mb-1">Clinical Instructions &amp; Cautions</label>
          <textarea id="rx-notes" rows="2" placeholder="Take with meals; observe 15-minute sublingual dissolution; check vitals first..." class="w-full px-3 py-2 rounded-lg border border-slate-200"></textarea>
        </div>

        <div class="pt-4 border-t border-slate-200 flex justify-end gap-3">
          <button type="button" id="cancel-rx-btn" class="px-4 py-2 rounded-xl btn-decor-secondary font-semibold">Cancel</button>
          <button type="submit" class="px-5 py-2 rounded-xl btn-decor-primary font-bold flex items-center gap-1.5">
            <i data-lucide="check" class="w-4 h-4"></i>
            <span>Authorize Prescription</span>
          </button>
        </div>
      </form>
    `;

    window.AppModal.showCustom(html, 'max-w-lg');

    document.getElementById('close-rx-modal').onclick = () => window.AppModal.close();
    document.getElementById('cancel-rx-btn').onclick = () => window.AppModal.close();

    document.getElementById('new-rx-form').onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="animate-spin inline-block mr-1">⏳</span> Authorizing...';
      }

      const patientId = document.getElementById('rx-patient-select').value;
      const times = document.getElementById('rx-times').value.split(',').map(t => t.trim()).filter(Boolean);

      try {
        await window.AppStore.addPrescription(patientId, {
          medicationName: document.getElementById('rx-med-name').value.trim(),
          dosage: document.getElementById('rx-dosage').value.trim(),
          frequency: document.getElementById('rx-frequency').value,
          times: times.length > 0 ? times : ['08:00'],
          instructions: document.getElementById('rx-notes').value.trim()
        });

        window.AppModal.close();
        window.AppModal.alert('Prescription Authorized', 'New prescription order logged and scheduled into today\'s MAR queue.', 'success');
      } catch (err) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Authorize Prescription';
        }
        window.AppModal.close();
      }
    };

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
}

window.MedicationsView = MedicationsView;
