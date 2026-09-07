/**
 * SerenityCare Graduation & Release Qualification Center
 * Manages graduation approvals, sobriety streak verification, and official certificate printing.
 */

class CertificatesView {
  constructor() {
    this.filter = 'all'; // all, qualified, in-progress, graduated
  }

  render(container) {
    const state = window.AppStore.getState();
    const patients = state.patients;

    const filtered = patients.filter(p => {
      if (this.filter === 'qualified') return p.graduationQualified && p.stage !== 'Graduated';
      if (this.filter === 'graduated') return p.stage === 'Graduated';
      if (this.filter === 'in-progress') return !p.graduationQualified && p.stage !== 'Graduated';
      return true;
    });

    const qualifiedCount = patients.filter(p => p.graduationQualified && p.stage !== 'Graduated').length;
    const graduatedCount = patients.filter(p => p.stage === 'Graduated').length;

    container.innerHTML = `
      <div class="space-y-6">
        
        <!-- Header Banner -->
        <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-700 via-teal-800 to-slate-900 text-white p-6 md:p-8 shadow-md">
          <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/30 text-amber-200 text-xs font-semibold mb-3">
                <i data-lucide="award" class="w-3.5 h-3.5 text-amber-300"></i>
                <span>Honors &amp; Clinical Graduation Registry</span>
              </div>
              <h2 class="text-2xl md:text-3xl font-extrabold tracking-tight">Graduation &amp; Release Certification</h2>
              <p class="text-sm text-teal-100/90 mt-1 max-w-xl">
                Authorize residents who have satisfied all clinical milestones and print official Certificates of Sobriety &amp; Release.
              </p>
            </div>

            <div class="flex items-center gap-3">
              <div class="text-center px-4 py-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
                <span class="block text-2xl font-black text-amber-300">${qualifiedCount}</span>
                <span class="text-[10px] text-teal-100 uppercase tracking-wider font-semibold">Ready for Release</span>
              </div>
              <div class="text-center px-4 py-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
                <span class="block text-2xl font-black text-emerald-300">${graduatedCount}</span>
                <span class="text-[10px] text-teal-100 uppercase tracking-wider font-semibold">Alumni Graduated</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Filter Tabs -->
        <div class="medical-card p-3 flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-2 text-xs">
            ${[
              { key: 'all', label: 'All Residents' },
              { key: 'qualified', label: 'Qualified for Graduation' },
              { key: 'in-progress', label: 'In Recovery Progress' },
              { key: 'graduated', label: 'Graduated Alumni' }
            ].map(tab => `
              <button class="cert-filter-btn px-3.5 py-1.5 rounded-lg font-bold transition ${this.filter === tab.key ? 'bg-teal-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
                      data-filter="${tab.key}">
                ${tab.label}
              </button>
            `).join('')}
          </div>
          <span class="text-xs text-slate-400 font-semibold px-2">${filtered.length} Residents Listed</span>
        </div>

        <!-- Candidate Cards Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          ${filtered.length > 0 ? filtered.map(p => this.renderCandidateCard(p)).join('') : `
            <div class="col-span-full medical-card p-12 text-center text-slate-400">
              <i data-lucide="award" class="w-12 h-12 mx-auto text-slate-300 mb-3"></i>
              <h3 class="text-base font-bold text-slate-700">No Graduation Candidates Listed</h3>
              <p class="text-xs text-slate-500 mt-1 max-w-lg mx-auto leading-relaxed">
                Once residents achieve their sobriety milestone (e.g., 90 continuous days) and maintain negative toxicology screens, 
                mark them as qualified in the <strong>Resident Registry</strong> to confer their official Certificate of Sobriety &amp; Release.
              </p>
            </div>
          `}
        </div>

      </div>
    `;

    // Bind Filter Events
    document.querySelectorAll('.cert-filter-btn').forEach(btn => {
      btn.onclick = () => {
        this.filter = btn.getAttribute('data-filter');
        this.render(container);
      };
    });

    // Bind Certificate Print & Qualification Actions
    document.querySelectorAll('.print-cert-action').forEach(btn => {
      btn.onclick = () => {
        const pid = btn.getAttribute('data-patient-id');
        window.AppDocs.openGraduationCertificate(pid);
      };
    });

    document.querySelectorAll('.qualify-toggle-action').forEach(btn => {
      btn.onclick = () => {
        const pid = btn.getAttribute('data-patient-id');
        const patient = patients.find(p => p.id === pid);
        if (!patient) return;

        const nextState = !patient.graduationQualified;

        window.AppModal.showAcceptanceCard({
          title: nextState ? 'Confirm Graduation Qualification' : 'Revoke Graduation Qualification',
          subtitle: `Clinical attestation for ${patient.name}`,
          icon: nextState ? 'award' : 'alert-triangle',
          badgeText: 'MEDICAL DIRECTOR ATTESTATION',
          badgeColor: nextState ? 'badge-medical-emerald' : 'badge-medical-rose',
          confirmType: nextState ? 'success' : 'danger',
          contentHtml: `
            <div class="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2 mb-3">
              <div>Resident: <strong>${patient.name} (${patient.id})</strong></div>
              <div>Sobriety Days: <strong class="text-teal-700">${patient.sobrietyDays} Days</strong></div>
              <div>Primary Substance: <strong>${patient.psychiatricHistory.primarySubstance}</strong></div>
              <div>Assigned Room: <strong>${patient.roomNumber} - ${patient.bedNumber}</strong></div>
            </div>
            <p class="text-xs text-slate-600 leading-relaxed">
              ${nextState ? 
                'By confirming, this resident will be officially marked as qualified to receive their formal Certificate of Sobriety & Release.' : 
                'Are you sure you want to revoke qualification status?'}
            </p>
          `,
          confirmText: nextState ? 'Approve & Issue Certificate' : 'Revoke Status',
          cancelText: 'Cancel',
          onConfirm: () => {
            window.AppStore.markGraduationQualified(patient.id, nextState);
            window.AppModal.close();
            if (nextState) {
              setTimeout(() => window.AppDocs.openGraduationCertificate(patient.id), 200);
            }
          }
        });
      };
    });

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  renderCandidateCard(p) {
    const isReady = p.sobrietyDays >= 90;
    const isQualified = p.graduationQualified;

    return `
      <div class="medical-card p-5 flex flex-col justify-between hover:border-amber-300 transition-all ${isQualified ? 'border-amber-200 bg-amber-50/10' : ''}">
        <div>
          <!-- Header -->
          <div class="flex items-start gap-3.5 mb-4">
            <img src="${p.photo}" alt="${p.name}" class="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow-sm">
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <span class="text-xs font-mono font-bold text-slate-400">${p.id}</span>
                ${isQualified ? `
                  <span class="badge-medical-emerald px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1">
                    <i data-lucide="check-check" class="w-3 h-3"></i> Qualified for Release
                  </span>
                ` : `
                  <span class="badge-medical-amber px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                    In Progress (${p.sobrietyDays}/90 Days)
                  </span>
                `}
              </div>
              <h3 class="text-base font-bold text-slate-900 mt-0.5">${p.name}</h3>
              <p class="text-xs text-slate-500">${p.roomNumber} &bull; Admitted: ${p.admissionDate}</p>
            </div>
          </div>

          <!-- Milestones Grid -->
          <div class="grid grid-cols-3 gap-2.5 p-3 bg-slate-50 rounded-xl text-center text-xs mb-3 border border-slate-200">
            <div>
              <span class="text-slate-400 block text-[10px] uppercase font-semibold">Sobriety Streak</span>
              <strong class="text-teal-700 text-sm font-black">${p.sobrietyDays} Days</strong>
            </div>
            <div>
              <span class="text-slate-400 block text-[10px] uppercase font-semibold">Drug Screens</span>
              <strong class="text-emerald-700 text-sm font-black">100% Neg</strong>
            </div>
            <div>
              <span class="text-slate-400 block text-[10px] uppercase font-semibold">12-Step Milestones</span>
              <strong class="text-indigo-700 text-sm font-black">Steps 1-12</strong>
            </div>
          </div>

          <!-- Progress Bar towards 90 days -->
          <div class="mb-4">
            <div class="flex justify-between text-[11px] text-slate-500 mb-1">
              <span>90-Day Release Criteria</span>
              <span class="font-bold">${Math.min(100, Math.round((p.sobrietyDays / 90) * 100))}% Complete</span>
            </div>
            <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div class="h-full rounded-full ${isReady ? 'bg-gradient-to-r from-teal-500 to-emerald-500' : 'bg-teal-500'}" 
                   style="width: ${Math.min(100, Math.round((p.sobrietyDays / 90) * 100))}%"></div>
            </div>
          </div>
        </div>

        <!-- Card Footer -->
        <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
          <button class="px-4 py-2 rounded-xl text-xs font-bold ${isQualified ? 'btn-decor-success' : 'btn-decor-primary'} flex items-center gap-1.5 qualify-toggle-action" data-patient-id="${p.id}">
            <i data-lucide="${isQualified ? 'award' : 'check-circle'}" class="w-4 h-4"></i>
            <span>${isQualified ? 'Review Status' : 'Mark Qualified'}</span>
          </button>

          ${isQualified ? `
            <button class="px-4 py-2 rounded-xl text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 flex items-center gap-1.5 shadow-sm print-cert-action" data-patient-id="${p.id}">
              <i data-lucide="printer" class="w-4 h-4 text-amber-700"></i>
              <span>Print Certificate</span>
            </button>
          ` : `
            <button class="text-xs font-bold text-slate-400 hover:text-slate-600 px-3 py-2" onclick="window.AppDocs.openPatientDossier('${p.id}')">
              View Dossier
            </button>
          `}
        </div>
      </div>
    `;
  }
}

window.CertificatesView = CertificatesView;
