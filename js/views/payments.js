/**
 * SerenityCare Billing & Payments View
 * Production-ready financial tracking in Tanzanian Shillings (TZS).
 * Supports M-Pesa, Tigo Pesa, Airtel Money, HaloPesa, Bank Transfer, and Cash.
 * Manages invoices, partial installments, balance due, and printable receipts.
 */

class PaymentsView {
  constructor() {
    this.searchQuery = '';
    this.filterStatus = 'all';
    this.filterCategory = 'all';
    this.filterMethod = 'all';
    window.PaymentsViewInstance = this;
  }

  render(container) {
    const state = window.AppStore.getState();
    const payments = window.AppStore.getPayments();
    const patients = state.patients || [];
    const facility = state.facility || {};

    // Financial calculations in TZS
    const totalRevenue = payments.reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);
    const totalOutstanding = payments.reduce((sum, p) => sum + (Number(p.balance) || 0), 0);

    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthCollections = payments.reduce((sum, p) => {
      let monthSum = 0;
      if (Array.isArray(p.installments) && p.installments.length > 0) {
        p.installments.forEach(inst => {
          if (inst.date && inst.date.startsWith(currentYearMonth)) {
            monthSum += Number(inst.amount) || 0;
          }
        });
      } else if (p.date && p.date.startsWith(currentYearMonth)) {
        monthSum += Number(p.amountPaid) || 0;
      }
      return sum + monthSum;
    }, 0);

    const paidInvoicesCount = payments.filter(p => p.status === 'Paid').length;
    const partialInvoicesCount = payments.filter(p => p.status === 'Partial').length;
    const overdueInvoicesCount = payments.filter(p => p.status === 'Overdue').length;

    // Filter payments
    const filteredPayments = payments.filter(p => {
      const q = (this.searchQuery || '').toLowerCase().trim();
      const matchesSearch = !q ||
        (p.invoiceNumber && p.invoiceNumber.toLowerCase().includes(q)) ||
        (p.patientName && p.patientName.toLowerCase().includes(q)) ||
        (p.patientId && p.patientId.toLowerCase().includes(q)) ||
        (p.referenceNo && p.referenceNo.toLowerCase().includes(q)) ||
        (p.payerName && p.payerName.toLowerCase().includes(q)) ||
        (p.payerPhone && p.payerPhone.toLowerCase().includes(q));

      const matchesStatus = this.filterStatus === 'all' || p.status === this.filterStatus;
      const matchesCategory = this.filterCategory === 'all' || p.category === this.filterCategory;
      const matchesMethod = this.filterMethod === 'all' || p.paymentMethod === this.filterMethod;

      return matchesSearch && matchesStatus && matchesCategory && matchesMethod;
    });

    const isSw = window.I18n && window.I18n.getLang() === 'sw';

