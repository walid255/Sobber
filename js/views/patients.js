/**
 * SerenityCare Patient / Resident Registry View
 * Manages full demographics, next-of-kin, psychiatric & addiction history, photo upload, vitals, daily progress notes, and prescriptions.
 */

class PatientsView {
  constructor() {
    this.currentFilter = 'all'; // all, Detoxification, Inpatient Recovery, Transition / Halfway, Graduated
    this.searchQuery = '';
    window.PatientsViewInstance = this;
  }

  render(container) {
    const state = window.AppStore.getState();
    const patients = state.patients;

    const filteredPatients = patients.filter(p => {
      const matchesFilter = this.currentFilter === 'all' || p.stage === this.currentFilter;
      const q = this.searchQuery.toLowerCase();
      const matchesSearch = !q || 
        p.name.toLowerCase().includes(q) || 
        p.id.toLowerCase().includes(q) ||
        p.roomNumber.toLowerCase().includes(q) ||
        (p.psychiatricHistory && p.psychiatricHistory.primarySubstance.toLowerCase().includes(q));
      return matchesFilter && matchesSearch;
    });

    container.innerHTML = `
      <div class="space-y-6">
        
        <!-- Header & Controls -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 class="text-2xl font-black text-slate-900 tracking-tight">Resident Medical Registry</h2>
            <p class="text-xs text-slate-500 mt-0.5">Comprehensive intake dossiers, psychiatric evaluations, and progress tracking</p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            ${window.Auth.hasPermission('batch_upload') ? `
              <button id="batch-import-nav-btn" class="px-3.5 py-2.5 rounded-xl text-xs font-semibold btn-decor-secondary flex items-center gap-2">
                <i data-lucide="upload-cloud" class="w-4 h-4 text-teal-600"></i>
                <span>Batch CSV Upload</span>
              </button>
            ` : ''}
            <button id="add-patient-btn" class="px-4 py-2.5 rounded-xl text-xs font-bold btn-decor-primary flex items-center gap-2">
              <i data-lucide="user-plus" class="w-4 h-4"></i>
              <span>Admit New Resident</span>
            </button>
          </div>
        </div>

        <!-- Filter Bar & Search -->
        <div class="medical-card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <!-- Stage Tabs -->
          <div class="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            ${[
              { key: 'all', label: 'All Residents', count: patients.length },
              { key: 'Detoxification', label: 'Detox', count: patients.filter(p => p.stage === 'Detoxification').length },
              { key: 'Inpatient Recovery', label: 'Inpatient', count: patients.filter(p => p.stage === 'Inpatient Recovery').length },
              { key: 'Transition / Halfway', label: 'Transition', count: patients.filter(p => p.stage === 'Transition / Halfway').length },
              { key: 'Graduated', label: 'Alumni / Graduated', count: patients.filter(p => p.stage === 'Graduated').length }
            ].map(tab => `
              <button class="stage-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${this.currentFilter === tab.key ? 'bg-teal-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
                      data-stage="${tab.key}">
                <span>${tab.label}</span>
                <span class="px-1.5 py-0.2 rounded-full text-[10px] ${this.currentFilter === tab.key ? 'bg-teal-800 text-teal-100' : 'bg-slate-200 text-slate-700'}">${tab.count}</span>
              </button>
            `).join('')}
          </div>

          <!-- Search Input -->
          <div class="relative w-full md:w-72">
            <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"></i>
            <input type="text" id="patient-search-input" value="${this.searchQuery}" 
                   placeholder="Search name, ID, substance..." 
                   class="w-full text-xs pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500">
          </div>
        </div>

        <!-- Resident Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          ${filteredPatients.length > 0 ? filteredPatients.map(p => this.renderPatientCard(p)).join('') : `
            <div class="col-span-full medical-card p-12 text-center text-slate-400">
              <i data-lucide="users" class="w-12 h-12 mx-auto text-slate-300 mb-3"></i>
              <h3 class="text-base font-bold text-slate-700">No Residents Registered Yet</h3>
              <p class="text-xs text-slate-500 mt-1">Get started by admitting your first resident or import records in batch via CSV.</p>
              <div class="mt-4 flex items-center justify-center gap-3">
                <button onclick="window.PatientsViewInstance.openAddPatientModal()" class="btn-decor-primary text-xs px-4 py-2 rounded-xl font-bold flex items-center gap-1.5">
                  <i data-lucide="user-plus" class="w-3.5 h-3.5"></i>
                  <span>Admit First Resident</span>
                </button>
                ${window.Auth.hasPermission('batch_upload') ? `
                  <button onclick="window.AppRouter.navigate('batch-upload')" class="btn-decor-secondary text-xs px-4 py-2 rounded-xl font-bold flex items-center gap-1.5">
                    <i data-lucide="upload-cloud" class="w-3.5 h-3.5 text-teal-600"></i>
                    <span>Batch CSV Import</span>
                  </button>
                ` : ''}
              </div>
            </div>
          `}
        </div>

      </div>
    `;

    // Bind Filter Events
    document.querySelectorAll('.stage-filter-btn').forEach(btn => {
      btn.onclick = () => {
        this.currentFilter = btn.getAttribute('data-stage');
        this.render(container);
      };
    });

    const searchInput = document.getElementById('patient-search-input');
    if (searchInput) {
      searchInput.oninput = (e) => {
        this.searchQuery = e.target.value;
        this.render(container);
      };
    }

    const addPatientBtn = document.getElementById('add-patient-btn');
    if (addPatientBtn) {
      addPatientBtn.onclick = () => this.openAddPatientModal();
    }

    const batchImportBtn = document.getElementById('batch-import-nav-btn');
    if (batchImportBtn) {
      batchImportBtn.onclick = () => window.AppRouter.navigate('batch-upload');
    }

    // Bind Patient Card Action Events
    document.querySelectorAll('.view-patient-dossier-btn').forEach(btn => {
      btn.onclick = () => {
        const pid = btn.getAttribute('data-patient-id');
        this.openPatientDetailsModal(pid);
      };
    });

    document.querySelectorAll('.quick-pdf-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const pid = btn.getAttribute('data-patient-id');
        window.AppDocs.openPatientDossier(pid);
      };
    });

    document.querySelectorAll('.edit-patient-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const pid = btn.getAttribute('data-patient-id');
        this.openEditPatientModal(pid);
      };
    });

    document.querySelectorAll('.delete-patient-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const pid = btn.getAttribute('data-patient-id');
        this.confirmDeletePatient(pid);
      };
    });

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  renderPatientCard(p) {
    const stageBadgeClass = {
      'Detoxification': 'badge-medical-rose',
      'Inpatient Recovery': 'badge-medical-teal',
      'Transition / Halfway': 'badge-medical-cyan',
      'Graduated': 'badge-medical-emerald'
    }[p.stage] || 'badge-medical-teal';

    return `
      <div class="medical-card p-5 flex flex-col justify-between hover:border-teal-300 transition-all group">
        <div>
          <!-- Card Header with Photo and Badges -->
          <div class="flex items-start gap-3.5 mb-4">
            <div class="relative">
              <img src="${p.photo}" alt="${p.name}" class="w-14 h-14 rounded-2xl object-cover border-2 border-slate-100 shadow-sm">
              <span class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${p.stage === 'Graduated' ? 'bg-emerald-500' : 'bg-teal-500'}"></span>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-1">
                <span class="text-[11px] font-mono font-bold text-slate-400">${p.id}</span>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${stageBadgeClass}">${p.stage}</span>
              </div>
              <h3 class="text-base font-bold text-slate-900 truncate group-hover:text-teal-700 transition-colors">${p.name}</h3>
              <p class="text-xs text-slate-500">${p.gender} &bull; ${p.age} yrs &bull; Blood: <strong>${p.bloodGroup}</strong></p>
            </div>
          </div>

          <!-- Room & Stay Metrics -->
          <div class="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-xl text-xs mb-3">
            <div>
              <span class="text-slate-400 block text-[10px]">Location</span>
              <span class="font-bold text-slate-800">${p.roomNumber} (${p.bedNumber})</span>
            </div>
            <div>
              <span class="text-slate-400 block text-[10px]">Sobriety Streak</span>
              <span class="font-black text-teal-700 flex items-center gap-1">
                <i data-lucide="award" class="w-3.5 h-3.5 text-amber-500"></i>
                <span>${p.sobrietyDays} Days Sober</span>
              </span>
            </div>
          </div>

          <!-- Substance & Diagnostics -->
          <div class="text-xs mb-3">
            <div class="text-[11px] text-slate-400 mb-0.5">Primary Addiction:</div>
            <div class="font-semibold text-rose-800 bg-rose-50 px-2 py-1 rounded-md border border-rose-100 truncate">
              ${p.psychiatricHistory ? p.psychiatricHistory.primarySubstance : 'Substance Disorder'}
            </div>
          </div>

          <!-- Next of Kin Summary -->
          <div class="text-[11px] text-slate-500 mb-2 flex items-center justify-between">
            <span>Next of Kin:</span>
            <span class="font-semibold text-slate-700">${p.nextOfKin ? `${p.nextOfKin.name} (${p.nextOfKin.relationship})` : 'Not provided'}</span>
          </div>
        </div>

        <!-- Action Footer -->
        <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5">
          <button class="flex-1 py-2 px-2.5 rounded-xl text-xs font-bold btn-decor-secondary view-patient-dossier-btn" data-patient-id="${p.id}">
            Clinical Dossier
          </button>
          <button class="p-2 rounded-xl text-xs font-bold btn-decor-primary quick-pdf-btn" data-patient-id="${p.id}" title="Generate PDF Medical Record">
            <i data-lucide="file-down" class="w-4 h-4"></i>
          </button>
          <button class="p-2 rounded-xl text-xs font-bold btn-decor-secondary text-slate-500 hover:text-teal-700 hover:bg-teal-50 edit-patient-btn" data-patient-id="${p.id}" title="Edit Resident Profile">
            <i data-lucide="edit-3" class="w-4 h-4"></i>
          </button>
          ${window.Auth.getCurrentRole() === 'admin' || window.Auth.hasPermission('users') ? `
            <button class="p-2 rounded-xl text-xs font-bold btn-decor-secondary text-slate-400 hover:text-rose-600 hover:bg-rose-50 delete-patient-btn" data-patient-id="${p.id}" title="Delete Resident Record">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          ` : ''}
          ${p.graduationQualified && window.Auth.hasPermission('certificates') ? `
            <button class="p-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100" 
                    onclick="window.AppDocs.openGraduationCertificate('${p.id}')" title="Print Certificate">
              <i data-lucide="award" class="w-4 h-4"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Modal to register a brand new patient / resident
   */
  openAddPatientModal() {
    const defaultPhoto = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=80';

    const html = `
      <div class="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
            <i data-lucide="user-plus" class="w-5 h-5"></i>
          </div>
          <div>
            <h3 class="text-lg font-bold text-slate-900">Clinical Resident Admission</h3>
            <p class="text-xs text-slate-500">Comprehensive intake evaluation, next of kin &amp; psychiatric history</p>
          </div>
        </div>
        <button id="close-modal-x" class="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <form id="add-patient-form" class="space-y-5 text-xs">
        
        <!-- Photo and Primary Info -->
        <div class="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <img id="patient-photo-preview" src="${defaultPhoto}" class="w-16 h-16 rounded-xl object-cover border border-slate-200 shadow-sm">
          <div class="flex-1">
            <label class="block font-bold text-slate-700 mb-1">Resident Photo URL / Attachment</label>
            <input type="text" id="new-photo" value="${defaultPhoto}" class="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-500">
            <span class="text-[10px] text-slate-400">Direct image URL, Cloudflare R2 object link, or base64 data URI</span>
          </div>
        </div>

        <!-- Personal Demographics -->
        <div>
          <h4 class="font-bold text-slate-800 uppercase tracking-wider mb-2 text-[11px] text-teal-800">1. Personal Demographics</h4>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label class="block font-semibold text-slate-600 mb-1">Full Legal Name *</label>
              <input type="text" id="new-name" required placeholder="E.g., Michael Turner" class="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-teal-500">
            </div>
            <div>
              <label class="block font-semibold text-slate-600 mb-1">Date of Birth *</label>
              <input type="date" id="new-dob" required value="1990-01-01" class="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-teal-500">
            </div>
            <div>
              <label class="block font-semibold text-slate-600 mb-1">Gender *</label>
              <select id="new-gender" class="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-teal-500">
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label class="block font-semibold text-slate-600 mb-1">Blood Group</label>
              <select id="new-blood" class="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-teal-500">
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </div>
            <div>
              <label class="block font-semibold text-slate-600 mb-1">Phone Number</label>
              <input type="text" id="new-phone" placeholder="+1 (555) 000-0000" class="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-teal-500">
            </div>
            <div>
              <label class="block font-semibold text-slate-600 mb-1">Assigned Room &amp; Bed</label>
              <div class="grid grid-cols-2 gap-1.5">
                <input type="text" id="new-room" placeholder="Room 105" class="w-full px-2 py-2 rounded-lg border border-slate-200">
                <input type="text" id="new-bed" placeholder="Bed A" class="w-full px-2 py-2 rounded-lg border border-slate-200">
              </div>
            </div>
          </div>
        </div>

        <!-- Next of Kin -->
        <div>
          <h4 class="font-bold text-slate-800 uppercase tracking-wider mb-2 text-[11px] text-teal-800">2. Emergency Contact &amp; Next of Kin</h4>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label class="block font-semibold text-slate-600 mb-1">Contact Name *</label>
              <input type="text" id="new-nok-name" required placeholder="E.g., Sarah Turner" class="w-full px-3 py-2 rounded-lg border border-slate-200">
            </div>
            <div>
              <label class="block font-semibold text-slate-600 mb-1">Relationship *</label>
              <input type="text" id="new-nok-rel" required placeholder="Spouse, Mother, Sibling" class="w-full px-3 py-2 rounded-lg border border-slate-200">
            </div>
            <div>
              <label class="block font-semibold text-slate-600 mb-1">Contact Phone *</label>
              <input type="text" id="new-nok-phone" required placeholder="+1 (555) 000-1111" class="w-full px-3 py-2 rounded-lg border border-slate-200">
            </div>
          </div>
        </div>

        <!-- Psychiatric & Addiction Background -->
        <div>
          <h4 class="font-bold text-slate-800 uppercase tracking-wider mb-2 text-[11px] text-teal-800">3. Psychiatric &amp; Substance Evaluation</h4>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label class="block font-semibold text-slate-600 mb-1">Primary Substance of Abuse *</label>
              <input type="text" id="new-substance" required placeholder="E.g., Alcohol, Opioids, Meth" class="w-full px-3 py-2 rounded-lg border border-slate-200">
            </div>
            <div>
              <label class="block font-semibold text-slate-600 mb-1">Addiction Duration (Years)</label>
              <input type="number" id="new-duration" value="5" min="0" class="w-full px-3 py-2 rounded-lg border border-slate-200">
            </div>
            <div>
              <label class="block font-semibold text-slate-600 mb-1">Suicide Risk Evaluation</label>
              <select id="new-risk" class="w-full px-3 py-2 rounded-lg border border-slate-200">
                <option value="Low">Low</option>
                <option value="Moderate (Monitored)">Moderate (Monitored)</option>
                <option value="High (Close Observation)">High (Close Observation)</option>
              </select>
            </div>
          </div>
          <div class="mt-2.5">
            <label class="block font-semibold text-slate-600 mb-1">Clinical Co-Occurring Diagnoses (semicolon separated)</label>
            <input type="text" id="new-diagnoses" placeholder="E.g., Major Depression; PTSD; Generalized Anxiety" class="w-full px-3 py-2 rounded-lg border border-slate-200">
          </div>
          <div class="mt-2.5">
            <label class="block font-semibold text-slate-600 mb-1">Allergies (semicolon separated)</label>
            <input type="text" id="new-allergies" placeholder="E.g., Penicillin; Latex; None" class="w-full px-3 py-2 rounded-lg border border-slate-200">
          </div>
          <div class="mt-2.5">
            <label class="block font-semibold text-slate-600 mb-1">Intake Assessment Notes</label>
            <textarea id="new-notes" rows="2" placeholder="Clinical observations, motivation level, detoxification requirements..." class="w-full px-3 py-2 rounded-lg border border-slate-200"></textarea>
          </div>
        </div>

        <!-- Form Submit Actions -->
        <div class="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <button type="button" id="cancel-add-patient-btn" class="px-5 py-2.5 rounded-xl btn-decor-secondary font-semibold">
            Cancel
          </button>
          <button type="submit" class="px-6 py-2.5 rounded-xl btn-decor-primary font-bold flex items-center gap-2">
            <i data-lucide="check" class="w-4 h-4"></i>
            <span>Confirm Admission</span>
          </button>
        </div>

      </form>
    `;

    window.AppModal.showCustom(html, 'max-w-2xl');

    // Handle photo preview change
    const photoInput = document.getElementById('new-photo');
    const photoImg = document.getElementById('patient-photo-preview');
    photoInput.oninput = () => {
      photoImg.src = photoInput.value || defaultPhoto;
    };

    document.getElementById('close-modal-x').onclick = () => window.AppModal.close();
    document.getElementById('cancel-add-patient-btn').onclick = () => window.AppModal.close();

    document.getElementById('add-patient-form').onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="animate-spin inline-block mr-1">⏳</span> Admitting...';
      }

      const dob = document.getElementById('new-dob').value;
      const age = new Date().getFullYear() - new Date(dob).getFullYear();

      const newPatientData = {
        name: document.getElementById('new-name').value.trim(),
        dob: dob,
        age: age || 30,
        gender: document.getElementById('new-gender').value,
        bloodGroup: document.getElementById('new-blood').value,
        phone: document.getElementById('new-phone').value.trim(),
        email: `${document.getElementById('new-name').value.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        photo: document.getElementById('new-photo').value || defaultPhoto,
        roomNumber: document.getElementById('new-room').value || 'Room 101',
        bedNumber: document.getElementById('new-bed').value || 'Bed A',
        nextOfKin: {
          name: document.getElementById('new-nok-name').value.trim(),
          relationship: document.getElementById('new-nok-rel').value.trim(),
          phone: document.getElementById('new-nok-phone').value.trim(),
          address: 'On file',
          emergencyConsent: true
        },
        psychiatricHistory: {
          primarySubstance: document.getElementById('new-substance').value.trim(),
          secondarySubstance: 'None',
          addictionDurationYears: parseInt(document.getElementById('new-duration').value) || 1,
          priorRehabs: 0,
          diagnoses: document.getElementById('new-diagnoses').value.split(';').map(d => d.trim()).filter(Boolean),
          suicideRisk: document.getElementById('new-risk').value,
          allergies: document.getElementById('new-allergies').value.split(';').map(a => a.trim()).filter(Boolean),
          notes: document.getElementById('new-notes').value || 'Initial intake assessment conducted.'
        }
      };

      try {
        const created = await window.AppStore.addPatient(newPatientData);
        window.AppModal.close();

        // Show acceptance success card
        window.AppModal.showAcceptanceCard({
          title: 'Resident Admitted Successfully',
        subtitle: `${created.name} is now registered in the medical system`,
        icon: 'check-circle-2',
        badgeText: 'ADMISSION COMPLETED',
        badgeColor: 'badge-medical-emerald',
        confirmType: 'success',
        contentHtml: `
          <div class="p-3 bg-teal-50 rounded-xl text-xs space-y-1">
            <div>Patient ID: <strong>${created.id}</strong></div>
            <div>Assigned Bed: <strong>${created.roomNumber} - ${created.bedNumber}</strong></div>
            <div>Primary Substance: <strong>${created.psychiatricHistory.primarySubstance}</strong></div>
          </div>
        `,
        confirmText: 'View Clinical Profile',
        cancelText: 'Done',
        onConfirm: () => {
          this.openPatientDetailsModal(created.id);
        }
      });
      } catch (err) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Confirm Admission';
        }
        window.AppModal.close();
      }
    };
  }

  /**
   * Complete interactive clinical dossier modal for a resident
   */
  openPatientDetailsModal(patientId) {
    const state = window.AppStore.getState();
    const patient = state.patients.find(p => p.id === patientId);
    if (!patient) return;

    const residentPayments = window.AppStore.getPaymentsByPatientId(patient.id);
    const resInvoiced = residentPayments.reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0);
    const resPaid = residentPayments.reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);
    const resBalance = residentPayments.reduce((sum, p) => sum + (Number(p.balance) || 0), 0);

    const html = `
      <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
        <div class="flex items-center gap-3">
          <img src="${patient.photo}" class="w-12 h-12 rounded-xl object-cover border border-slate-200">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-lg font-black text-slate-900">${patient.name}</h3>
              <span class="text-xs font-mono font-bold text-slate-400">${patient.id}</span>
              <span class="badge-medical-teal text-[10px] font-bold px-2 py-0.5 rounded-full">${patient.stage}</span>
            </div>
            <p class="text-xs text-slate-500">${patient.gender} &bull; ${patient.age} yrs &bull; ${patient.roomNumber} (${patient.bedNumber}) &bull; Sobriety: <strong class="text-teal-700">${patient.sobrietyDays} Days</strong></p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button id="modal-edit-patient-btn" class="px-3 py-1.5 rounded-xl text-xs font-bold btn-decor-secondary text-slate-700 hover:text-teal-700 flex items-center gap-1.5" title="Edit Resident Profile">
            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            <span>Edit Profile</span>
          </button>
          ${window.Auth.getCurrentRole() === 'admin' || window.Auth.hasPermission('users') ? `
            <button id="modal-delete-patient-btn" class="px-3 py-1.5 rounded-xl text-xs font-bold btn-decor-secondary text-rose-600 hover:bg-rose-50 flex items-center gap-1.5" title="Delete Resident Record">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              <span>Delete</span>
            </button>
          ` : ''}
          <button id="modal-dossier-pdf-btn" class="px-3 py-1.5 rounded-xl text-xs font-bold btn-decor-primary flex items-center gap-1">
            <i data-lucide="printer" class="w-3.5 h-3.5"></i>
            <span>Dossier PDF</span>
          </button>
          <button id="modal-close-btn" class="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
      </div>

      <!-- Dossier Tabs -->
      <div class="flex flex-wrap border-b border-slate-200 mb-4 text-xs font-bold">
        <button class="dossier-tab-btn active px-3.5 py-2 border-b-2 border-teal-600 text-teal-700" data-tab="tab-overview">Overview &amp; Next of Kin</button>
        <button class="dossier-tab-btn px-3.5 py-2 border-b-2 border-transparent text-slate-500 hover:text-slate-800" data-tab="tab-psych">Psychiatric History</button>
        <button class="dossier-tab-btn px-3.5 py-2 border-b-2 border-transparent text-slate-500 hover:text-slate-800" data-tab="tab-notes">Progress Notes (${(patient.progressNotes || []).length})</button>
        <button class="dossier-tab-btn px-3.5 py-2 border-b-2 border-transparent text-slate-500 hover:text-slate-800" data-tab="tab-vitals">Vitals &amp; Drug Screens</button>
        <button class="dossier-tab-btn px-3.5 py-2 border-b-2 border-transparent text-slate-500 hover:text-slate-800" data-tab="tab-rx">Prescriptions (${(patient.prescriptions || []).length})</button>
        ${window.Auth.hasPermission('payments') ? `
          <button class="dossier-tab-btn px-3.5 py-2 border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center gap-1.5" data-tab="tab-billing">
            <span>Billing &amp; Receipts</span>
            <span class="px-1.5 py-0.2 rounded-full text-[10px] ${resBalance > 0 ? 'bg-amber-100 text-amber-800 font-bold' : 'bg-slate-100 text-slate-600'}">${residentPayments.length}</span>
          </button>
        ` : ''}
      </div>

      <!-- Tab 1: Overview -->
      <div id="tab-overview" class="dossier-tab-content space-y-4 text-xs">
        <div class="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div><span class="text-slate-400 block">Admission Date:</span> <strong>${patient.admissionDate}</strong></div>
          <div><span class="text-slate-400 block">Blood Group:</span> <strong>${patient.bloodGroup}</strong></div>
          <div><span class="text-slate-400 block">Phone:</span> <strong>${patient.phone}</strong></div>
          <div><span class="text-slate-400 block">Email:</span> <strong>${patient.email}</strong></div>
        </div>

        <div class="p-4 border border-slate-200 rounded-xl">
          <h4 class="font-bold text-slate-700 mb-2 uppercase text-[11px] text-teal-800">Designated Next of Kin</h4>
          <div class="grid grid-cols-3 gap-3">
            <div><span class="text-slate-400 block">Name &amp; Relation:</span> <strong>${patient.nextOfKin ? `${patient.nextOfKin.name} (${patient.nextOfKin.relationship})` : 'None'}</strong></div>
            <div><span class="text-slate-400 block">Emergency Phone:</span> <strong>${patient.nextOfKin ? patient.nextOfKin.phone : 'None'}</strong></div>
            <div><span class="text-slate-400 block">Consent on File:</span> <strong class="text-emerald-700">Signed &amp; Authorized</strong></div>
          </div>
        </div>

        <!-- Graduation Qualification Toggle -->
        ${window.Auth.hasPermission('certificates') ? `
          <div class="p-4 bg-amber-50/60 border border-amber-200 rounded-xl flex items-center justify-between">
            <div>
              <div class="font-bold text-slate-900">Graduation &amp; Release Status</div>
              <div class="text-[11px] text-slate-600">
                ${patient.graduationQualified ? 'Resident has qualified for official graduation & release.' : 'Mark resident qualified once 90-day sobriety & criteria are satisfied.'}
              </div>
            </div>
            <div class="flex items-center gap-2">
              ${patient.graduationQualified ? `
                <button class="px-3 py-1.5 rounded-lg text-xs font-bold btn-decor-success flex items-center gap-1.5"
                        onclick="window.AppDocs.openGraduationCertificate('${patient.id}')">
                  <i data-lucide="award" class="w-4 h-4"></i>
                  <span>Print Certificate</span>
                </button>
              ` : ''}
              <button id="toggle-grad-btn" class="px-3 py-1.5 rounded-lg text-xs font-bold ${patient.graduationQualified ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : 'btn-decor-primary'}">
                ${patient.graduationQualified ? 'Revoke Qualification' : 'Mark Qualified for Release'}
              </button>
            </div>
          </div>
        ` : ''}
      </div>

      <!-- Tab 2: Psychiatric History -->
      <div id="tab-psych" class="dossier-tab-content hidden space-y-4 text-xs">
        <div class="p-4 bg-teal-50/50 border border-teal-200 rounded-xl space-y-3">
          <div class="grid grid-cols-3 gap-3">
            <div><span class="text-slate-500 block">Primary Substance:</span> <strong class="text-rose-700">${patient.psychiatricHistory.primarySubstance}</strong></div>
            <div><span class="text-slate-500 block">Duration of Addiction:</span> <strong>${patient.psychiatricHistory.addictionDurationYears} Years</strong></div>
            <div><span class="text-slate-500 block">Prior Inpatient Stays:</span> <strong>${patient.psychiatricHistory.priorRehabs} Prior Rehabs</strong></div>
          </div>
          <div>
            <span class="text-slate-500 block">Diagnosed Co-Occurring Psychiatric Conditions:</span>
            <div class="flex flex-wrap gap-1.5 mt-1">
              ${(patient.psychiatricHistory.diagnoses || []).map(d => `<span class="px-2 py-0.5 rounded-full bg-white border border-teal-300 text-teal-800 font-semibold">${d}</span>`).join('')}
            </div>
          </div>
          <div>
            <span class="text-slate-500 block">Allergy Warnings:</span>
            <strong class="text-rose-700">${(patient.psychiatricHistory.allergies || []).join(', ') || 'No known allergies'}</strong>
          </div>
          <div class="p-2.5 bg-white rounded-lg border border-teal-200">
            <span class="text-slate-400 block text-[10px]">Clinical Intake Evaluation Notes</span>
            <p class="text-slate-700 mt-1 italic leading-relaxed">${patient.psychiatricHistory.notes}</p>
          </div>
        </div>
      </div>

      <!-- Tab 3: Progress Notes -->
      <div id="tab-notes" class="dossier-tab-content hidden space-y-4 text-xs">
        <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
          <h4 class="font-bold text-slate-700 mb-2">Record Daily Clinical / Counseling Progress Note</h4>
          <div class="space-y-2">
            <div class="grid grid-cols-2 gap-2">
              <select id="new-note-type" class="px-2.5 py-1.5 rounded-lg border border-slate-200">
                <option value="Counseling">12-Step / Counseling</option>
                <option value="Clinical">Clinical / Medical</option>
                <option value="Behavioral">Behavioral / Milestones</option>
                <option value="Incident">Incident Report</option>
              </select>
              <input type="number" id="new-note-streak" value="${patient.sobrietyDays}" placeholder="Sobriety Days" class="px-2.5 py-1.5 rounded-lg border border-slate-200">
            </div>
            <textarea id="new-note-text" rows="2" placeholder="Detail progress, behavioral observations, compliance with house timetable..." class="w-full px-2.5 py-1.5 rounded-lg border border-slate-200"></textarea>
            <div class="flex justify-end">
              <button id="submit-note-btn" class="px-4 py-1.5 rounded-lg font-bold btn-decor-primary flex items-center gap-1">
                <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                <span>Save Note</span>
              </button>
            </div>
          </div>
        </div>

        <div class="space-y-2 max-h-60 overflow-y-auto pr-1">
          ${(patient.progressNotes || []).map(n => `
            <div class="p-3 rounded-xl border border-slate-200 bg-white">
              <div class="flex items-center justify-between text-[11px] mb-1">
                <span class="font-bold text-slate-800">${n.author} (${n.type})</span>
                <span class="text-slate-400 font-mono">${n.date} &bull; Day ${n.sobrietyDays}</span>
              </div>
              <p class="text-slate-600 leading-relaxed">${n.note}</p>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Tab 4: Vitals & Drug Screens -->
      <div id="tab-vitals" class="dossier-tab-content hidden space-y-4 text-xs">
        <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
          <h4 class="font-bold text-slate-700 mb-2">Log Daily Vitals &amp; Drug Screening Screen</h4>
          <div class="grid grid-cols-3 md:grid-cols-5 gap-2 mb-2">
            <input type="text" id="vital-bp" placeholder="BP: 120/80" class="px-2 py-1.5 rounded-lg border border-slate-200">
            <input type="number" id="vital-pulse" placeholder="Pulse: 72" class="px-2 py-1.5 rounded-lg border border-slate-200">
            <input type="text" id="vital-temp" placeholder="Temp: 98.4°F" class="px-2 py-1.5 rounded-lg border border-slate-200">
            <input type="text" id="vital-o2" placeholder="O2: 99%" class="px-2 py-1.5 rounded-lg border border-slate-200">
            <select id="vital-screen" class="px-2 py-1.5 rounded-lg border border-slate-200">
              <option value="Negative">Screen: Negative</option>
              <option value="Positive (Under Review)">Screen: Positive</option>
            </select>
          </div>
          <div class="flex justify-end">
            <button id="submit-vital-btn" class="px-4 py-1.5 rounded-lg font-bold btn-decor-primary">Record Vitals</button>
          </div>
        </div>

        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b-2 border-slate-200 text-[11px] text-slate-400 uppercase font-semibold">
              <th class="py-2">Date</th>
              <th class="py-2">BP</th>
              <th class="py-2">Pulse</th>
              <th class="py-2">Temp</th>
              <th class="py-2">O2</th>
              <th class="py-2">Drug Screen</th>
              <th class="py-2">Recorded By</th>
            </tr>
          </thead>
          <tbody>
            ${(patient.vitals || []).map(v => `
              <tr class="border-b border-slate-100">
                <td class="py-2 font-mono">${v.date}</td>
                <td class="py-2 font-bold">${v.bp}</td>
                <td class="py-2">${v.pulse} bpm</td>
                <td class="py-2">${v.temp}</td>
                <td class="py-2">${v.o2}</td>
                <td class="py-2 font-bold ${v.drugScreenResult.includes('Negative') ? 'text-emerald-700' : 'text-amber-700'}">${v.drugScreenResult}</td>
                <td class="py-2 text-slate-500">${v.recordedBy}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Tab 5: Prescriptions -->
      <div id="tab-rx" class="dossier-tab-content hidden space-y-4 text-xs">
        <div class="flex items-center justify-between mb-2">
          <h4 class="font-bold text-slate-800">Active Prescriptions on File</h4>
          ${window.Auth.hasPermission('medications') ? `
            <button id="btn-add-rx-patient" class="px-3 py-1.5 rounded-lg btn-decor-primary text-xs font-bold flex items-center gap-1">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i>
              <span>Add Prescription</span>
            </button>
          ` : ''}
        </div>

        <div class="space-y-2">
          ${(patient.prescriptions || []).map(rx => `
            <div class="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <div class="font-bold text-slate-900">${rx.medicationName} (${rx.dosage})</div>
                <div class="text-[11px] text-slate-500">${rx.frequency} &bull; Times: ${(rx.times || []).join(', ')}</div>
                <div class="text-[10px] text-slate-400 mt-0.5">Prescriber: ${rx.prescribingDoctor} &bull; ${rx.instructions || ''}</div>
              </div>
              <span class="badge-medical-emerald px-2 py-0.5 rounded-full text-[10px] font-bold">${rx.status}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Tab 6: Billing & Receipts -->
      ${window.Auth.hasPermission('payments') ? `
        <div id="tab-billing" class="dossier-tab-content hidden space-y-4 text-xs">
          
          <!-- Balance Summary Banner -->
          <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
            <div class="p-2.5 bg-white rounded-lg border border-slate-200">
              <span class="text-slate-400 block text-[10px] font-bold uppercase">Total Invoiced</span>
              <span class="text-base font-black text-slate-900 font-mono">${window.AppStore.formatCurrency(resInvoiced)}</span>
            </div>
            <div class="p-2.5 bg-white rounded-lg border border-emerald-200">
              <span class="text-emerald-700 block text-[10px] font-bold uppercase">Total Paid</span>
              <span class="text-base font-black text-emerald-700 font-mono">${window.AppStore.formatCurrency(resPaid)}</span>
            </div>
            <div class="p-2.5 bg-white rounded-lg border ${resBalance > 0 ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200'}">
              <span class="${resBalance > 0 ? 'text-amber-800' : 'text-slate-400'} block text-[10px] font-bold uppercase">Outstanding Balance</span>
              <span class="text-base font-black ${resBalance > 0 ? 'text-amber-600' : 'text-slate-800'} font-mono">${window.AppStore.formatCurrency(resBalance)}</span>
            </div>
          </div>

          <!-- Action bar -->
          <div class="flex items-center justify-between">
            <h4 class="font-bold text-slate-800">Billing &amp; Payment History (${residentPayments.length})</h4>
            <button id="btn-patient-record-payment" class="px-3 py-1.5 rounded-lg btn-decor-primary text-xs font-bold flex items-center gap-1.5 shadow-sm">
              <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
              <span>Record Payment for Resident</span>
            </button>
          </div>

          <!-- History Table -->
          ${residentPayments.length > 0 ? `
            <div class="border border-slate-200 rounded-xl overflow-hidden">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                    <th class="py-2.5 px-3">Invoice &amp; Date</th>
                    <th class="py-2.5 px-3">Category</th>
                    <th class="py-2.5 px-3 text-right">Total (TZS)</th>
                    <th class="py-2.5 px-3 text-right">Paid (TZS)</th>
                    <th class="py-2.5 px-3 text-right">Balance</th>
                    <th class="py-2.5 px-3 text-center">Status</th>
                    <th class="py-2.5 px-3 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${residentPayments.map(pay => `
                    <tr class="hover:bg-slate-50 transition">
                      <td class="py-2.5 px-3 font-mono font-bold text-slate-900">
                        ${pay.invoiceNumber}
                        <div class="text-[10px] font-normal text-slate-400">${pay.date}</div>
                      </td>
                      <td class="py-2.5 px-3">
                        <span class="font-semibold text-slate-800">${pay.category}</span>
                        <div class="text-[10px] text-slate-400">${pay.paymentMethod}</div>
                      </td>
                      <td class="py-2.5 px-3 text-right font-mono font-bold text-slate-800">${window.AppStore.formatCurrency(pay.totalAmount)}</td>
                      <td class="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">${window.AppStore.formatCurrency(pay.amountPaid)}</td>
                      <td class="py-2.5 px-3 text-right font-mono font-bold ${pay.balance > 0 ? 'text-amber-600' : 'text-slate-400'}">${window.AppStore.formatCurrency(pay.balance)}</td>
                      <td class="py-2.5 px-3 text-center">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${pay.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : (pay.status === 'Partial' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800')}">
                          ${pay.status}
                        </span>
                      </td>
                      <td class="py-2.5 px-3 text-right">
                        <button class="p-1 rounded text-teal-700 hover:bg-teal-50 font-bold text-[11px] flex items-center gap-1 ml-auto" onclick="window.AppDocs.openPaymentReceipt('${pay.id}')">
                          <i data-lucide="printer" class="w-3.5 h-3.5"></i>
                          <span>Receipt</span>
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div class="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <i data-lucide="receipt" class="w-8 h-8 mx-auto text-slate-300 mb-2"></i>
              <p class="font-bold text-slate-600">No invoices or billing records on file for ${patient.name}</p>
              <p class="text-[11px] text-slate-400 mt-0.5">Record admission fees, stay rent, or prescription expenses.</p>
            </div>
          `}

        </div>
      ` : ''}
      </div>
    `;

    window.AppModal.showCustom(html, 'max-w-3xl');

    document.getElementById('modal-close-btn').onclick = () => window.AppModal.close();
    document.getElementById('modal-dossier-pdf-btn').onclick = () => window.AppDocs.openPatientDossier(patient.id);

    // Tab switching
    document.querySelectorAll('.dossier-tab-btn').forEach(tabBtn => {
      tabBtn.onclick = () => {
        document.querySelectorAll('.dossier-tab-btn').forEach(b => {
          b.classList.remove('active', 'border-teal-600', 'text-teal-700');
          b.classList.add('border-transparent', 'text-slate-500');
        });
        tabBtn.classList.add('active', 'border-teal-600', 'text-teal-700');
        tabBtn.classList.remove('border-transparent', 'text-slate-500');

        const targetId = tabBtn.getAttribute('data-tab');
        document.querySelectorAll('.dossier-tab-content').forEach(c => c.classList.add('hidden'));
        document.getElementById(targetId).classList.remove('hidden');
      };
    });

    // Record Payment for resident directly from dossier
    const recordPayBtn = document.getElementById('btn-patient-record-payment');
    if (recordPayBtn) {
      recordPayBtn.onclick = () => {
        window.AppModal.close();
        if (window.PaymentsViewInstance) {
          window.PaymentsViewInstance.openNewPaymentModal(patient.id);
        } else if (window.AppRouter) {
          window.AppRouter.navigate('payments');
          setTimeout(() => {
            if (window.PaymentsViewInstance) window.PaymentsViewInstance.openNewPaymentModal(patient.id);
          }, 100);
        }
      };
    }

    // Toggle Graduation Qualification
    const toggleGradBtn = document.getElementById('toggle-grad-btn');
    if (toggleGradBtn) {
      toggleGradBtn.onclick = () => {
        const nextState = !patient.graduationQualified;
        window.AppModal.close();

        window.AppModal.showAcceptanceCard({
          title: nextState ? 'Approve Resident for Graduation?' : 'Revoke Graduation Qualification?',
          subtitle: `Clinical qualification check for ${patient.name}`,
          icon: nextState ? 'award' : 'alert-triangle',
          badgeText: 'CLINICAL DIRECTOR REVIEW',
          badgeColor: nextState ? 'badge-medical-emerald' : 'badge-medical-rose',
          confirmType: nextState ? 'success' : 'danger',
          contentHtml: `
            <p class="leading-relaxed">
              ${nextState ? 
                `Has <strong>${patient.name}</strong> fulfilled the required <strong>${patient.sobrietyDays} days of sobriety</strong>, continuous negative drug screenings, and completed the 12-step recovery program? This will generate their official Certificate of Release.` :
                `Are you sure you want to revoke the qualification status for <strong>${patient.name}</strong>?`
              }
            </p>
          `,
          confirmText: nextState ? 'Confirm Qualification & Release' : 'Revoke Status',
          cancelText: 'Cancel',
          onConfirm: () => {
            window.AppStore.markGraduationQualified(patient.id, nextState);
            window.AppModal.close();
            if (nextState) {
              window.AppDocs.openGraduationCertificate(patient.id);
            }
          }
        });
      };
    }

    // Submit Note
    const submitNoteBtn = document.getElementById('submit-note-btn');
    if (submitNoteBtn) {
      submitNoteBtn.onclick = () => {
        const text = document.getElementById('new-note-text').value.trim();
        if (!text) return;
        window.AppStore.addProgressNote(patient.id, {
          note: text,
          type: document.getElementById('new-note-type').value,
          sobrietyDays: parseInt(document.getElementById('new-note-streak').value) || patient.sobrietyDays
        });
        this.openPatientDetailsModal(patient.id);
      };
    }

    // Submit Vital
    const submitVitalBtn = document.getElementById('submit-vital-btn');
    if (submitVitalBtn) {
      submitVitalBtn.onclick = () => {
        const bp = document.getElementById('vital-bp').value || '120/80';
        window.AppStore.addVitalRecord(patient.id, {
          bp: bp,
          pulse: parseInt(document.getElementById('vital-pulse').value) || 72,
          temp: document.getElementById('vital-temp').value || '98.6°F',
          o2: document.getElementById('vital-o2').value || '99%',
          drugScreenResult: document.getElementById('vital-screen').value
        });
        this.openPatientDetailsModal(patient.id);
      };
    }

    // Add Prescription quick trigger
    const addRxBtn = document.getElementById('btn-add-rx-patient');
    if (addRxBtn) {
      addRxBtn.onclick = () => {
        window.AppModal.close();
        window.AppRouter.navigate('medications');
      };
    }

    // Modal Edit Profile trigger
    const modalEditBtn = document.getElementById('modal-edit-patient-btn');
    if (modalEditBtn) {
      modalEditBtn.onclick = () => {
        this.openEditPatientModal(patient.id);
      };
    }

    // Modal Delete Resident trigger
    const modalDeleteBtn = document.getElementById('modal-delete-patient-btn');
    if (modalDeleteBtn) {
      modalDeleteBtn.onclick = () => {
        this.confirmDeletePatient(patient.id, true);
      };
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  openEditPatientModal(patientId) {
    const state = window.AppStore.getState();
    const patient = state.patients.find(p => p.id === patientId);
    if (!patient) return;

    const nok = patient.nextOfKin || {};
    const psych = patient.psychiatricHistory || {};

    const html = `
      <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
        <div>
          <h3 class="text-lg font-bold text-slate-900">Edit Resident Profile</h3>
          <p class="text-xs text-slate-500">Update medical demographics, bed placement, next of kin, and clinical assessments</p>
        </div>
        <button id="close-edit-patient-modal" class="p-1 text-slate-400 hover:bg-slate-100 rounded-lg">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <form id="edit-patient-form" class="space-y-4 text-xs max-h-[75vh] overflow-y-auto pr-1">
        <!-- Personal Demographics -->
        <div class="space-y-3">
          <h4 class="text-xs font-bold text-teal-800 uppercase tracking-wider">1. Resident Demographics &amp; Placement</h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Full Legal Name *</label>
              <input type="text" id="edit-name" required value="${patient.name}" class="w-full px-3 py-2 rounded-lg border border-slate-200 font-semibold">
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Date of Birth *</label>
              <input type="date" id="edit-dob" required value="${patient.dob || '1995-01-01'}" class="w-full px-3 py-2 rounded-lg border border-slate-200">
            </div>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Gender *</label>
              <select id="edit-gender" class="w-full px-3 py-2 rounded-lg border border-slate-200">
                <option value="Male" ${patient.gender === 'Male' ? 'selected' : ''}>Male</option>
                <option value="Female" ${patient.gender === 'Female' ? 'selected' : ''}>Female</option>
                <option value="Other" ${patient.gender === 'Other' ? 'selected' : ''}>Other</option>
              </select>
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Blood Group</label>
              <select id="edit-blood" class="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono">
                ${['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(bg => `<option value="${bg}" ${patient.bloodGroup === bg ? 'selected' : ''}>${bg}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Contact Phone</label>
              <input type="text" id="edit-phone" value="${patient.phone || ''}" placeholder="+255 700 000 000" class="w-full px-3 py-2 rounded-lg border border-slate-200">
            </div>
          </div>

          <div class="grid grid-cols-4 gap-3">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Room Number *</label>
              <input type="text" id="edit-room" required value="${patient.roomNumber}" class="w-full px-3 py-2 rounded-lg border border-slate-200">
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Bed Number *</label>
              <input type="text" id="edit-bed" required value="${patient.bedNumber}" class="w-full px-3 py-2 rounded-lg border border-slate-200">
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Recovery Stage *</label>
              <select id="edit-stage" class="w-full px-3 py-2 rounded-lg border border-slate-200 font-bold text-teal-800">
                <option value="Detoxification" ${patient.stage === 'Detoxification' ? 'selected' : ''}>Detoxification</option>
                <option value="Inpatient Recovery" ${patient.stage === 'Inpatient Recovery' ? 'selected' : ''}>Inpatient Recovery</option>
                <option value="Transition / Halfway" ${patient.stage === 'Transition / Halfway' ? 'selected' : ''}>Transition / Halfway</option>
                <option value="Graduated" ${patient.stage === 'Graduated' ? 'selected' : ''}>Graduated</option>
              </select>
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Sobriety Days *</label>
              <input type="number" id="edit-streak" min="0" required value="${patient.sobrietyDays || 0}" class="w-full px-3 py-2 rounded-lg border border-slate-200 font-bold text-teal-700">
            </div>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Profile Photo URL</label>
            <input type="url" id="edit-photo" value="${patient.photo || ''}" placeholder="https://..." class="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-[11px]">
          </div>
        </div>

        <!-- Next of Kin Section -->
        <div class="pt-3 border-t border-slate-200 space-y-3">
          <h4 class="text-xs font-bold text-teal-800 uppercase tracking-wider">2. Next of Kin &amp; Emergency Contact</h4>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Kin Full Name *</label>
              <input type="text" id="edit-nok-name" required value="${nok.name || ''}" class="w-full px-3 py-2 rounded-lg border border-slate-200">
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Relationship *</label>
              <input type="text" id="edit-nok-rel" required value="${nok.relationship || ''}" class="w-full px-3 py-2 rounded-lg border border-slate-200">
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Emergency Phone *</label>
              <input type="text" id="edit-nok-phone" required value="${nok.phone || ''}" class="w-full px-3 py-2 rounded-lg border border-slate-200">
            </div>
          </div>
        </div>

        <!-- Psychiatric & Clinical Assessment -->
        <div class="pt-3 border-t border-slate-200 space-y-3">
          <h4 class="text-xs font-bold text-teal-800 uppercase tracking-wider">3. Psychiatric History &amp; Substance Profile</h4>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Primary Substance *</label>
              <input type="text" id="edit-substance" required value="${psych.primarySubstance || 'Opioids'}" class="w-full px-3 py-2 rounded-lg border border-slate-200 font-semibold text-rose-700">
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Addiction Duration (Yrs)</label>
              <input type="number" id="edit-duration" min="0" value="${psych.addictionDurationYears || 1}" class="w-full px-3 py-2 rounded-lg border border-slate-200">
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Suicide Risk Level</label>
              <select id="edit-risk" class="w-full px-3 py-2 rounded-lg border border-slate-200 font-bold">
                <option value="Low" ${psych.suicideRisk === 'Low' ? 'selected' : ''}>Low Risk</option>
                <option value="Moderate" ${psych.suicideRisk === 'Moderate' ? 'selected' : ''}>Moderate Risk</option>
                <option value="High" ${psych.suicideRisk === 'High' ? 'selected' : ''}>High Risk</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Psychiatric Diagnoses (Semicolon separated)</label>
              <input type="text" id="edit-diagnoses" value="${(psych.diagnoses || []).join('; ')}" placeholder="PTSD; Severe Depressive Episode" class="w-full px-3 py-2 rounded-lg border border-slate-200">
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Allergies (Semicolon separated)</label>
              <input type="text" id="edit-allergies" value="${(psych.allergies || []).join('; ')}" placeholder="Penicillin; Sulfa Drugs" class="w-full px-3 py-2 rounded-lg border border-slate-200">
            </div>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Clinical Assessment &amp; Notes</label>
            <textarea id="edit-notes" rows="2" class="w-full px-3 py-2 rounded-lg border border-slate-200">${psych.notes || ''}</textarea>
          </div>
        </div>

        <div class="pt-4 border-t border-slate-200 flex justify-end gap-3">
          <button type="button" id="cancel-edit-patient-btn" class="px-4 py-2 rounded-xl btn-decor-secondary font-semibold">Cancel</button>
          <button type="submit" class="px-5 py-2 rounded-xl btn-decor-primary font-bold">Save Changes</button>
        </div>
      </form>
    `;

    window.AppModal.showCustom(html, 'max-w-3xl');

    document.getElementById('close-edit-patient-modal').onclick = () => window.AppModal.close();
    document.getElementById('cancel-edit-patient-btn').onclick = () => window.AppModal.close();

    document.getElementById('edit-patient-form').onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="animate-spin inline-block mr-1">⏳</span> Updating...';
      }

      const updates = {
        name: document.getElementById('edit-name').value.trim(),
        dob: document.getElementById('edit-dob').value,
        gender: document.getElementById('edit-gender').value,
        bloodGroup: document.getElementById('edit-blood').value,
        phone: document.getElementById('edit-phone').value.trim(),
        photo: document.getElementById('edit-photo').value || patient.photo,
        roomNumber: document.getElementById('edit-room').value,
        bedNumber: document.getElementById('edit-bed').value,
        stage: document.getElementById('edit-stage').value,
        sobrietyDays: parseInt(document.getElementById('edit-sobriety').value) || 1,
        nextOfKin: {
          name: document.getElementById('edit-nok-name').value.trim(),
          relationship: document.getElementById('edit-nok-rel').value.trim(),
          phone: document.getElementById('edit-nok-phone').value.trim(),
          address: nok.address || 'On file',
          emergencyConsent: true
        },
        psychiatricHistory: {
          primarySubstance: document.getElementById('edit-substance').value.trim(),
          secondarySubstance: psych.secondarySubstance || 'None',
          addictionDurationYears: parseInt(document.getElementById('edit-duration').value) || psych.addictionDurationYears || 1,
          priorRehabs: psych.priorRehabs || 0,
          diagnoses: document.getElementById('edit-diagnoses').value.split(';').map(d => d.trim()).filter(Boolean),
          suicideRisk: document.getElementById('edit-risk').value,
          allergies: document.getElementById('edit-allergies').value.split(';').map(a => a.trim()).filter(Boolean),
          notes: document.getElementById('edit-notes').value
        }
      };

      try {
        await window.AppStore.updatePatient(patientId, updates);
        window.AppModal.close();

        window.AppModal.showAcceptanceCard({
          title: 'Resident Profile Updated',
          subtitle: `Clinical records for ${updates.name} (${patient.id}) have been saved`,
          icon: 'check-circle-2',
          badgeText: 'PROFILE UPDATED',
          badgeColor: 'badge-medical-emerald',
          confirmType: 'success',
          confirmText: 'View Dossier',
          cancelText: 'Close',
          onConfirm: () => {
            this.openPatientDetailsModal(patientId);
          }
        });
      } catch (err) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Save Changes';
        }
        window.AppModal.close();
      }
    };

    if (window.lucide) window.lucide.createIcons();
  }

  confirmDeletePatient(patientId, fromModal = false) {
    const state = window.AppStore.getState();
    const patient = state.patients.find(p => p.id === patientId);
    if (!patient) return;

    window.AppModal.confirm(
      'Delete Resident Record?',
      `Are you sure you want to permanently delete resident ${patient.name} (${patient.id})? All associated daily vitals, progress notes, and MAR medication history will be deleted.`,
      'Delete Record',
      'danger'
    ).then(async confirmed => {
      if (confirmed) {
        await window.AppStore.deletePatient(patientId);
        if (fromModal) {
          window.AppModal.close();
        }
        window.AppModal.showAcceptanceCard({
          title: 'Resident Record Deleted',
          subtitle: `${patient.name} was permanently removed from the system`,
          icon: 'check-circle-2',
          badgeText: 'RECORD REMOVED',
          badgeColor: 'badge-medical-rose',
          confirmType: 'danger',
          confirmText: 'Done'
        });
      }
    });
  }
}

window.PatientsView = PatientsView;
