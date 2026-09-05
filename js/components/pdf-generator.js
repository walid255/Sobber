/**
 * SerenityCare PDF & Printable Medical Document Generator
 * Generates high-fidelity Patient Medical Dossiers, Graduation Certificates, and Inventory Reports.
 */

class DocumentGenerator {
  constructor() {
    this.store = window.AppStore;
  }

  /**
   * Generates and previews a complete Medical Dossier for a specific patient
   */
  openPatientDossier(patientId) {
    const state = this.store.getState();
    const patient = state.patients.find(p => p.id === patientId);
    const facility = state.facility;

    if (!patient) {
      window.AppModal.alert('Error', 'Patient record not found.', 'danger');
      return;
    }

    const vitalsRows = (patient.vitals || []).map(v => `
      <tr class="border-b border-slate-200">
        <td class="py-2 text-xs font-mono">${v.date}</td>
        <td class="py-2 text-xs font-bold text-slate-800">${v.bp}</td>
        <td class="py-2 text-xs">${v.pulse} bpm</td>
        <td class="py-2 text-xs">${v.temp}</td>
        <td class="py-2 text-xs">${v.o2}</td>
        <td class="py-2 text-xs font-bold ${v.drugScreenResult.includes('Negative') ? 'text-emerald-700' : 'text-amber-700'}">${v.drugScreenResult}</td>
        <td class="py-2 text-xs text-slate-500">${v.recordedBy}</td>
      </tr>
    `).join('') || '<tr><td colspan="7" class="py-2 text-center text-xs text-slate-400">No vitals logged yet</td></tr>';

    const notesRows = (patient.progressNotes || []).map(n => `
      <div class="mb-3 pb-3 border-b border-slate-100 last:border-0">
        <div class="flex items-center justify-between text-xs mb-1">
          <span class="font-bold text-slate-800">${n.author} (${n.type})</span>
          <span class="text-slate-400 font-mono">${n.date} &bull; Day ${n.sobrietyDays}</span>
        </div>
        <p class="text-xs text-slate-600 leading-relaxed">${n.note}</p>
      </div>
    `).join('') || '<p class="text-xs text-slate-400">No clinical progress notes recorded.</p>';

    const rxRows = (patient.prescriptions || []).map(rx => `
      <tr class="border-b border-slate-200">
        <td class="py-2 text-xs font-bold text-slate-800">${rx.medicationName}</td>
        <td class="py-2 text-xs">${rx.dosage}</td>
        <td class="py-2 text-xs">${rx.frequency}</td>
        <td class="py-2 text-xs font-mono">${(rx.times || []).join(', ')}</td>
        <td class="py-2 text-xs text-slate-500">${rx.prescribingDoctor}</td>
        <td class="py-2 text-xs"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${rx.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">${rx.status}</span></td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="py-2 text-center text-xs text-slate-400">No prescriptions on file</td></tr>';

    const printContainerId = 'dossier-print-area';

    const html = `
      <div class="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
        <div class="flex items-center gap-2">
          <i data-lucide="file-text" class="w-5 h-5 text-teal-600"></i>
          <h3 class="text-lg font-bold text-slate-900">Clinical Dossier: ${patient.name} (${patient.id})</h3>
        </div>
        <div class="flex items-center gap-2">
          <button id="print-dossier-btn" class="px-4 py-2 rounded-xl text-xs font-bold btn-decor-primary flex items-center gap-1.5">
            <i data-lucide="printer" class="w-4 h-4"></i>
            <span>Print / Save PDF</span>
          </button>
          <button id="close-dossier-btn" class="px-3 py-2 rounded-xl text-xs font-semibold btn-decor-secondary">
            Close
          </button>
        </div>
      </div>

      <!-- Printable Dossier Canvas -->
      <div id="${printContainerId}" class="bg-white p-8 border border-slate-300 rounded-xl text-slate-800 shadow-sm max-h-[75vh] overflow-y-auto">
        
        <!-- Header -->
        <div class="flex items-start justify-between border-b-2 border-teal-600 pb-4 mb-6">
          <div>
            <h1 class="text-2xl font-black tracking-tight text-slate-900">${facility.name}</h1>
            <p class="text-xs text-slate-500 font-medium">${facility.address} &bull; Tel: ${facility.phone}</p>
            <p class="text-xs text-teal-700 font-mono font-semibold mt-0.5">License: ${facility.licenseNumber} &bull; Confidential Medical Record</p>
          </div>
          <div class="text-right">
            <span class="inline-block px-3 py-1 bg-teal-100 text-teal-800 font-bold text-xs rounded-full uppercase tracking-wider mb-1">Confidential Record</span>
            <div class="text-xs text-slate-400">Date Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
        </div>

        <!-- Demographics & Photo Grid -->
        <div class="grid grid-cols-4 gap-6 p-4 bg-slate-50 border border-slate-200 rounded-xl mb-6">
          <div class="col-span-1 flex flex-col items-center justify-center">
            <img src="${patient.photo}" alt="${patient.name}" class="w-28 h-28 rounded-xl object-cover border-2 border-white shadow-sm mb-2">
            <span class="text-xs font-bold text-slate-700">${patient.id}</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 mt-1">${patient.stage}</span>
          </div>
          <div class="col-span-3 grid grid-cols-2 gap-4 text-xs">
            <div>
              <span class="text-slate-400 block font-semibold">Full Legal Name</span>
              <strong class="text-sm text-slate-900">${patient.name}</strong>
            </div>
            <div>
              <span class="text-slate-400 block font-semibold">Date of Birth / Age / Gender</span>
              <strong class="text-slate-900">${patient.dob} (${patient.age} yrs) &bull; ${patient.gender}</strong>
            </div>
            <div>
              <span class="text-slate-400 block font-semibold">Admission Date &amp; Stay Duration</span>
              <strong class="text-slate-900">${patient.admissionDate} (${patient.sobrietyDays} Days Sober)</strong>
            </div>
            <div>
              <span class="text-slate-400 block font-semibold">Assigned Room &amp; Bed</span>
              <strong class="text-slate-900">${patient.roomNumber} - ${patient.bedNumber}</strong>
            </div>
            <div>
              <span class="text-slate-400 block font-semibold">Primary Contact Phone / Email</span>
              <strong class="text-slate-900">${patient.phone} &bull; ${patient.email}</strong>
            </div>
            <div>
              <span class="text-slate-400 block font-semibold">Blood Group &amp; Allergies</span>
              <strong class="text-rose-700">${patient.bloodGroup} &bull; Allergies: ${(patient.psychiatricHistory.allergies || []).join(', ') || 'None'}</strong>
            </div>
          </div>
        </div>

        <!-- Emergency Contact & Next of Kin -->
        <div class="mb-6 p-4 border border-slate-200 rounded-xl">
          <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <i data-lucide="shield-alert" class="w-3.5 h-3.5 text-teal-600"></i>
            <span>Designated Next of Kin &amp; Emergency Authorized Representative</span>
          </h4>
          <div class="grid grid-cols-3 gap-4 text-xs">
            <div>
              <span class="text-slate-400 block">Name &amp; Relationship</span>
              <strong class="text-slate-800">${patient.nextOfKin.name} (${patient.nextOfKin.relationship})</strong>
            </div>
            <div>
              <span class="text-slate-400 block">Contact Phone</span>
              <strong class="text-slate-800">${patient.nextOfKin.phone}</strong>
            </div>
            <div>
              <span class="text-slate-400 block">Physical Address</span>
              <strong class="text-slate-800">${patient.nextOfKin.address || 'On File'}</strong>
            </div>
          </div>
        </div>

        <!-- Psychiatric Evaluation & Addiction Background -->
        <div class="mb-6 p-4 bg-teal-50/50 border border-teal-200 rounded-xl">
          <h4 class="text-xs font-bold text-teal-800 uppercase tracking-wider mb-3">Psychiatric &amp; Substance Abuse Intake Evaluation</h4>
          <div class="grid grid-cols-3 gap-4 text-xs mb-3">
            <div>
              <span class="text-slate-500 block">Primary Substance of Abuse</span>
              <strong class="text-rose-700 font-bold">${patient.psychiatricHistory.primarySubstance}</strong>
            </div>
            <div>
              <span class="text-slate-500 block">Duration of Addiction</span>
              <strong class="text-slate-800">${patient.psychiatricHistory.addictionDurationYears} Years (${patient.psychiatricHistory.priorRehabs} Prior Rehabs)</strong>
            </div>
            <div>
              <span class="text-slate-500 block">Suicide Risk Assessment</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold ${patient.psychiatricHistory.suicideRisk.includes('Low') ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">${patient.psychiatricHistory.suicideRisk}</span>
            </div>
          </div>
          <div class="text-xs mb-2">
            <span class="text-slate-500 block">Clinical Co-Occurring Diagnoses:</span>
            <div class="flex flex-wrap gap-1.5 mt-1">
              ${(patient.psychiatricHistory.diagnoses || []).map(d => `<span class="px-2 py-0.5 rounded bg-white border border-teal-200 text-teal-800 font-semibold text-[11px]">${d}</span>`).join('')}
            </div>
          </div>
          <div class="text-xs text-slate-700 italic mt-2 bg-white/80 p-2.5 rounded-lg border border-teal-100">
            "${patient.psychiatricHistory.notes}"
          </div>
        </div>

        <!-- Active Prescriptions -->
        <div class="mb-6">
          <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Prescription &amp; Medication Administration Profile</h4>
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b-2 border-slate-200 text-xs text-slate-400 font-semibold uppercase">
                <th class="py-2">Medication</th>
                <th class="py-2">Dosage</th>
                <th class="py-2">Frequency</th>
                <th class="py-2">Times</th>
                <th class="py-2">Prescriber</th>
                <th class="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              ${rxRows}
            </tbody>
          </table>
        </div>

        <!-- Vital Signs Log -->
        <div class="mb-6">
          <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Recent Clinical Vitals &amp; Drug Screening Record</h4>
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b-2 border-slate-200 text-xs text-slate-400 font-semibold uppercase">
                <th class="py-2">Date/Time</th>
                <th class="py-2">BP</th>
                <th class="py-2">Pulse</th>
                <th class="py-2">Temp</th>
                <th class="py-2">O2</th>
                <th class="py-2">Screen Result</th>
                <th class="py-2">Clinician</th>
              </tr>
            </thead>
            <tbody>
              ${vitalsRows}
            </tbody>
          </table>
        </div>

        <!-- Daily Progress Notes -->
        <div class="mb-8">
          <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Chronological Progress &amp; Counseling Notes</h4>
          <div class="space-y-2">
            ${notesRows}
          </div>
        </div>

        <!-- Signatures and Attestation -->
        <div class="grid grid-cols-2 gap-12 pt-6 border-t-2 border-slate-200 text-xs">
          <div>
            <div class="h-10 border-b border-slate-400 flex items-end">
              <span class="font-serif italic text-sm text-slate-700">${facility.director}</span>
            </div>
            <div class="mt-1 font-bold text-slate-800">${facility.director}</div>
            <div class="text-[11px] text-slate-500">Medical Director &amp; Board Certified Addictionist</div>
          </div>
          <div>
            <div class="h-10 border-b border-slate-400 flex items-end">
              <span class="font-serif italic text-sm text-slate-700">${facility.leadCounselor}</span>
            </div>
            <div class="mt-1 font-bold text-slate-800">${facility.leadCounselor}</div>
            <div class="text-[11px] text-slate-500">Lead Clinical Counselor &amp; Case Manager</div>
          </div>
        </div>

      </div>
    `;

    window.AppModal.showCustom(html, 'max-w-4xl');

    document.getElementById('close-dossier-btn').onclick = () => window.AppModal.close();
    document.getElementById('print-dossier-btn').onclick = () => this.printElement(printContainerId, `SerenityCare_Dossier_${patient.id}`);
  }

  /**
   * Generates and prints the official Certificate of Sobriety & Graduation
   */
  openGraduationCertificate(patientId) {
    const state = this.store.getState();
    const patient = state.patients.find(p => p.id === patientId);
    const facility = state.facility;

    if (!patient) {
      window.AppModal.alert('Error', 'Resident not found.', 'danger');
      return;
    }

    const certDate = patient.graduationDate || new Date().toISOString().split('T')[0];
    const certNumber = `SC-GRAD-${patient.id}-${certDate.replace(/-/g, '')}`;
    const certAreaId = 'cert-print-area';

    const html = `
      <div class="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
        <div class="flex items-center gap-2">
          <i data-lucide="award" class="w-5 h-5 text-amber-500"></i>
          <h3 class="text-lg font-bold text-slate-900">Certificate of Completion &amp; Sobriety</h3>
        </div>
        <div class="flex items-center gap-2">
          <button id="print-cert-btn" class="px-4 py-2 rounded-xl text-xs font-bold btn-decor-success flex items-center gap-1.5">
            <i data-lucide="printer" class="w-4 h-4"></i>
            <span>Print Certificate</span>
          </button>
          <button id="close-cert-btn" class="px-3 py-2 rounded-xl text-xs font-semibold btn-decor-secondary">
            Close
          </button>
        </div>
      </div>

      <!-- Printable Certificate Container -->
      <div id="${certAreaId}" class="p-4 bg-amber-50/20 max-h-[75vh] overflow-y-auto">
        <div class="relative bg-white p-10 mx-auto max-w-3xl border-8 border-double border-teal-800 shadow-xl rounded-lg text-center font-diploma select-none print-certificate-container"
             style="background-image: radial-gradient(#0d9488 0.5px, transparent 0.5px); background-size: 24px 24px;">
          
          <!-- Ornate Corner Ornaments -->
          <div class="absolute top-2 left-2 text-teal-700 text-2xl font-serif">❧</div>
          <div class="absolute top-2 right-2 text-teal-700 text-2xl font-serif">☙</div>
          <div class="absolute bottom-2 left-2 text-teal-700 text-2xl font-serif">❧</div>
          <div class="absolute bottom-2 right-2 text-teal-700 text-2xl font-serif">☙</div>

          <!-- Header -->
          <div class="text-xs uppercase tracking-[0.3em] text-teal-800 font-bold mb-1">${facility.name}</div>
          <div class="text-[10px] text-slate-500 uppercase tracking-widest mb-6">${facility.address} &bull; LIC. ${facility.licenseNumber}</div>

          <h2 class="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-wider mb-2 font-diploma uppercase">
            Certificate of Sobriety &amp; Release
          </h2>
          <div class="h-0.5 w-32 bg-gradient-to-r from-transparent via-teal-600 to-transparent mx-auto mb-6"></div>

          <p class="text-xs uppercase tracking-widest text-slate-500 mb-4">This is to officially honor and certify that</p>
          
          <!-- Candidate Name -->
          <div class="text-3xl md:text-4xl font-black text-teal-900 italic mb-4 font-serif border-b-2 border-teal-500 inline-block px-8 pb-1">
            ${patient.name}
          </div>

          <!-- Milestone Statement -->
          <p class="text-xs md:text-sm text-slate-700 max-w-xl mx-auto leading-relaxed mt-4 font-sans font-normal">
            has successfully completed the intensive residential addiction recovery curriculum, 
            demonstrated steadfast moral courage, passed all clinical toxicology screenings, and maintained 
            an exemplary record of
          </p>

          <!-- Sobriety Days Badge -->
          <div class="my-5 inline-flex items-center gap-3 px-6 py-2 bg-gradient-to-r from-teal-50 via-teal-100 to-teal-50 border border-teal-300 rounded-full">
            <i data-lucide="sparkles" class="w-5 h-5 text-amber-600"></i>
            <span class="text-base font-black text-teal-900 tracking-wider uppercase">${patient.sobrietyDays} Days of Continuous Sobriety</span>
            <i data-lucide="sparkles" class="w-5 h-5 text-amber-600"></i>
          </div>

          <p class="text-xs text-slate-600 max-w-lg mx-auto font-sans">
            and is hereby granted honorable release, qualified alumni standing, and our highest commendation for lifelong recovery.
          </p>

          <!-- Golden Seal & Signatures -->
          <div class="grid grid-cols-3 items-end gap-6 mt-12 pt-6 border-t border-slate-200">
            <div class="text-center font-sans">
              <div class="h-10 border-b border-slate-400 flex items-end justify-center">
                <span class="font-serif italic text-sm text-slate-700">${facility.director}</span>
              </div>
              <div class="mt-1 font-bold text-[11px] text-slate-800">${facility.director}</div>
              <div class="text-[10px] text-slate-500">Medical Director, FASAM</div>
            </div>

            <!-- Emblem Seal -->
            <div class="flex flex-col items-center justify-center">
              <div class="w-20 h-20 rounded-full border-4 border-amber-500 bg-amber-100/50 flex flex-col items-center justify-center shadow-inner text-amber-800">
                <i data-lucide="award" class="w-8 h-8 text-amber-600"></i>
                <span class="text-[8px] font-black uppercase tracking-tighter mt-0.5">OFFICIAL SEAL</span>
              </div>
              <span class="text-[9px] font-mono text-slate-400 mt-2">NO. ${certNumber}</span>
            </div>

            <div class="text-center font-sans">
              <div class="h-10 border-b border-slate-400 flex items-end justify-center">
                <span class="font-serif italic text-sm text-slate-700">${facility.leadCounselor}</span>
              </div>
              <div class="mt-1 font-bold text-slate-800 text-[11px]">${facility.leadCounselor}</div>
              <div class="text-[10px] text-slate-500">Lead Clinical Counselor, LCDC</div>
            </div>
          </div>

          <div class="text-[10px] text-slate-400 font-mono mt-6 font-sans">
            Conferred on ${certDate} &bull; SerenityCare Behavioral Health Network
          </div>

        </div>
      </div>
    `;

    window.AppModal.showCustom(html, 'max-w-4xl');

    document.getElementById('close-cert-btn').onclick = () => window.AppModal.close();
    document.getElementById('print-cert-btn').onclick = () => this.printElement(certAreaId, `SerenityCare_Certificate_${patient.id}`);
  }

  /**
   * Generates and prints the facility store Inventory Audit Report
   */
  openInventoryReport() {
    const state = this.store.getState();
    const inventory = state.inventory;
    const facility = state.facility;

    let totalValuation = 0;
    const rows = inventory.map(item => {
      const val = (item.quantity * item.cost);
      totalValuation += val;
      const isLow = item.quantity <= item.minThreshold;
      return `
        <tr class="border-b border-slate-200">
          <td class="py-2 font-mono text-xs">${item.code}</td>
          <td class="py-2 text-xs font-bold text-slate-800">${item.name}</td>
          <td class="py-2 text-xs">${item.category}</td>
          <td class="py-2 text-xs text-right font-bold ${isLow ? 'text-rose-600' : 'text-slate-800'}">${item.quantity} ${item.unit} ${isLow ? '⚠' : ''}</td>
          <td class="py-2 text-xs text-right font-mono">${window.I18n ? window.I18n.formatCurrency(item.cost) : `TZS ${item.cost.toLocaleString()}`}</td>
          <td class="py-2 text-xs text-right font-bold text-slate-900 font-mono">${window.I18n ? window.I18n.formatCurrency(val) : `TZS ${val.toLocaleString()}`}</td>
          <td class="py-2 text-xs text-slate-500">${item.location}</td>
        </tr>
      `;
    }).join('');

    const areaId = 'inventory-print-area';

    const html = `
      <div class="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
        <div class="flex items-center gap-2">
          <i data-lucide="boxes" class="w-5 h-5 text-teal-600"></i>
          <h3 class="text-lg font-bold text-slate-900">Store &amp; Pharmacy Inventory Audit Report</h3>
        </div>
        <div class="flex items-center gap-2">
          <button id="print-inv-btn" class="px-4 py-2 rounded-xl text-xs font-bold btn-decor-primary flex items-center gap-1.5">
            <i data-lucide="printer" class="w-4 h-4"></i>
            <span>Print Report</span>
          </button>
          <button id="close-inv-btn" class="px-3 py-2 rounded-xl text-xs font-semibold btn-decor-secondary">
            Close
          </button>
        </div>
      </div>

      <div id="${areaId}" class="p-6 bg-white border border-slate-300 rounded-xl text-slate-800 max-h-[75vh] overflow-y-auto">
        <div class="flex items-start justify-between border-b-2 border-teal-600 pb-3 mb-4">
          <div>
            <h2 class="text-xl font-black text-slate-900">${facility.name} - Facility Store &amp; Pharmacy</h2>
            <p class="text-xs text-slate-500">Official Stock Verification &amp; Valuation Audit</p>
          </div>
          <div class="text-right text-xs">
            <div>Date: <strong>${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong></div>
            <div class="text-slate-400">Auditor: ${state.currentUser.name}</div>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-4 mb-4 p-3 bg-slate-50 rounded-lg text-xs">
          <div>Total Cataloged Items: <strong>${inventory.length}</strong></div>
          <div>Low Stock Alerts: <strong class="text-rose-600">${inventory.filter(i => i.quantity <= i.minThreshold).length} items</strong></div>
          <div>Total Inventory Value: <strong class="text-teal-700 text-sm font-bold">${window.I18n ? window.I18n.formatCurrency(totalValuation) : `TZS ${totalValuation.toLocaleString()}`}</strong></div>
        </div>

        <table class="w-full text-left border-collapse mb-6">
          <thead>
            <tr class="border-b-2 border-slate-200 text-[11px] text-slate-500 font-semibold uppercase">
              <th class="py-2">Item Code</th>
              <th class="py-2">Item Name</th>
              <th class="py-2">Category</th>
              <th class="py-2 text-right">In Stock</th>
              <th class="py-2 text-right">Unit Cost (TZS)</th>
              <th class="py-2 text-right">Total Value (TZS)</th>
              <th class="py-2">Storage Location</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div class="pt-4 border-t border-slate-200 flex justify-between items-end text-xs text-slate-500">
          <div>Certified true and accurate record of facility inventory.</div>
          <div class="w-48 text-center border-t border-slate-400 pt-1">
            <span class="font-semibold text-slate-800">${state.currentUser.name}</span><br>Inventory Officer
          </div>
        </div>
      </div>
    `;

    window.AppModal.showCustom(html, 'max-w-4xl');

    document.getElementById('close-inv-btn').onclick = () => window.AppModal.close();
    document.getElementById('print-inv-btn').onclick = () => this.printElement(areaId, 'SerenityCare_Inventory_Report');
  }

  /**
   * Generates and previews an official payment receipt for an installment
   */
  openPaymentReceipt(patientId, installmentId) {
    const state = this.store.getState();
    const patient = state.patients.find(p => p.id === patientId);
    const fee = this.store.getResidentFee(patientId);
    const installments = this.store.getInstallmentPayments(patientId);
    const facility = state.facility;

    if (!patient || !fee) {
      window.AppModal.alert('Error', 'Resident or fee schedule not found.', 'danger');
      return;
    }

    const inst = (installmentId ? installments.find(i => i.id === installmentId) : null) ||
                 installments.filter(i => i.status === 'Paid').slice(-1)[0] ||
                 installments[0];

    const currency = fee.currency || facility.currency || 'TZS';
    const printAreaId = 'payment-receipt-print-area';
    const receiptNo = inst.reference_no || `REC-${patient.id.replace(/\D/g, '')}-${inst.installment_number || '1'}`;
    const paymentDate = inst.payment_date || new Date().toISOString().split('T')[0];

    const html = `
      <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
            <i data-lucide="receipt" class="w-4 h-4"></i>
          </div>
          <div>
            <h3 class="text-sm font-bold text-slate-800">Official Payment Receipt</h3>
            <span class="text-xs text-slate-400 font-mono">${receiptNo}</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button id="print-receipt-btn" class="px-3.5 py-1.5 rounded-xl btn-decor-primary text-xs font-bold flex items-center gap-1.5 shadow-sm">
            <i data-lucide="printer" class="w-3.5 h-3.5"></i>
            <span>Print Receipt</span>
          </button>
          <button id="close-receipt-btn" class="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
      </div>

      <!-- Printable Receipt Canvas -->
      <div id="${printAreaId}" class="p-6 bg-white border border-slate-200 rounded-2xl max-w-xl mx-auto space-y-6 text-slate-800">
        <!-- Receipt Header -->
        <div class="flex justify-between items-start border-b-2 border-teal-600 pb-4">
          <div>
            <h2 class="text-xl font-black tracking-tight text-teal-800">${facility.name}</h2>
            <p class="text-xs text-slate-500 mt-0.5">${facility.tagline || 'Inpatient Addiction Treatment & Psychiatric Recovery'}</p>
            <p class="text-[11px] text-slate-400 mt-1">${facility.address} &bull; Tel: ${facility.phone}</p>
          </div>
          <div class="text-right">
            <span class="inline-block px-3 py-1 rounded-md bg-teal-50 border border-teal-200 text-teal-800 font-mono font-bold text-xs">
              OFFICIAL RECEIPT
            </span>
            <div class="mt-2 text-right">
              <span class="text-[10px] uppercase font-bold text-slate-400 block">Receipt No</span>
              <strong class="font-mono text-xs text-slate-800">${receiptNo}</strong>
            </div>
          </div>
        </div>

        <!-- Meta Details Row -->
        <div class="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <div>
            <span class="text-slate-400 text-[10px] uppercase font-bold block mb-0.5">Resident / Patient:</span>
            <strong class="text-slate-900 text-sm block">${patient.name}</strong>
            <span class="text-slate-500 font-mono text-[11px]">ID: ${patient.id} &bull; Bed: ${patient.roomNumber} (${patient.bedNumber})</span>
          </div>
          <div class="text-right">
            <span class="text-slate-400 text-[10px] uppercase font-bold block mb-0.5">Payment Details:</span>
            <div class="font-mono text-xs text-slate-800">Date: <strong>${paymentDate}</strong></div>
            <div class="text-slate-600 text-[11px] mt-0.5">Method: <strong class="text-slate-800">${inst.payment_method || 'Cash'}</strong></div>
          </div>
        </div>

        <!-- Receipt Table -->
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="border-b-2 border-slate-200 text-slate-400 text-[10px] uppercase font-bold">
              <th class="py-2">Description</th>
              <th class="py-2 text-center">Installment</th>
              <th class="py-2 text-right">Amount Paid</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr>
              <td class="py-3 font-semibold text-slate-800">
                Inpatient Addiction Treatment &amp; Recovery Program
                <div class="text-[10px] text-slate-400 font-normal">Plan: ${fee.payment_plan} (${fee.frequency || 'Monthly'} cycle)</div>
              </td>
              <td class="py-3 text-center font-bold text-slate-700">
                ${inst.installment_number === 1 ? '1 (Admission Deposit)' : `#${inst.installment_number}`}
              </td>
              <td class="py-3 text-right font-mono font-black text-sm text-emerald-800">
                ${Number(inst.amount_paid || inst.amount_due).toLocaleString()} ${currency}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Totals & Balances -->
        <div class="border-t-2 border-slate-200 pt-3 space-y-1.5 text-xs">
          <div class="flex justify-between text-slate-600">
            <span>Total Program Fee:</span>
            <span class="font-mono font-semibold">${Number(fee.total_fee).toLocaleString()} ${currency}</span>
          </div>
          <div class="flex justify-between text-slate-600">
            <span>Total Cumulative Paid:</span>
            <span class="font-mono font-semibold text-emerald-700">${Number(fee.paid_amount).toLocaleString()} ${currency}</span>
          </div>
          <div class="flex justify-between items-center text-sm font-black border-t border-slate-200 pt-2 text-slate-900">
            <span>Remaining Balance Due:</span>
            <span class="font-mono ${Number(fee.remaining_balance) > 0 ? 'text-rose-700' : 'text-emerald-700'}">
              ${Number(fee.remaining_balance).toLocaleString()} ${currency}
            </span>
          </div>
        </div>

        <!-- Signatures & Footer -->
        <div class="pt-6 border-t border-dashed border-slate-300 flex justify-between items-end text-[11px] text-slate-500">
          <div class="w-44 text-center border-t border-slate-400 pt-1">
            <span class="font-semibold text-slate-800">${state.currentUser ? state.currentUser.name : 'Authorized Cashier'}</span><br>
            SerenityCare Finance / Accounts
          </div>
          <div class="w-44 text-center border-t border-slate-400 pt-1">
            <span class="font-semibold text-slate-800">Patient / Guarantor</span><br>
            Received &amp; Acknowledged
          </div>
        </div>
      </div>
    `;

    window.AppModal.showCustom(html, 'max-w-2xl');

    document.getElementById('close-receipt-btn').onclick = () => window.AppModal.close();
    document.getElementById('print-receipt-btn').onclick = () => this.printElement(printAreaId, `Receipt_${receiptNo}`);
    if (window.lucide) window.lucide.createIcons();
  }

  /**
   * Generates a complete Financial Statement of Account for a resident
   */
  openPaymentStatement(patientId) {
    const state = this.store.getState();
    const patient = state.patients.find(p => p.id === patientId);
    const fee = this.store.getResidentFee(patientId);
    const installments = this.store.getInstallmentPayments(patientId);
    const facility = state.facility;

    if (!patient || !fee) {
      window.AppModal.alert('Error', 'Resident or fee schedule not found.', 'danger');
      return;
    }

    const currency = fee.currency || facility.currency || 'TZS';
    const printAreaId = 'statement-print-area';

    const html = `
      <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
            <i data-lucide="file-text" class="w-4 h-4"></i>
          </div>
          <div>
            <h3 class="text-sm font-bold text-slate-800">Resident Statement of Account</h3>
            <span class="text-xs text-slate-400 font-mono">${patient.name} (${patient.id})</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button id="print-stmt-btn" class="px-3.5 py-1.5 rounded-xl btn-decor-primary text-xs font-bold flex items-center gap-1.5 shadow-sm">
            <i data-lucide="printer" class="w-3.5 h-3.5"></i>
            <span>Print Statement</span>
          </button>
          <button id="close-stmt-btn" class="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
      </div>

      <!-- Printable Statement Canvas -->
      <div id="${printAreaId}" class="p-6 bg-white border border-slate-200 rounded-2xl max-w-2xl mx-auto space-y-6 text-slate-800">
        <!-- Header -->
        <div class="flex justify-between items-start border-b-2 border-teal-600 pb-4">
          <div>
            <h2 class="text-xl font-black text-teal-800">${facility.name}</h2>
            <p class="text-xs text-slate-500">${facility.tagline || 'Inpatient Addiction Treatment Center'}</p>
            <p class="text-[11px] text-slate-400">${facility.address} &bull; ${facility.phone}</p>
          </div>
          <div class="text-right">
            <span class="inline-block px-3 py-1 rounded-md bg-slate-100 font-mono font-bold text-xs text-slate-800">
              STATEMENT OF ACCOUNT
            </span>
            <div class="text-[11px] text-slate-500 mt-1">Generated: ${new Date().toLocaleDateString()}</div>
          </div>
        </div>

        <!-- Resident Details -->
        <div class="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div>
            <span class="text-slate-400 text-[10px] uppercase font-bold block">Resident:</span>
            <strong class="text-slate-900 text-sm">${patient.name}</strong>
            <div class="text-slate-500">ID: ${patient.id} &bull; Bed: ${patient.roomNumber} - ${patient.bedNumber}</div>
            <div class="text-slate-500">Admission Date: ${patient.admissionDate}</div>
          </div>
          <div>
            <span class="text-slate-400 text-[10px] uppercase font-bold block">Guarantor / Next of Kin:</span>
            <strong class="text-slate-800">${patient.nextOfKin ? patient.nextOfKin.name : 'N/A'}</strong>
            <div class="text-slate-500">${patient.nextOfKin ? `${patient.nextOfKin.relationship} &bull; ${patient.nextOfKin.phone}` : ''}</div>
          </div>
        </div>

        <!-- Fee Summary Overview -->
        <div class="grid grid-cols-3 gap-3 text-xs">
          <div class="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span class="text-[10px] uppercase font-bold text-slate-400 block">Total Agreed Fee</span>
            <strong class="text-sm font-mono text-slate-900">${Number(fee.total_fee).toLocaleString()} ${currency}</strong>
          </div>
          <div class="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <span class="text-[10px] uppercase font-bold text-emerald-700 block">Total Paid to Date</span>
            <strong class="text-sm font-mono text-emerald-800">${Number(fee.paid_amount).toLocaleString()} ${currency}</strong>
          </div>
          <div class="p-3 rounded-xl bg-rose-50 border border-rose-200">
            <span class="text-[10px] uppercase font-bold text-rose-700 block">Outstanding Balance</span>
            <strong class="text-sm font-mono text-rose-800">${Number(fee.remaining_balance).toLocaleString()} ${currency}</strong>
          </div>
        </div>

        <!-- Ledger of Installments -->
        <div>
          <h4 class="text-xs font-bold text-slate-700 mb-2 uppercase">Scheduled Installments &amp; Payments</h4>
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b-2 border-slate-200 text-slate-400 text-[10px] uppercase font-bold">
                <th class="py-2">Inst #</th>
                <th class="py-2">Due Date</th>
                <th class="py-2">Amount Due</th>
                <th class="py-2">Amount Paid</th>
                <th class="py-2">Status</th>
                <th class="py-2">Paid Date &amp; Ref</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${installments.map(i => `
                <tr>
                  <td class="py-2.5 font-bold text-slate-800">${i.installment_number === 1 ? '1 (Deposit)' : `#${i.installment_number}`}</td>
                  <td class="py-2.5 font-mono text-slate-600">${i.due_date || 'N/A'}</td>
                  <td class="py-2.5 font-mono text-slate-900">${Number(i.amount_due).toLocaleString()} ${currency}</td>
                  <td class="py-2.5 font-mono font-bold ${i.status === 'Paid' ? 'text-emerald-700' : 'text-slate-500'}">${Number(i.amount_paid||0).toLocaleString()} ${currency}</td>
                  <td class="py-2.5"><span class="font-bold text-[11px] ${i.status === 'Paid' ? 'text-emerald-700' : 'text-amber-700'}">${i.status}</span></td>
                  <td class="py-2.5 text-slate-600 font-mono text-[11px]">${i.payment_date || '-'} ${i.reference_no ? `(${i.reference_no})` : ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Signature -->
        <div class="pt-8 border-t border-slate-200 flex justify-between items-end text-xs text-slate-500">
          <div>Official accounting record of SerenityCare Addiction Recovery Center.</div>
          <div class="w-48 text-center border-t border-slate-400 pt-1">
            <span class="font-semibold text-slate-800">Finance &amp; Admissions</span><br>
            Authorized Signatory
          </div>
        </div>
      </div>
    `;

    window.AppModal.showCustom(html, 'max-w-3xl');

    document.getElementById('close-stmt-btn').onclick = () => window.AppModal.close();
    document.getElementById('print-stmt-btn').onclick = () => this.printElement(printAreaId, `Statement_${patient.id}`);
    if (window.lucide) window.lucide.createIcons();
  }

  /**
   * Helper to print a specific DOM element using a clean print window
   */
  printElement(elementId, title = 'Document') {
    const el = document.getElementById(elementId);
    if (!el) return;

    try {
      const printWin = window.open('', '_blank', 'width=900,height=700');
      if (printWin) {
        printWin.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${title}</title>
              <meta charset="utf-8">
              <script src="https://cdn.tailwindcss.com"></script>
              <link rel="stylesheet" href="css/styles.css">
              <style>
                body { background: white !important; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
                @page { margin: 1cm; size: auto; }
              </style>
            </head>
            <body onload="setTimeout(() => { window.print(); window.close(); }, 400);">
              ${el.outerHTML}
            </body>
          </html>
        `);
        printWin.document.close();
        return;
      }
    } catch (e) {
      console.warn('Popup window was blocked, falling back to direct print:', e);
    }

    // Direct print fallback
    window.print();
  }
}

window.AppDocs = new DocumentGenerator();