    container.innerHTML = `
      <div class="space-y-6">
        
        <!-- Header & Action Controls -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div class="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold uppercase tracking-wider mb-1">
              <i data-lucide="receipt" class="w-3.5 h-3.5 text-emerald-600"></i>
              <span>SerenityCare Financial &amp; Revenue Operations</span>
            </div>
            <h2 class="text-2xl font-black text-slate-900 tracking-tight" data-i18n="payments_title">
              ${isSw ? 'Uendeshaji wa Malipo na Mapato' : 'Billing & Revenue Operations'}
            </h2>
            <p class="text-xs text-slate-500 mt-0.5" data-i18n="payments_subtitle">
              ${isSw ? 'Dhibiti ankara za wakazi, miamala ya M-Pesa/benki, awamu za malipo, na stakabadhi rasmi' : 'Manage resident invoices, M-Pesa/bank collections, payment installments, and official receipts'}
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <button id="btn-open-new-payment" class="px-4 py-2.5 rounded-xl text-xs font-bold btn-decor-primary flex items-center gap-2 shadow-sm">
              <i data-lucide="plus-circle" class="w-4 h-4"></i>
              <span data-i18n="btn_new_payment">${isSw ? 'Rekodi Malipo Mapya' : 'Record New Payment'}</span>
            </button>
          </div>
        </div>

        <!-- Financial KPI Metric Cards (TZS) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          
          <!-- Total Revenue Collected -->
          <div class="medical-card p-5 border-l-4 border-l-emerald-600">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-500 uppercase tracking-wider" data-i18n="lbl_total_revenue">
                ${isSw ? 'Jumla ya Mapato Yaliyokusanywa' : 'Total Revenue Collected'}
              </span>
              <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <i data-lucide="banknote" class="w-5 h-5"></i>
              </div>
            </div>
            <div class="mt-3 flex items-baseline gap-2">
              <span class="text-2xl font-black text-emerald-700">${Number(totalRevenue).toLocaleString()}</span>
              <span class="text-xs font-bold text-slate-500">TZS</span>
            </div>
            <p class="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
              <i data-lucide="check-circle" class="w-3.5 h-3.5 text-emerald-500"></i>
              <span>${paidInvoicesCount} ${isSw ? 'ankara zimelipwa kikamilifu' : 'fully paid invoices'}</span>
            </p>
          </div>

          <!-- Outstanding Patient Dues -->
          <div class="medical-card p-5 border-l-4 ${totalOutstanding > 0 ? 'border-l-amber-500' : 'border-l-teal-600'}">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-500 uppercase tracking-wider" data-i18n="lbl_outstanding_balance">
                ${isSw ? 'Madeni Yanayodaiwa' : 'Outstanding Patient Dues'}
              </span>
              <div class="w-9 h-9 rounded-xl ${totalOutstanding > 0 ? 'bg-amber-50 text-amber-700' : 'bg-teal-50 text-teal-700'} flex items-center justify-center">
                <i data-lucide="clock" class="w-5 h-5"></i>
              </div>
            </div>
            <div class="mt-3 flex items-baseline gap-2">
              <span class="text-2xl font-black ${totalOutstanding > 0 ? 'text-amber-600' : 'text-slate-800'}">${Number(totalOutstanding).toLocaleString()}</span>
              <span class="text-xs font-bold text-slate-500">TZS</span>
            </div>
            <p class="text-[11px] ${overdueInvoicesCount > 0 ? 'text-rose-600 font-bold' : 'text-slate-500'} mt-2 flex items-center gap-1">
              <i data-lucide="alert-circle" class="w-3.5 h-3.5 ${overdueInvoicesCount > 0 ? 'text-rose-500' : 'text-slate-400'}"></i>
              <span>${overdueInvoicesCount > 0 ? `${overdueInvoicesCount} ${isSw ? 'ankara zimechelewa' : 'invoices overdue'}` : (isSw ? 'Hakuna ankara zilizochelewa' : 'No overdue accounts')}</span>
            </p>
          </div>

          <!-- Collections This Month -->
          <div class="medical-card p-5 border-l-4 border-l-teal-600">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-500 uppercase tracking-wider" data-i18n="lbl_month_collections">
                ${isSw ? 'Makusanyo ya Mwezi Huu' : 'Collections This Month'}
              </span>
              <div class="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <i data-lucide="calendar-check" class="w-5 h-5"></i>
              </div>
            </div>
            <div class="mt-3 flex items-baseline gap-2">
              <span class="text-2xl font-black text-slate-900">${Number(monthCollections).toLocaleString()}</span>
              <span class="text-xs font-bold text-slate-500">TZS</span>
            </div>
            <p class="text-[11px] text-teal-700 font-medium mt-2 flex items-center gap-1">
              <i data-lucide="trending-up" class="w-3.5 h-3.5"></i>
              <span>${now.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
            </p>
          </div>

          <!-- Total Invoices / Records -->
          <div class="medical-card p-5 border-l-4 border-l-cyan-600">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-500 uppercase tracking-wider" data-i18n="lbl_total_invoices">
                ${isSw ? 'Jumla ya Ankara' : 'Total Invoices Issued'}
              </span>
              <div class="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center">
                <i data-lucide="file-spreadsheet" class="w-5 h-5"></i>
              </div>
            </div>
            <div class="mt-3 flex items-baseline gap-2">
              <span class="text-2xl font-black text-slate-900">${payments.length}</span>
              <span class="text-xs text-slate-500 font-medium">${isSw ? 'rekodi za malipo' : 'billing records'}</span>
            </div>
            <div class="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden flex">
              <div class="bg-emerald-500 h-full" style="width: ${payments.length ? (paidInvoicesCount / payments.length) * 100 : 0}%" title="Paid"></div>
              <div class="bg-amber-400 h-full" style="width: ${payments.length ? (partialInvoicesCount / payments.length) * 100 : 0}%" title="Partial"></div>
              <div class="bg-rose-500 h-full" style="width: ${payments.length ? (overdueInvoicesCount / payments.length) * 100 : 0}%" title="Overdue"></div>
            </div>
          </div>

        </div>

        <!-- Filter & Search Toolbar -->
        <div class="medical-card p-4 space-y-3">
          <div class="flex flex-col lg:flex-row items-center justify-between gap-3">
            <!-- Search bar -->
            <div class="relative w-full lg:w-96">
              <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"></i>
              <input type="text" id="payments-search-input" value="${this.searchQuery}" 
                     placeholder="${isSw ? 'Tafuta kwa jina la mkazi, ankara, simu, namba ya muamala...' : 'Search resident name, invoice #, phone, reference...'}" 
                     class="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500">
            </div>

            <!-- Filter Dropdowns -->
            <div class="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <!-- Status Filter -->
              <select id="filter-status-select" class="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 focus:outline-none focus:border-teal-500">
                <option value="all" ${this.filterStatus === 'all' ? 'selected' : ''}>${isSw ? 'Hali Zote' : 'All Statuses'}</option>
                <option value="Paid" ${this.filterStatus === 'Paid' ? 'selected' : ''}>${isSw ? 'Imelipwa (Paid)' : 'Paid'}</option>
                <option value="Partial" ${this.filterStatus === 'Partial' ? 'selected' : ''}>${isSw ? 'Imelipwa Kiasi (Partial)' : 'Partial'}</option>
                <option value="Pending" ${this.filterStatus === 'Pending' ? 'selected' : ''}>${isSw ? 'Inasubiri (Pending)' : 'Pending'}</option>
                <option value="Overdue" ${this.filterStatus === 'Overdue' ? 'selected' : ''}>${isSw ? 'Imechelewa (Overdue)' : 'Overdue'}</option>
              </select>

              <!-- Category Filter -->
              <select id="filter-category-select" class="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 focus:outline-none focus:border-teal-500">
                <option value="all" ${this.filterCategory === 'all' ? 'selected' : ''}>${isSw ? 'Aina Zote' : 'All Categories'}</option>
                <option value="Admission Fee" ${this.filterCategory === 'Admission Fee' ? 'selected' : ''}>${isSw ? 'Ada ya Kujiunga' : 'Admission Fee'}</option>
                <option value="Monthly Rehab Stay" ${this.filterCategory === 'Monthly Rehab Stay' ? 'selected' : ''}>${isSw ? 'Makazi ya Mwezi' : 'Monthly Rehab Stay'}</option>
                <option value="Medication / Pharmacy" ${this.filterCategory === 'Medication / Pharmacy' ? 'selected' : ''}>${isSw ? 'Dawa & Famasi' : 'Medication / Pharmacy'}</option>
                <option value="Counseling & Therapy" ${this.filterCategory === 'Counseling & Therapy' ? 'selected' : ''}>${isSw ? 'Ushauri & Tiba' : 'Counseling & Therapy'}</option>
                <option value="Medical & Detox Consultation" ${this.filterCategory === 'Medical & Detox Consultation' ? 'selected' : ''}>${isSw ? 'Uchunguzi wa Daktari' : 'Medical & Detox Consultation'}</option>
                <option value="Laboratory / Drug Screening" ${this.filterCategory === 'Laboratory / Drug Screening' ? 'selected' : ''}>${isSw ? 'Vipimo vya Maabara' : 'Laboratory & Screenings'}</option>
                <option value="Other Facility Service" ${this.filterCategory === 'Other Facility Service' ? 'selected' : ''}>${isSw ? 'Huduma Nyingine' : 'Other Facility Service'}</option>
              </select>

              <!-- Payment Method Filter -->
              <select id="filter-method-select" class="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 focus:outline-none focus:border-teal-500">
                <option value="all" ${this.filterMethod === 'all' ? 'selected' : ''}>${isSw ? 'Njia Zote za Malipo' : 'All Payment Channels'}</option>
                <option value="M-Pesa" ${this.filterMethod === 'M-Pesa' ? 'selected' : ''}>Vodacom M-Pesa</option>
                <option value="Tigo Pesa" ${this.filterMethod === 'Tigo Pesa' ? 'selected' : ''}>Tigo Pesa / Yas</option>
                <option value="Airtel Money" ${this.filterMethod === 'Airtel Money' ? 'selected' : ''}>Airtel Money</option>
                <option value="HaloPesa" ${this.filterMethod === 'HaloPesa' ? 'selected' : ''}>HaloPesa</option>
                <option value="Bank Transfer" ${this.filterMethod === 'Bank Transfer' ? 'selected' : ''}>${isSw ? 'Benki (CRDB/NMB)' : 'Bank Transfer (CRDB/NMB)'}</option>
                <option value="Cash" ${this.filterMethod === 'Cash' ? 'selected' : ''}>${isSw ? 'Pesa Taslimu (Cash)' : 'Cash'}</option>
              </select>

              ${(this.searchQuery || this.filterStatus !== 'all' || this.filterCategory !== 'all' || this.filterMethod !== 'all') ? `
                <button id="btn-reset-payment-filters" class="text-xs px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition flex items-center gap-1">
                  <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                  <span>${isSw ? 'Weka Upya' : 'Reset'}</span>
                </button>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Invoices & Payments Table -->
        <div class="medical-card overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th class="py-3 px-4">${isSw ? 'Ankara & Tarehe' : 'Invoice & Date'}</th>
                  <th class="py-3 px-4">${isSw ? 'Mkaazi / Mlipaji' : 'Resident / Payer'}</th>
                  <th class="py-3 px-4">${isSw ? 'Aina ya Malipo' : 'Category'}</th>
                  <th class="py-3 px-4 text-right">${isSw ? 'Kiasi (TZS)' : 'Total (TZS)'}</th>
                  <th class="py-3 px-4 text-right">${isSw ? 'Kilicholipwa' : 'Paid (TZS)'}</th>
                  <th class="py-3 px-4 text-right">${isSw ? 'Baki (TZS)' : 'Balance (TZS)'}</th>
                  <th class="py-3 px-4">${isSw ? 'Njia & Kumbukumbu' : 'Channel & Ref'}</th>
                  <th class="py-3 px-4 text-center">${isSw ? 'Hali' : 'Status'}</th>
                  <th class="py-3 px-4 text-right">${isSw ? 'Vitendo' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-slate-700">
                ${filteredPayments.length > 0 ? filteredPayments.map(p => this.renderPaymentRow(p, isSw)).join('') : `
                  <tr>
                    <td colspan="9" class="py-12 text-center text-slate-400">
                      <div class="flex flex-col items-center justify-center space-y-2">
                        <i data-lucide="receipt" class="w-10 h-10 text-slate-300"></i>
                        <span class="font-bold text-slate-600 text-sm">${isSw ? 'Hakuna Rekodi za Malipo Zilizopatikana' : 'No Payment Records Found'}</span>
                        <p class="text-xs text-slate-400 max-w-sm">
                          ${isSw ? 'Anza kwa kurekodi malipo ya kwanza au badilisha vigezo vya utafutaji hapo juu.' : 'Get started by recording an admission fee, medication payment, or monthly stay installment.'}
                        </p>
                        <button onclick="window.PaymentsViewInstance.openNewPaymentModal()" class="mt-2 btn-decor-primary text-xs px-4 py-2 rounded-xl font-bold flex items-center gap-1.5">
                          <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
                          <span>${isSw ? 'Rekodi Malipo ya Kwanza' : 'Record First Payment'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    this.bindEvents(container);
    if (window.lucide) window.lucide.createIcons();
  }

  renderPaymentRow(p, isSw) {
    const statusBadges = {
      Paid: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
      Partial: 'bg-amber-100 text-amber-800 border border-amber-200',
      Pending: 'bg-sky-100 text-sky-800 border border-sky-200',
      Overdue: 'bg-rose-100 text-rose-800 border border-rose-200'
    };
    const badgeClass = statusBadges[p.status] || 'bg-slate-100 text-slate-800';

    const statusLabels = {
      Paid: isSw ? 'Imelipwa' : 'Paid',
      Partial: isSw ? 'Imelipwa Kiasi' : 'Partial',
      Pending: isSw ? 'Inasubiri' : 'Pending',
      Overdue: isSw ? 'Imechelewa' : 'Overdue'
    };
    const statusText = statusLabels[p.status] || p.status;

    const isAdmin = window.Auth.getCurrentRole() === 'admin' || window.Auth.hasPermission('users');

    return `
      <tr class="hover:bg-slate-50/70 transition group">
        
        <!-- Invoice & Date -->
        <td class="py-3.5 px-4">
          <div class="font-mono font-bold text-slate-900">${p.invoiceNumber}</div>
          <div class="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
            <i data-lucide="calendar" class="w-3 h-3"></i>
            <span>${p.date}</span>
          </div>
        </td>

        <!-- Resident / Payer -->
        <td class="py-3.5 px-4">
          <div class="font-bold text-slate-900 flex items-center gap-1.5">
            <span>${p.patientName}</span>
            ${p.patientId ? `<span class="font-mono text-[10px] text-teal-700 bg-teal-50 px-1.5 py-0.2 rounded font-bold">${p.patientId}</span>` : ''}
          </div>
          ${p.payerName ? `
            <div class="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
              <span>${p.payerName}</span>
              ${p.payerPhone ? `<span class="text-slate-400 font-mono">(${p.payerPhone})</span>` : ''}
            </div>
          ` : ''}
        </td>

        <!-- Category -->
        <td class="py-3.5 px-4">
          <span class="inline-block px-2.5 py-1 rounded-lg bg-slate-100 font-semibold text-slate-700 text-[11px]">
            ${p.category}
          </span>
          ${p.description ? `<div class="text-[10px] text-slate-400 truncate max-w-xs mt-0.5">${p.description}</div>` : ''}
        </td>

        <!-- Total (TZS) -->
        <td class="py-3.5 px-4 text-right font-bold text-slate-900 font-mono">
          ${Number(p.totalAmount || 0).toLocaleString()}
        </td>

        <!-- Amount Paid (TZS) -->
        <td class="py-3.5 px-4 text-right font-bold text-emerald-700 font-mono">
          ${Number(p.amountPaid || 0).toLocaleString()}
        </td>

        <!-- Balance (TZS) -->
        <td class="py-3.5 px-4 text-right font-bold ${p.balance > 0 ? 'text-amber-600' : 'text-slate-400'} font-mono">
          ${Number(p.balance || 0).toLocaleString()}
        </td>

        <!-- Channel & Ref -->
        <td class="py-3.5 px-4">
          <div class="font-semibold text-slate-800 flex items-center gap-1">
            <i data-lucide="${p.paymentMethod.includes('M-Pesa') || p.paymentMethod.includes('Tigo') || p.paymentMethod.includes('Airtel') || p.paymentMethod.includes('Halo') ? 'smartphone' : (p.paymentMethod.includes('Bank') ? 'building' : 'wallet')}" class="w-3.5 h-3.5 text-teal-600"></i>
            <span>${p.paymentMethod}</span>
          </div>
          ${p.referenceNo ? `
            <div class="text-[10px] font-mono text-slate-400 mt-0.5 truncate max-w-[120px]" title="${p.referenceNo}">
              Ref: ${p.referenceNo}
            </div>
          ` : ''}
        </td>

        <!-- Status Badge -->
        <td class="py-3.5 px-4 text-center">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badgeClass}">
            ${statusText}
          </span>
          ${p.dueDate && p.balance > 0 ? `
            <div class="text-[9px] text-slate-400 mt-0.5">Due: ${p.dueDate}</div>
          ` : ''}
        </td>

        <!-- Actions -->
        <td class="py-3.5 px-4 text-right">
          <div class="inline-flex items-center gap-1">
            <!-- Print Receipt -->
            <button class="p-1.5 rounded-lg text-slate-600 hover:text-teal-700 hover:bg-teal-50 transition btn-print-receipt" 
                    data-payment-id="${p.id}" title="${isSw ? 'Chapa Stakabadhi ya Malipo' : 'View & Print Official Receipt'}">
              <i data-lucide="printer" class="w-4 h-4 text-teal-600"></i>
            </button>

            <!-- Record Installment if balance > 0 -->
            ${p.balance > 0 ? `
              <button class="p-1.5 rounded-lg text-slate-600 hover:text-amber-700 hover:bg-amber-50 transition btn-add-installment" 
                      data-payment-id="${p.id}" title="${isSw ? 'Ongeza Awamu ya Malipo' : 'Record Payment Installment'}">
                <i data-lucide="wallet" class="w-4 h-4 text-amber-600"></i>
              </button>
            ` : ''}

            <!-- Edit Payment -->
            <button class="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition btn-edit-payment" 
                    data-payment-id="${p.id}" title="${isSw ? 'Hariri Ankara' : 'Edit Invoice'}">
              <i data-lucide="edit-3" class="w-3.5 h-3.5 text-slate-500"></i>
            </button>

            <!-- Delete Payment (Admin only) -->
            ${isAdmin ? `
              <button class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition btn-delete-payment" 
                      data-payment-id="${p.id}" title="${isSw ? 'Futa Rekodi' : 'Delete Record'}">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            ` : ''}
          </div>
        </td>

      </tr>
    `;
  }

  bindEvents(container) {
    const isSw = window.I18n && window.I18n.getLang() === 'sw';

    // Search input
    const searchInput = container.querySelector('#payments-search-input');
    if (searchInput) {
      searchInput.oninput = (e) => {
        this.searchQuery = e.target.value;
        this.render(container);
        // keep focus in input
        const newInp = container.querySelector('#payments-search-input');
        if (newInp) {
          newInp.focus();
          newInp.setSelectionRange(newInp.value.length, newInp.value.length);
        }
      };
    }

    // Status filter
    const statusSelect = container.querySelector('#filter-status-select');
    if (statusSelect) {
      statusSelect.onchange = (e) => {
        this.filterStatus = e.target.value;
        this.render(container);
      };
    }

    // Category filter
    const catSelect = container.querySelector('#filter-category-select');
    if (catSelect) {
      catSelect.onchange = (e) => {
        this.filterCategory = e.target.value;
        this.render(container);
      };
    }

    // Method filter
    const methodSelect = container.querySelector('#filter-method-select');
    if (methodSelect) {
      methodSelect.onchange = (e) => {
        this.filterMethod = e.target.value;
        this.render(container);
      };
    }

    // Reset filters
    const resetBtn = container.querySelector('#btn-reset-payment-filters');
    if (resetBtn) {
      resetBtn.onclick = () => {
        this.searchQuery = '';
        this.filterStatus = 'all';
        this.filterCategory = 'all';
        this.filterMethod = 'all';
        this.render(container);
      };
    }

    // Open New Payment Modal
    const newBtn = container.querySelector('#btn-open-new-payment');
    if (newBtn) {
      newBtn.onclick = () => this.openNewPaymentModal();
    }

    // Print Receipt buttons
    container.querySelectorAll('.btn-print-receipt').forEach(btn => {
      btn.onclick = () => {
        const pid = btn.getAttribute('data-payment-id');
        this.openReceiptModal(pid);
      };
    });

    // Add Installment buttons
    container.querySelectorAll('.btn-add-installment').forEach(btn => {
      btn.onclick = () => {
        const pid = btn.getAttribute('data-payment-id');
        this.openInstallmentModal(pid);
      };
    });

    // Edit Payment buttons
    container.querySelectorAll('.btn-edit-payment').forEach(btn => {
      btn.onclick = () => {
        const pid = btn.getAttribute('data-payment-id');
        this.openEditPaymentModal(pid);
      };
    });

    // Delete Payment buttons
    container.querySelectorAll('.btn-delete-payment').forEach(btn => {
      btn.onclick = () => {
        const pid = btn.getAttribute('data-payment-id');
        const p = window.AppStore.getPaymentById(pid);
        const inv = p ? p.invoiceNumber : pid;
        window.AppModal.confirm(
          isSw ? 'Futa Rekodi ya Malipo?' : 'Delete Billing Record?',
          isSw ? `Una uhakika unataka kufuta ankara ${inv} (${p ? p.patientName : ''}) kabisa?` : `Are you sure you want to permanently delete invoice ${inv} (${p ? p.patientName : ''})?`,
          isSw ? 'Futa Kabisa' : 'Delete Record',
          'danger'
        ).then(async confirmed => {
          if (confirmed) {
            await window.AppStore.deletePayment(pid);
          }
        });
      };
    });
  }

  /**
   * Modal to record a new payment / issue invoice
   */
  openNewPaymentModal(prefillPatientId = null) {
    const state = window.AppStore.getState();
    const patients = state.patients || [];
    const isSw = window.I18n && window.I18n.getLang() === 'sw';

    const defaultDueDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    const html = `
      <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
            <i data-lucide="receipt" class="w-4 h-4"></i>
          </div>
          <div>
            <h3 class="text-lg font-bold text-slate-900">${isSw ? 'Rekodi Malipo au Ankara Mpya' : 'Record New Payment / Invoice'}</h3>
            <p class="text-xs text-slate-500">${isSw ? 'Malipo yote yatahifadhiwa kwa Shilingi ya Tanzania (TZS)' : 'Denominated in Tanzanian Shillings (TZS)'}</p>
          </div>
        </div>
        <button id="close-payment-modal" class="p-1 text-slate-400 hover:bg-slate-100 rounded-lg">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <form id="new-payment-form" class="space-y-4 text-xs">
        
        <!-- Resident Selection -->
        <div>
          <label class="block font-bold text-slate-700 mb-1">${isSw ? 'Mkaazi / Mgonjwa *' : 'Resident / Patient *'}</label>
          <select id="pay-patient-select" class="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold text-slate-800">
            <option value="">${isSw ? '-- Chagua Mkaazi (au Malipo ya Jumla) --' : '-- Select Resident (or General Walk-in) --'}</option>
            ${patients.map(p => `
              <option value="${p.id}" ${prefillPatientId === p.id ? 'selected' : ''}>
                ${p.name} (${p.id} &bull; Room ${p.roomNumber || 'N/A'})
              </option>
            `).join('')}
            <option value="WALK_IN">${isSw ? 'Malipo ya Jumla / Asiye Mkaazi (Walk-in)' : 'General Walk-in / Facility Direct'}</option>
          </select>
        </div>

        <div id="custom-patient-name-container" class="hidden">
          <label class="block font-bold text-slate-700 mb-1">${isSw ? 'Jina la Mlipaji / Mkaazi wa Nje' : 'Client / Resident Legal Name'}</label>
          <input type="text" id="pay-custom-name" placeholder="E.g., Walk-in Visitor / Community Consultation" class="w-full px-3 py-2 rounded-xl border border-slate-200">
        </div>

        <!-- Category & Service Description -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">${isSw ? 'Aina ya Huduma / Malipo *' : 'Billing Category *'}</label>
            <select id="pay-category" class="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold text-slate-800">
              <option value="Admission Fee">${isSw ? 'Ada ya Kujiunga (Admission Fee)' : 'Admission Fee'}</option>
              <option value="Monthly Rehab Stay">${isSw ? 'Gharama ya Makazi ya Mwezi (Monthly Stay)' : 'Monthly Rehab Stay'}</option>
              <option value="Medication / Pharmacy">${isSw ? 'Dawa & Famasi (Medication / Pharmacy)' : 'Medication / Pharmacy'}</option>
              <option value="Counseling & Therapy">${isSw ? 'Ushauri wa Kisaikolojia (Counseling / Therapy)' : 'Counseling & Therapy'}</option>
              <option value="Medical & Detox Consultation">${isSw ? 'Uchunguzi wa Daktari / Detox' : 'Medical & Detox Consultation'}</option>
              <option value="Laboratory / Drug Screening">${isSw ? 'Vipimo vya Maabara (Drug Screening)' : 'Laboratory / Drug Screening'}</option>
              <option value="Other Facility Service">${isSw ? 'Huduma Nyinginezo' : 'Other Facility Service'}</option>
            </select>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">${isSw ? 'Maelezo Mafupi' : 'Service Description'}</label>
            <input type="text" id="pay-description" placeholder="E.g., 30-day inpatient stay & detox intake" class="w-full px-3 py-2 rounded-xl border border-slate-200">
          </div>
        </div>

        <!-- Amounts in TZS -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-teal-50/50 rounded-xl border border-teal-200">
          <div>
            <label class="block font-bold text-teal-950 mb-1">${isSw ? 'Jumla ya Gharama (TZS) *' : 'Total Invoiced Amount (TZS) *'}</label>
            <div class="relative">
              <input type="number" id="pay-total-amount" required min="0" step="500" placeholder="1500000" class="w-full px-3 py-2 rounded-xl border border-teal-300 font-bold font-mono text-sm text-slate-900 pr-12">
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-teal-700 pointer-events-none">TZS</span>
            </div>
            <span class="text-[10px] text-teal-800">${isSw ? 'Kiasi kamili kinachotozwa' : 'Full invoiced service charge'}</span>
          </div>

          <div>
            <label class="block font-bold text-teal-950 mb-1">${isSw ? 'Kiasi Kilicholipwa Sasa (TZS) *' : 'Initial Amount Paid Now (TZS) *'}</label>
            <div class="relative">
              <input type="number" id="pay-paid-amount" required min="0" step="500" placeholder="1500000" class="w-full px-3 py-2 rounded-xl border border-teal-300 font-bold font-mono text-sm text-emerald-700 pr-12">
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-teal-700 pointer-events-none">TZS</span>
            </div>
            <span class="text-[10px] text-teal-800">${isSw ? 'Weka 0 kama haijalipwa bado' : 'Enter 0 if unpaid invoice'}</span>
          </div>
        </div>

        <!-- Payment Method & Transaction Reference -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">${isSw ? 'Njia ya Malipo *' : 'Payment Method *'}</label>
            <select id="pay-method" class="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-800">
              <option value="M-Pesa">Vodacom M-Pesa</option>
              <option value="Tigo Pesa">Tigo Pesa / Yas</option>
              <option value="Airtel Money">Airtel Money</option>
              <option value="HaloPesa">HaloPesa</option>
              <option value="Bank Transfer">Bank Transfer (CRDB / NMB)</option>
              <option value="Cash">Cash (Pesa Taslimu)</option>
            </select>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">${isSw ? 'Namba ya Muamala / Risiti (TXID)' : 'Reference No / Transaction Code'}</label>
            <input type="text" id="pay-reference" placeholder="E.g., QK83920194 or CRDB Slip #9482" class="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono">
          </div>
        </div>

        <!-- Payer Demographics -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">${isSw ? 'Jina la Mlipaji / Ndugu' : 'Payer Name (Next of Kin / Sponsor)'}</label>
            <input type="text" id="pay-payer-name" placeholder="E.g., Hassan Ali (Father / Sponsor)" class="w-full px-3 py-2 rounded-xl border border-slate-200">
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">${isSw ? 'Namba ya Simu ya Mlipaji' : 'Payer Phone Number'}</label>
            <input type="text" id="pay-payer-phone" placeholder="+255 700 000 000" class="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono">
          </div>
        </div>

        <!-- Dates -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">${isSw ? 'Tarehe ya Malipo' : 'Invoice Date'}</label>
            <input type="date" id="pay-date" value="${today}" class="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono">
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">${isSw ? 'Tarehe ya Mwisho wa Kulipa (Due Date)' : 'Payment Due Date'}</label>
            <input type="date" id="pay-due-date" value="${defaultDueDate}" class="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono">
          </div>
        </div>

        <!-- Notes -->
        <div>
          <label class="block font-bold text-slate-700 mb-1">${isSw ? 'Maelezo ya Ziada / Kumbukumbu' : 'Administrative Notes'}</label>
          <textarea id="pay-notes" rows="2" placeholder="${isSw ? 'Maelezo yoyote kuhusu malipo haya...' : 'Any relevant notes regarding this installment or payer terms...'}" class="w-full px-3 py-2 rounded-xl border border-slate-200"></textarea>
        </div>

        <div class="pt-4 border-t border-slate-200 flex justify-end gap-3">
          <button type="button" id="cancel-payment-btn" class="px-4 py-2 rounded-xl btn-decor-secondary font-semibold">
            ${isSw ? 'Ghairi' : 'Cancel'}
          </button>
          <button type="submit" class="px-5 py-2 rounded-xl btn-decor-primary font-bold flex items-center gap-1.5">
            <i data-lucide="check" class="w-4 h-4"></i>
            <span>${isSw ? 'Hifadhi & Tengeneza Risiti' : 'Save & Issue Receipt'}</span>
          </button>
        </div>

      </form>
    `;

    window.AppModal.showCustom(html, 'max-w-2xl');

    document.getElementById('close-payment-modal').onclick = () => window.AppModal.close();
    document.getElementById('cancel-payment-btn').onclick = () => window.AppModal.close();

    // Patient select listener to auto-populate payer info
    const patientSelect = document.getElementById('pay-patient-select');
    const customNameContainer = document.getElementById('custom-patient-name-container');

    const updatePayerFromPatient = (pid) => {
      if (pid === 'WALK_IN') {
        customNameContainer.classList.remove('hidden');
      } else {
        customNameContainer.classList.add('hidden');
        const selectedP = patients.find(p => p.id === pid);
        if (selectedP && selectedP.nextOfKin) {
          const payerInp = document.getElementById('pay-payer-name');
          const phoneInp = document.getElementById('pay-payer-phone');
          if (payerInp && !payerInp.value) payerInp.value = `${selectedP.nextOfKin.name || ''} (${selectedP.nextOfKin.relationship || 'Next of Kin'})`.trim();
          if (phoneInp && !phoneInp.value) phoneInp.value = selectedP.nextOfKin.phone || selectedP.phone || '';
        }
      }
    };

    if (patientSelect) {
      patientSelect.onchange = (e) => updatePayerFromPatient(e.target.value);
      if (prefillPatientId) updatePayerFromPatient(prefillPatientId);
    }

    // Auto-match paid amount with total amount when total amount changes (if paid is empty)
    const totalInput = document.getElementById('pay-total-amount');
    const paidInput = document.getElementById('pay-paid-amount');
    if (totalInput && paidInput) {
      totalInput.oninput = () => {
        if (!paidInput.value || paidInput.dataset.touched !== 'true') {
          paidInput.value = totalInput.value;
        }
      };
      paidInput.oninput = () => {
        paidInput.dataset.touched = 'true';
      };
    }

    // Handle Form Submit
    document.getElementById('new-payment-form').onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="animate-spin inline-block mr-1">⏳</span> Saving...';
      }

      const pid = patientSelect ? patientSelect.value : '';
      let patientName = 'General Facility Fee';
      let patientIdVal = null;

      if (pid === 'WALK_IN') {
        const customName = document.getElementById('pay-custom-name').value.trim();
        patientName = customName || 'Walk-in Client';
        patientIdVal = null;
      } else if (pid) {
        const pObj = patients.find(p => p.id === pid);
        if (pObj) {
          patientName = pObj.name;
          patientIdVal = pObj.id;
        }
      }

      const totalVal = Math.max(0, Number(document.getElementById('pay-total-amount').value) || 0);
      const paidVal = Math.max(0, Number(document.getElementById('pay-paid-amount').value) || 0);

      const paymentData = {
        patientId: patientIdVal,
        patientName: patientName,
        category: document.getElementById('pay-category').value,
        description: document.getElementById('pay-description').value.trim(),
        totalAmount: totalVal,
        amountPaid: paidVal,
        paymentMethod: document.getElementById('pay-method').value,
        referenceNo: document.getElementById('pay-reference').value.trim(),
        payerName: document.getElementById('pay-payer-name').value.trim(),
        payerPhone: document.getElementById('pay-payer-phone').value.trim(),
        date: document.getElementById('pay-date').value,
        dueDate: document.getElementById('pay-due-date').value,
        notes: document.getElementById('pay-notes').value.trim()
      };

      try {
        const created = await window.AppStore.addPayment(paymentData);
        window.AppModal.close();

        // Show confirmation acceptance card with direct "Print Receipt" trigger
        window.AppModal.showAcceptanceCard({
          title: isSw ? 'Malipo Yamehifadhiwa Kikamilifu' : 'Payment Recorded Successfully',
          subtitle: `${created.invoiceNumber}: ${created.patientName} - ${window.AppStore.formatCurrency(created.amountPaid)} via ${created.paymentMethod}`,
          icon: 'receipt',
          badgeText: isSw ? 'IMEREKODIWA GLOBAL' : 'REPLICATED GLOBALLY',
          badgeColor: 'badge-medical-emerald',
          confirmType: 'success',
          confirmText: isSw ? 'Chapa Risiti Sasa' : 'Print Receipt Now',
          cancelText: isSw ? 'Funga' : 'Done',
          onConfirm: () => {
            window.AppModal.close();
            this.openReceiptModal(created.id);
          }
        });
      } catch (err) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Save & Issue Receipt';
        }
        window.AppModal.close();
      }
    };

    if (window.lucide) window.lucide.createIcons();
  }

  /**
   * Modal to log an installment payment against an invoice
   */
  openInstallmentModal(paymentId) {
    const payment = window.AppStore.getPaymentById(paymentId);
    if (!payment) return;

    const isSw = window.I18n && window.I18n.getLang() === 'sw';
    const today = new Date().toISOString().split('T')[0];

    const html = `
      <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
            <i data-lucide="wallet" class="w-4 h-4"></i>
          </div>
          <div>
            <h3 class="text-lg font-bold text-slate-900">${isSw ? 'Ongeza Awamu ya Malipo' : 'Record Payment Installment'}</h3>
            <p class="text-xs text-slate-500">${payment.invoiceNumber} &bull; ${payment.patientName}</p>
          </div>
        </div>
        <button id="close-inst-modal" class="p-1 text-slate-400 hover:bg-slate-100 rounded-lg">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <!-- Current Balance Summary -->
      <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-3 gap-2 text-center text-xs mb-4">
        <div>
          <span class="text-slate-400 block text-[10px] uppercase font-bold">${isSw ? 'Jumla ya Ankara' : 'Total Billed'}</span>
          <span class="font-bold text-slate-800 font-mono">${window.AppStore.formatCurrency(payment.totalAmount)}</span>
        </div>
        <div>
          <span class="text-slate-400 block text-[10px] uppercase font-bold">${isSw ? 'Iliyolipwa Awali' : 'Already Paid'}</span>
          <span class="font-bold text-emerald-700 font-mono">${window.AppStore.formatCurrency(payment.amountPaid)}</span>
        </div>
        <div>
          <span class="text-slate-400 block text-[10px] uppercase font-bold">${isSw ? 'Baki Inayodaiwa' : 'Remaining Due'}</span>
          <span class="font-black text-amber-600 font-mono">${window.AppStore.formatCurrency(payment.balance)}</span>
        </div>
      </div>

      <form id="installment-form" class="space-y-4 text-xs">
        <div>
          <label class="block font-bold text-slate-700 mb-1">${isSw ? 'Kiasi cha Awamu ya Sasa (TZS) *' : 'Installment Amount (TZS) *'}</label>
          <div class="relative">
            <input type="number" id="inst-amount" required min="100" max="${payment.balance}" step="500" value="${payment.balance}" class="w-full px-3 py-2 rounded-xl border border-amber-300 font-bold font-mono text-sm text-slate-900 pr-12">
            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-700 pointer-events-none">TZS</span>
          </div>
          <span class="text-[10px] text-slate-400">${isSw ? 'Kiwango cha juu ni baki ya' : 'Max allowed is remaining balance of'} ${window.AppStore.formatCurrency(payment.balance)}</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">${isSw ? 'Njia ya Malipo *' : 'Payment Method *'}</label>
            <select id="inst-method" class="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-800">
              <option value="M-Pesa">Vodacom M-Pesa</option>
              <option value="Tigo Pesa">Tigo Pesa / Yas</option>
              <option value="Airtel Money">Airtel Money</option>
              <option value="HaloPesa">HaloPesa</option>
              <option value="Bank Transfer">Bank Transfer (CRDB / NMB)</option>
              <option value="Cash">Cash (Pesa Taslimu)</option>
            </select>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">${isSw ? 'Namba ya Muamala (TXID)' : 'Reference / TX Code'}</label>
            <input type="text" id="inst-reference" placeholder="E.g., QK83920194" class="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono">
          </div>
        </div>

        <div>
          <label class="block font-bold text-slate-700 mb-1">${isSw ? 'Tarehe ya Malipo' : 'Payment Date'}</label>
          <input type="date" id="inst-date" value="${today}" class="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono">
        </div>

        <div>
          <label class="block font-bold text-slate-700 mb-1">${isSw ? 'Maelezo ya Awamu Hii' : 'Installment Note'}</label>
          <input type="text" id="inst-notes" placeholder="E.g., Second installment paid via M-Pesa at reception" class="w-full px-3 py-2 rounded-xl border border-slate-200">
        </div>

        <div class="pt-4 border-t border-slate-200 flex justify-end gap-3">
          <button type="button" id="cancel-inst-btn" class="px-4 py-2 rounded-xl btn-decor-secondary font-semibold">
            ${isSw ? 'Ghairi' : 'Cancel'}
          </button>
          <button type="submit" class="px-5 py-2 rounded-xl btn-decor-primary font-bold flex items-center gap-1.5">
            <i data-lucide="check" class="w-4 h-4"></i>
            <span>${isSw ? 'Thibitisha Awamu' : 'Confirm Installment'}</span>
          </button>
        </div>
      </form>
    `;

    window.AppModal.showCustom(html, 'max-w-md');

    document.getElementById('close-inst-modal').onclick = () => window.AppModal.close();
    document.getElementById('cancel-inst-btn').onclick = () => window.AppModal.close();

    document.getElementById('installment-form').onsubmit = async (e) => {
      e.preventDefault();
      const amountVal = Number(document.getElementById('inst-amount').value) || 0;

      const instData = {
        amount: amountVal,
        paymentMethod: document.getElementById('inst-method').value,
        referenceNo: document.getElementById('inst-reference').value.trim(),
        date: document.getElementById('inst-date').value,
        notes: document.getElementById('inst-notes').value.trim()
      };

      try {
        const updated = await window.AppStore.recordPaymentInstallment(paymentId, instData);
        window.AppModal.close();

        window.AppModal.showAcceptanceCard({
          title: isSw ? 'Awamu ya Malipo Imerekodiwa' : 'Installment Recorded',
          subtitle: `${updated.invoiceNumber}: +${window.AppStore.formatCurrency(amountVal)} (Baki Mpya: ${window.AppStore.formatCurrency(updated.balance)})`,
          icon: 'check-circle-2',
          badgeText: isSw ? 'IMEHIFADHIWA' : 'SAVED GLOBALLY',
          badgeColor: 'badge-medical-emerald',
          confirmType: 'success',
          confirmText: isSw ? 'Tazama Risiti' : 'View Updated Receipt',
          cancelText: isSw ? 'Sawa' : 'Close',
          onConfirm: () => {
            window.AppModal.close();
            this.openReceiptModal(paymentId);
          }
        });
      } catch (err) {
        window.AppModal.close();
      }
    };

    if (window.lucide) window.lucide.createIcons();
  }

  /**
   * Modal to edit an existing payment / invoice
   */
  openEditPaymentModal(paymentId) {
    const payment = window.AppStore.getPaymentById(paymentId);
    if (!payment) return;

    const isSw = window.I18n && window.I18n.getLang() === 'sw';

    const html = `
      <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
        <div>
          <h3 class="text-lg font-bold text-slate-900">${isSw ? 'Hariri Ankara & Malipo' : 'Edit Invoice & Payment Details'}</h3>
          <p class="text-xs text-slate-500">${payment.invoiceNumber} &bull; ${payment.patientName}</p>
        </div>
        <button id="close-edit-pay-modal" class="p-1 text-slate-400 hover:bg-slate-100 rounded-lg">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <form id="edit-payment-form" class="space-y-4 text-xs">
        
        <div>
          <label class="block font-bold text-slate-700 mb-1">${isSw ? 'Jina la Mkaazi / Mlipaji' : 'Resident / Payer Name'}</label>
          <input type="text" id="edit-pay-name" value="${payment.patientName}" required class="w-full px-3 py-2 rounded-xl border border-slate-200">
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">${isSw ? 'Aina ya Huduma' : 'Category'}</label>
            <select id="edit-pay-cat" class="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold text-slate-800">
              <option value="Admission Fee" ${payment.category === 'Admission Fee' ? 'selected' : ''}>Admission Fee</option>
              <option value="Monthly Rehab Stay" ${payment.category === 'Monthly Rehab Stay' ? 'selected' : ''}>Monthly Rehab Stay</option>
              <option value="Medication / Pharmacy" ${payment.category === 'Medication / Pharmacy' ? 'selected' : ''}>Medication / Pharmacy</option>
              <option value="Counseling & Therapy" ${payment.category === 'Counseling & Therapy' ? 'selected' : ''}>Counseling & Therapy</option>
              <option value="Medical & Detox Consultation" ${payment.category === 'Medical & Detox Consultation' ? 'selected' : ''}>Medical & Detox Consultation</option>
              <option value="Laboratory / Drug Screening" ${payment.category === 'Laboratory / Drug Screening' ? 'selected' : ''}>Laboratory / Drug Screening</option>
              <option value="Other Facility Service" ${payment.category === 'Other Facility Service' ? 'selected' : ''}>Other Facility Service</option>
            </select>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">${isSw ? 'Maelezo ya Huduma' : 'Service Description'}</label>
            <input type="text" id="edit-pay-desc" value="${payment.description || ''}" class="w-full px-3 py-2 rounded-xl border border-slate-200">
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">${isSw ? 'Jumla ya Ankara (TZS) *' : 'Total Invoiced (TZS) *'}</label>
            <input type="number" id="edit-pay-total" value="${payment.totalAmount}" required min="0" step="500" class="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold">
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">${isSw ? 'Kiasi Kilicholipwa (TZS) *' : 'Amount Paid (TZS) *'}</label>
            <input type="number" id="edit-pay-paid" value="${payment.amountPaid}" required min="0" step="500" class="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-emerald-700">
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">${isSw ? 'Mlipaji / Ndugu' : 'Payer Name'}</label>
            <input type="text" id="edit-pay-payer" value="${payment.payerName || ''}" class="w-full px-3 py-2 rounded-xl border border-slate-200">
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">${isSw ? 'Simu ya Mlipaji' : 'Payer Phone'}</label>
            <input type="text" id="edit-pay-phone" value="${payment.payerPhone || ''}" class="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono">
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">${isSw ? 'Njia ya Malipo' : 'Payment Method'}</label>
            <select id="edit-pay-method" class="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold">
              <option value="M-Pesa" ${payment.paymentMethod === 'M-Pesa' ? 'selected' : ''}>Vodacom M-Pesa</option>
              <option value="Tigo Pesa" ${payment.paymentMethod === 'Tigo Pesa' ? 'selected' : ''}>Tigo Pesa / Yas</option>
              <option value="Airtel Money" ${payment.paymentMethod === 'Airtel Money' ? 'selected' : ''}>Airtel Money</option>
              <option value="HaloPesa" ${payment.paymentMethod === 'HaloPesa' ? 'selected' : ''}>HaloPesa</option>
              <option value="Bank Transfer" ${payment.paymentMethod === 'Bank Transfer' ? 'selected' : ''}>Bank Transfer (CRDB / NMB)</option>
              <option value="Cash" ${payment.paymentMethod === 'Cash' ? 'selected' : ''}>Cash</option>
            </select>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">${isSw ? 'Namba ya Kumbukumbu' : 'Reference / TXID'}</label>
            <input type="text" id="edit-pay-ref" value="${payment.referenceNo || ''}" class="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono">
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">${isSw ? 'Tarehe ya Malipo' : 'Date'}</label>
            <input type="date" id="edit-pay-date" value="${payment.date || ''}" class="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono">
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">${isSw ? 'Tarehe ya Mwisho wa Kulipa' : 'Due Date'}</label>
            <input type="date" id="edit-pay-due" value="${payment.dueDate || ''}" class="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono">
          </div>
        </div>

        <div>
          <label class="block font-bold text-slate-700 mb-1">${isSw ? 'Maelezo' : 'Notes'}</label>
          <textarea id="edit-pay-notes" rows="2" class="w-full px-3 py-2 rounded-xl border border-slate-200">${payment.notes || ''}</textarea>
        </div>

        <div class="pt-4 border-t border-slate-200 flex justify-end gap-3">
          <button type="button" id="cancel-edit-pay-btn" class="px-4 py-2 rounded-xl btn-decor-secondary font-semibold">
            ${isSw ? 'Ghairi' : 'Cancel'}
          </button>
          <button type="submit" class="px-5 py-2 rounded-xl btn-decor-primary font-bold">
            ${isSw ? 'Hifadhi Mabadiliko' : 'Save Changes'}
          </button>
        </div>
      </form>
    `;

    window.AppModal.showCustom(html, 'max-w-2xl');

    document.getElementById('close-edit-pay-modal').onclick = () => window.AppModal.close();
    document.getElementById('cancel-edit-pay-btn').onclick = () => window.AppModal.close();

    document.getElementById('edit-payment-form').onsubmit = async (e) => {
      e.preventDefault();
      const updates = {
        patientName: document.getElementById('edit-pay-name').value.trim(),
        category: document.getElementById('edit-pay-cat').value,
        description: document.getElementById('edit-pay-desc').value.trim(),
        totalAmount: Number(document.getElementById('edit-pay-total').value) || 0,
        amountPaid: Number(document.getElementById('edit-pay-paid').value) || 0,
        payerName: document.getElementById('edit-pay-payer').value.trim(),
        payerPhone: document.getElementById('edit-pay-phone').value.trim(),
        paymentMethod: document.getElementById('edit-pay-method').value,
        referenceNo: document.getElementById('edit-pay-ref').value.trim(),
        date: document.getElementById('edit-pay-date').value,
        dueDate: document.getElementById('edit-pay-due').value,
        notes: document.getElementById('edit-pay-notes').value.trim()
      };

      await window.AppStore.updatePayment(paymentId, updates);
      window.AppModal.close();
    };

    if (window.lucide) window.lucide.createIcons();
  }

  /**
   * Preview official printable SerenityCare receipt
   */
  openReceiptModal(paymentId) {
    if (window.AppDocs && typeof window.AppDocs.openPaymentReceipt === 'function') {
      window.AppDocs.openPaymentReceipt(paymentId);
    }
  }
}

window.PaymentsView = PaymentsView;
