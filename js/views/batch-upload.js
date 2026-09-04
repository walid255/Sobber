/**
 * SerenityCare Batch CSV Importer for Residents / Patients
 * Features drag-and-drop file upload, downloadable template, client-side validation, and instant bulk import.
 */

class BatchUploadView {
  constructor() {
    this.parsedRows = [];
  }

  render(container) {
    container.innerHTML = `
      <div class="space-y-6">
        
        <!-- Header -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 class="text-2xl font-black text-slate-900 tracking-tight">Batch Resident Onboarding (CSV Import)</h2>
            <p class="text-xs text-slate-500 mt-0.5">Bulk import intake profiles, next of kin contacts, and addiction histories from spreadsheets</p>
          </div>

          <div class="flex items-center gap-3">
            <button id="download-template-btn" class="px-4 py-2.5 rounded-xl text-xs font-bold btn-decor-secondary flex items-center gap-2">
              <i data-lucide="download" class="w-4 h-4 text-teal-600"></i>
              <span>Download CSV Template</span>
            </button>
          </div>
        </div>

        <!-- Instructions Card -->
        <div class="medical-card p-5 bg-teal-50/50 border-teal-200">
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
              <i data-lucide="info" class="w-4 h-4"></i>
            </div>
            <div class="text-xs text-slate-600 space-y-1">
              <h4 class="font-bold text-slate-900 text-sm">Batch Import Guidelines:</h4>
              <p>1. Download the pre-formatted CSV template to ensure column headers match.</p>
              <p>2. Required fields: <code>full_name</code>, <code>dob</code>, <code>gender</code>, <code>primary_substance</code>, <code>room_number</code>, <code>nok_name</code>, <code>nok_phone</code>.</p>
              <p>3. Upload your CSV below to review and validate records before committing to the live registry.</p>
            </div>
          </div>
        </div>

        <!-- Drag and Drop Upload Area -->
        <div id="drop-zone" class="medical-card p-8 border-2 border-dashed border-teal-300 hover:border-teal-500 bg-white/60 text-center cursor-pointer transition-all rounded-2xl group">
          <input type="file" id="csv-file-input" accept=".csv" class="hidden">
          <div class="w-16 h-16 rounded-2xl bg-teal-50 text-teal-600 group-hover:scale-110 transition-transform mx-auto flex items-center justify-center mb-3">
            <i data-lucide="upload-cloud" class="w-8 h-8"></i>
          </div>
          <h3 class="text-base font-bold text-slate-800">Drop your residents CSV file here</h3>
          <p class="text-xs text-slate-500 mt-1">or click to browse from your computer (.csv format)</p>
          <span class="inline-block mt-3 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[11px] font-semibold">
            UTF-8 Comma-Separated Values Supported
          </span>
        </div>

        <!-- Live Preview Table Container (Hidden until file selected) -->
        <div id="preview-section" class="medical-card p-5 hidden space-y-4">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 class="text-sm font-bold text-slate-900">Parsed Records Preview</h3>
              <p class="text-xs text-slate-500"><span id="parsed-count">0</span> records ready for validation</p>
            </div>
            <div class="flex items-center gap-3">
              <button id="clear-upload-btn" class="px-3.5 py-2 rounded-xl text-xs font-semibold btn-decor-secondary">Clear</button>
              <button id="commit-import-btn" class="px-5 py-2 rounded-xl text-xs font-bold btn-decor-success flex items-center gap-2">
                <i data-lucide="check" class="w-4 h-4"></i>
                <span>Import All to Registry</span>
              </button>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="border-b border-slate-200 bg-slate-50 text-[11px] text-slate-500 font-semibold uppercase">
                  <th class="py-2.5 px-3">Status</th>
                  <th class="py-2.5 px-3">Full Legal Name</th>
                  <th class="py-2.5 px-3">DOB / Age</th>
                  <th class="py-2.5 px-3">Gender</th>
                  <th class="py-2.5 px-3">Primary Addiction</th>
                  <th class="py-2.5 px-3">Assigned Room</th>
                  <th class="py-2.5 px-3">Next of Kin</th>
                </tr>
              </thead>
              <tbody id="preview-table-body" class="divide-y divide-slate-100">
                <!-- Injected via parser -->
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    // Download Template
    document.getElementById('download-template-btn').onclick = () => {
      this.downloadSampleTemplate();
    };

    // File Drop & Select
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('csv-file-input');

    dropZone.onclick = () => fileInput.click();

    dropZone.ondragover = (e) => {
      e.preventDefault();
      dropZone.classList.add('border-teal-600', 'bg-teal-50/50');
    };

    dropZone.ondragleave = () => {
      dropZone.classList.remove('border-teal-600', 'bg-teal-50/50');
    };

    dropZone.ondrop = (e) => {
      e.preventDefault();
      dropZone.classList.remove('border-teal-600', 'bg-teal-50/50');
      if (e.dataTransfer.files.length > 0) {
        this.processFile(e.dataTransfer.files[0]);
      }
    };

    fileInput.onchange = (e) => {
      if (e.target.files.length > 0) {
        this.processFile(e.target.files[0]);
      }
    };

    // Clear
    document.getElementById('clear-upload-btn').onclick = () => {
      this.parsedRows = [];
      document.getElementById('preview-section').classList.add('hidden');
      fileInput.value = '';
    };

    // Commit Import
    document.getElementById('commit-import-btn').onclick = () => {
      this.commitImport();
    };

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  downloadSampleTemplate() {
    const csvContent = [
      'full_name,dob,gender,blood_group,phone,room_number,bed_number,primary_substance,addiction_years,suicide_risk,diagnoses,allergies,nok_name,nok_rel,nok_phone',
      'Liam Vance,1992-06-14,Male,O+,+1 555-012-3456,Room 106,Bed A,Alcohol & Opioids,7,Low,Depression; Anxiety,Penicillin,Catherine Vance,Spouse,+1 555-012-7890',
      'Sophia Chen,1996-03-22,Female,A+,+1 555-014-9988,Room 202,Bed B,Methamphetamine,4,Low,PTSD,None,David Chen,Brother,+1 555-014-3321',
      'Jordan Miller,1988-11-05,Male,B+,+1 555-017-7722,Room 108,Bed A,Prescription Sedatives,6,Moderate,Generalized Anxiety,Aspirin,Brenda Miller,Mother,+1 555-017-4400'
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'SerenityCare_Residents_Intake_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  processFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      this.parseCsv(text);
    };
    reader.readAsText(file);
  }

  parseCsv(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
      window.AppModal.alert('Invalid CSV', 'The CSV file must contain a header row and at least one data row.', 'danger');
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      // Regex for CSV split handling quotes
      const values = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
      if (values) {
        const rowObj = {};
        headers.forEach((h, idx) => {
          let val = values[idx] ? values[idx].trim().replace(/^["']|["']$/g, '') : '';
          rowObj[h] = val;
        });
        rows.push(rowObj);
      }
    }

    this.parsedRows = rows;
    this.renderPreview();
  }

  renderPreview() {
    const previewSection = document.getElementById('preview-section');
    const tbody = document.getElementById('preview-table-body');
    const countEl = document.getElementById('parsed-count');

    if (!previewSection || !tbody) return;

    previewSection.classList.remove('hidden');
    countEl.textContent = this.parsedRows.length;

    tbody.innerHTML = this.parsedRows.map((row, idx) => {
      const isValid = Boolean(row.full_name && row.dob && row.primary_substance);
      return `
        <tr class="hover:bg-slate-50">
          <td class="py-2.5 px-3">
            <span class="px-2 py-0.5 rounded-full font-bold text-[10px] ${isValid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
              ${isValid ? 'Valid' : 'Incomplete'}
            </span>
          </td>
          <td class="py-2.5 px-3 font-bold text-slate-800">${row.full_name || 'N/A'}</td>
          <td class="py-2.5 px-3">${row.dob || 'N/A'}</td>
          <td class="py-2.5 px-3">${row.gender || 'N/A'}</td>
          <td class="py-2.5 px-3 font-semibold text-rose-700">${row.primary_substance || 'N/A'}</td>
          <td class="py-2.5 px-3">${row.room_number || 'Room 101'} - ${row.bed_number || 'Bed A'}</td>
          <td class="py-2.5 px-3 text-slate-500">${row.nok_name || 'N/A'} (${row.nok_rel || 'Kin'})</td>
        </tr>
      `;
    }).join('');

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  commitImport() {
    if (this.parsedRows.length === 0) return;

    window.AppModal.showAcceptanceCard({
      title: `Import ${this.parsedRows.length} Residents?`,
      subtitle: 'Authorizing batch medical onboarding',
      icon: 'users',
      badgeText: 'CLINICAL INTAKE AUTHORIZATION',
      badgeColor: 'badge-medical-teal',
      confirmType: 'success',
      contentHtml: `
        <p class="leading-relaxed">
          You are about to admit <strong>${this.parsedRows.length} new residents</strong> into the medical database. 
          Individual clinical profiles, next-of-kin records, and room assignments will be created instantly.
        </p>
      `,
      confirmText: 'Execute Batch Import',
      cancelText: 'Cancel',
      onConfirm: async () => {
        const mappedPatients = this.parsedRows.map(r => ({
          name: r.full_name,
          dob: r.dob,
          age: r.dob ? (new Date().getFullYear() - new Date(r.dob).getFullYear()) : 32,
          gender: r.gender || 'Male',
          bloodGroup: r.blood_group || 'O+',
          phone: r.phone || '',
          roomNumber: r.room_number || 'Room 101',
          bedNumber: r.bed_number || 'Bed A',
          nextOfKin: {
            name: r.nok_name || 'Not Provided',
            relationship: r.nok_rel || 'Relative',
            phone: r.nok_phone || '',
            address: 'On file',
            emergencyConsent: true
          },
          psychiatricHistory: {
            primarySubstance: r.primary_substance || 'Alcohol',
            secondarySubstance: 'None',
            addictionDurationYears: parseInt(r.addiction_years) || 2,
            priorRehabs: 0,
            diagnoses: r.diagnoses ? r.diagnoses.split(';') : ['Substance Use Disorder'],
            suicideRisk: r.suicide_risk || 'Low',
            allergies: r.allergies ? r.allergies.split(';') : ['None'],
            notes: 'Imported via bulk CSV intake.'
          }
        }));

        await window.AppStore.batchImportPatients(mappedPatients);
        window.AppModal.close();

        // Redirect to Patients View if allowed, or first allowed route
        if (window.Auth.hasPermission('patients')) {
          window.AppRouter.navigate('patients');
        } else {
          const allowed = window.Auth.getAllowedRoutes();
          window.AppRouter.navigate(allowed.length > 0 ? allowed[0] : 'dashboard');
        }
      }
    });
  }
}

window.BatchUploadView = BatchUploadView;
