/**
 * SerenityCare Dashboard View
 * Features real-time KPI metrics, recovery stage breakdown, Chart.js analytics, and quick MAR action triggers.
 */

class DashboardView {
  constructor() {
    this.chartInstances = {};
  }

  render(container) {
    const state = window.AppStore.getState();
    const facility = state.facility;
    const patients = state.patients;
    const activePatients = patients.filter(p => p.stage !== 'Graduated');
    const graduatedPatients = patients.filter(p => p.stage === 'Graduated' || p.graduationQualified);
    const pendingMeds = state.medicationLogs.filter(l => l.status === 'Pending');
    const lowStockItems = state.inventory.filter(i => i.quantity <= i.minThreshold);
    const qualifiedCandidates = patients.filter(p => p.graduationQualified && p.stage !== 'Graduated');

    const occupancyPct = Math.min(100, Math.round((activePatients.length / facility.totalBeds) * 100));

    container.innerHTML = `
      <div class="space-y-6">
        
        <!-- Welcome Medical Banner -->
        <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal-800 via-teal-700 to-slate-900 text-white p-6 md:p-8 shadow-md">
          <!-- Decorative background circles -->
          <div class="absolute -right-10 -bottom-10 w-60 h-60 rounded-full bg-white/5 pointer-events-none"></div>
          <div class="absolute right-32 -top-12 w-48 h-48 rounded-full bg-teal-500/10 pointer-events-none"></div>

          <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-200 text-xs font-semibold mb-3">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Active Facility Census &bull; ${facility.name}</span>
              </div>
              <h2 class="text-2xl md:text-3xl font-extrabold tracking-tight">Clinical Recovery Dashboard</h2>
              <p class="text-sm text-teal-100/90 mt-1 max-w-xl">
                Real-time resident monitoring, medication administration tracking, and recovery milestones overview.
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              ${window.Auth.hasPermission('medications') ? `
                <button id="quick-med-alert-btn" class="px-4 py-2.5 rounded-xl text-xs font-bold bg-white text-teal-900 hover:bg-teal-50 shadow-md transition flex items-center gap-2">
                  <i data-lucide="bell" class="w-4 h-4 text-teal-700"></i>
                  <span>Medication Alert (${pendingMeds.length} Due)</span>
                </button>
              ` : ''}
              ${window.Auth.hasPermission('patients') ? `
                <button id="quick-add-patient-btn" class="px-4 py-2.5 rounded-xl text-xs font-bold btn-decor-primary flex items-center gap-2 border border-teal-400/40">
                  <i data-lucide="user-plus" class="w-4 h-4"></i>
                  <span>Admit New Resident</span>
                </button>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Metric KPI Cards Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          
          <!-- Bed Occupancy -->
          <div class="medical-card p-5 border-l-4 border-l-teal-600">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Bed Occupancy</span>
              <div class="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <i data-lucide="bed" class="w-5 h-5"></i>
              </div>
            </div>
            <div class="mt-3 flex items-baseline gap-2">
              <span class="text-2xl font-black text-slate-900">${activePatients.length}</span>
              <span class="text-xs text-slate-500 font-medium">/ ${facility.totalBeds} Beds (${occupancyPct}%)</span>
            </div>
            <div class="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
              <div class="bg-gradient-to-r from-teal-500 to-emerald-500 h-full rounded-full" style="width: ${occupancyPct}%"></div>
            </div>
          </div>

          <!-- Pending Medication Doses -->
          <div class="medical-card p-5 border-l-4 ${pendingMeds.length > 0 ? 'border-l-amber-500' : 'border-l-emerald-500'}">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending MAR Doses</span>
              <div class="w-9 h-9 rounded-xl ${pendingMeds.length > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'} flex items-center justify-center">
                <i data-lucide="pill" class="w-5 h-5"></i>
              </div>
            </div>
            <div class="mt-3 flex items-baseline gap-2">
              <span class="text-2xl font-black ${pendingMeds.length > 0 ? 'text-amber-600' : 'text-slate-900'}">${pendingMeds.length}</span>
              <span class="text-xs text-slate-500 font-medium">scheduled today</span>
            </div>
            <p class="text-xs text-slate-500 mt-2 flex items-center gap-1">
              <i data-lucide="clock" class="w-3.5 h-3.5 text-slate-400"></i>
              <span>Next window: 12:00 PM (Noon)</span>
            </p>
          </div>

          <!-- Graduation Candidates -->
          <div class="medical-card p-5 border-l-4 border-l-emerald-600">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Graduation Candidates</span>
              <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <i data-lucide="award" class="w-5 h-5"></i>
              </div>
            </div>
            <div class="mt-3 flex items-baseline gap-2">
              <span class="text-2xl font-black text-slate-900">${qualifiedCandidates.length}</span>
              <span class="text-xs text-slate-500 font-medium">ready for release</span>
            </div>
            <p class="text-xs text-emerald-700 font-medium mt-2 flex items-center gap-1">
              <i data-lucide="check-circle" class="w-3.5 h-3.5"></i>
              <span>${graduatedPatients.length} Total Alumni Graduated</span>
            </p>
          </div>

          <!-- Store Low Stock Alerts -->
          <div class="medical-card p-5 border-l-4 ${lowStockItems.length > 0 ? 'border-l-rose-500' : 'border-l-slate-400'}">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Inventory Health</span>
              <div class="w-9 h-9 rounded-xl ${lowStockItems.length > 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-700'} flex items-center justify-center">
                <i data-lucide="boxes" class="w-5 h-5"></i>
              </div>
            </div>
            <div class="mt-3 flex items-baseline gap-2">
              <span class="text-2xl font-black ${lowStockItems.length > 0 ? 'text-rose-600' : 'text-slate-900'}">${lowStockItems.length}</span>
              <span class="text-xs text-slate-500 font-medium">items below threshold</span>
            </div>
            <p class="text-xs text-slate-500 mt-2 flex items-center gap-1">
              <i data-lucide="alert-circle" class="w-3.5 h-3.5 text-rose-500"></i>
              <span>${lowStockItems.length > 0 ? 'Narcan, Test Cups require restock' : 'All stock levels optimal'}</span>
            </p>
          </div>

        </div>

        <!-- Charts & Analytics Section -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <!-- Recovery Stages Donut Chart -->
          <div class="medical-card p-6 lg:col-span-1 flex flex-col justify-between">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="text-sm font-bold text-slate-900 uppercase tracking-wider">Recovery Stage Breakdown</h3>
                <p class="text-xs text-slate-500">Current active patient distribution</p>
              </div>
              <i data-lucide="pie-chart" class="w-4 h-4 text-teal-600"></i>
            </div>
            <div class="relative h-60 flex items-center justify-center">
              <canvas id="stageChart"></canvas>
            </div>
            <div class="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
              <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Detoxification</div>
              <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-teal-500"></span> Inpatient Recovery</div>
              <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-cyan-500"></span> Transition / Halfway</div>
              <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Graduated / Alumni</div>
            </div>
          </div>

          <!-- Monthly Admissions & Graduations Bar Chart -->
          <div class="medical-card p-6 lg:col-span-2 flex flex-col justify-between">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="text-sm font-bold text-slate-900 uppercase tracking-wider">Admissions &amp; Successful Releases</h3>
                <p class="text-xs text-slate-500">6-Month recovery performance metrics</p>
              </div>
              <span class="badge-medical-teal text-xs px-2.5 py-0.5 rounded-full font-bold">2026 Trend</span>
            </div>
            <div class="relative h-64">
              <canvas id="admissionChart"></canvas>
            </div>
          </div>

        </div>

        <!-- Two Column Detailed Overview: Quick MAR & Today's Schedule -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          <!-- Today's Pending Medication Doses -->
          <div class="medical-card p-6">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                  <i data-lucide="clipboard-list" class="w-4 h-4"></i>
                </div>
                <div>
                  <h3 class="text-sm font-bold text-slate-900">Today's Medication Administrations (MAR)</h3>
                  <p class="text-xs text-slate-500">Supervised dose verification queue</p>
                </div>
              </div>
              ${window.Auth.hasPermission('medications') ? `
                <button onclick="window.AppRouter.navigate('medications')" class="text-xs font-bold text-teal-700 hover:underline">
                  View Full MAR &rarr;
                </button>
              ` : ''}
            </div>

            <div class="space-y-2.5">
              ${state.medicationLogs.length > 0 ? state.medicationLogs.slice(0, 4).map(log => `
                <div class="p-3 rounded-xl border border-slate-200 hover:border-teal-200 transition-all flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <span class="px-2 py-1 rounded-md text-[11px] font-mono font-bold ${log.status === 'Administered' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
                      ${log.scheduledTime}
                    </span>
                    <div>
                      <div class="text-xs font-bold text-slate-900">${log.medName}</div>
                      <div class="text-[11px] text-slate-500">${log.patientName} &bull; ${log.patientId}</div>
                    </div>
                  </div>
                  <div>
                    ${log.status === 'Administered' ? 
                      `<span class="badge-medical-emerald text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <i data-lucide="check" class="w-3 h-3"></i> Administered
                       </span>` : 
                      (window.Auth.hasPermission('medications') ? 
                        `<button class="btn-decor-primary text-[11px] font-bold px-3 py-1 rounded-lg quick-admin-mar" data-log-id="${log.id}">
                          Administer
                         </button>` : 
                        `<span class="badge-medical-amber text-[10px] font-bold px-2 py-0.5 rounded-full">Pending</span>`
                      )
                    }
                  </div>
                </div>
              `).join('') : `
                <div class="py-8 text-center text-xs text-slate-400">
                  <i data-lucide="calendar-check" class="w-8 h-8 text-slate-300 mx-auto mb-2"></i>
                  <p class="font-semibold text-slate-600">No Scheduled MAR Doses Today</p>
                  <p class="text-[11px] text-slate-400 mt-0.5">Doses appear automatically when resident prescriptions are ordered.</p>
                </div>
              `}
            </div>
          </div>

          <!-- Today's House Timetable -->
          <div class="medical-card p-6">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <i data-lucide="calendar" class="w-4 h-4"></i>
                </div>
                <div>
                  <h3 class="text-sm font-bold text-slate-900">Today's House Schedule &amp; Routine</h3>
                  <p class="text-xs text-slate-500">Structured daily curriculum</p>
                </div>
              </div>
              ${window.Auth.hasPermission('timetable') ? `
                <button onclick="window.AppRouter.navigate('timetable')" class="text-xs font-bold text-teal-700 hover:underline">
                  Manage Schedule &rarr;
                </button>
              ` : ''}
            </div>

            <div class="space-y-2.5">
              ${state.timetable.length > 0 ? state.timetable.filter(t => t.day === 'Monday').slice(0, 4).map(item => `
                <div class="p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <span class="text-xs font-mono font-bold text-slate-500">${item.time}</span>
                    <div>
                      <div class="text-xs font-bold text-slate-900">${item.title}</div>
                      <div class="text-[11px] text-slate-400">${item.location} &bull; ${item.facilitator}</div>
                    </div>
                  </div>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${this.getCategoryBadge(item.category)}">
                    ${item.category}
                  </span>
                </div>
              `).join('') : `
                <div class="py-8 text-center text-xs text-slate-400">
                  <i data-lucide="clock" class="w-8 h-8 text-slate-300 mx-auto mb-2"></i>
                  <p class="font-semibold text-slate-600">No House Activities Scheduled</p>
                  <p class="text-[11px] text-slate-400 mt-0.5">Use House Timetable to plan group therapy, chores, and meetings.</p>
                </div>
              `}
            </div>
          </div>

        </div>

      </div>
    `;

    // Initialize Chart.js analytics
    this.renderCharts(state);

    // Bind event handlers
    const quickMedAlertBtn = document.getElementById('quick-med-alert-btn');
    if (quickMedAlertBtn) {
      quickMedAlertBtn.onclick = () => {
        window.AppReminders.showRemindersListModal();
      };
    }

    const quickAddPatientBtn = document.getElementById('quick-add-patient-btn');
    if (quickAddPatientBtn) {
      quickAddPatientBtn.onclick = () => {
        window.AppRouter.navigate('patients');
        setTimeout(() => {
          if (window.PatientsViewInstance) {
            window.PatientsViewInstance.openAddPatientModal();
          }
        }, 100);
      };
    }

    document.querySelectorAll('.quick-admin-mar').forEach(btn => {
      btn.onclick = () => {
        const lid = btn.getAttribute('data-log-id');
        window.AppReminders.triggerMedicationAlert(lid);
      };
    });

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  getCategoryBadge(cat) {
    switch (cat) {
      case 'Wellness': return 'badge-medical-teal';
      case 'Medical': return 'badge-medical-rose';
      case 'Therapy': return 'badge-medical-cyan';
      case '12-Step': return 'badge-medical-amber';
      case 'Chores': return 'badge-medical-slate';
      default: return 'badge-medical-teal';
    }
  }

  renderCharts(state) {
    if (!window.Chart) return;

    // Destroy existing instances if any
    if (this.chartInstances.stageChart) this.chartInstances.stageChart.destroy();
    if (this.chartInstances.admissionChart) this.chartInstances.admissionChart.destroy();

    // 1. Recovery Stages Breakdown
    const stageCounts = {
      'Detoxification': 0,
      'Inpatient Recovery': 0,
      'Transition / Halfway': 0,
      'Graduated': 0
    };
    state.patients.forEach(p => {
      if (stageCounts[p.stage] !== undefined) {
        stageCounts[p.stage]++;
      } else {
        stageCounts['Inpatient Recovery']++;
      }
    });

    const totalPatients = state.patients.length;
    const graduatedCount = state.patients.filter(p => p.stage === 'Graduated').length;

    const ctxStage = document.getElementById('stageChart');
    if (ctxStage) {
      this.chartInstances.stageChart = new window.Chart(ctxStage, {
        type: 'doughnut',
        data: totalPatients > 0 ? {
          labels: Object.keys(stageCounts),
          datasets: [{
            data: Object.values(stageCounts),
            backgroundColor: ['#f43f5e', '#0d9488', '#06b6d4', '#10b981'],
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        } : {
          labels: ['No Active Residents'],
          datasets: [{
            data: [1],
            backgroundColor: ['#e2e8f0'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { enabled: totalPatients > 0 }
          },
          cutout: '72%'
        }
      });
    }

    // 2. Admissions vs Graduations trend
    const ctxAdm = document.getElementById('admissionChart');
    if (ctxAdm) {
      const currentMonth = new Date().toLocaleString('default', { month: 'short' });
      this.chartInstances.admissionChart = new window.Chart(ctxAdm, {
        type: 'bar',
        data: {
          labels: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Current'],
          datasets: [
            {
              label: 'New Admissions',
              data: [0, 0, 0, 0, 0, totalPatients],
              backgroundColor: '#0d9488',
              borderRadius: 6
            },
            {
              label: 'Graduations (Sober Releases)',
              data: [0, 0, 0, 0, 0, graduatedCount],
              backgroundColor: '#10b981',
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: {
                boxWidth: 12,
                font: { size: 11, weight: 'bold' }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              suggestedMax: 5,
              grid: { color: '#f1f5f9' },
              ticks: { stepSize: 1 }
            },
            x: {
              grid: { display: false }
            }
          }
        }
      });
    }
  }
}

window.DashboardView = DashboardView;
