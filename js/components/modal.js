/**
 * SerenityCare Centered Modal & Acceptance Card System
 * Renders centered pop-up dialogs with backdrop blur, decorated buttons, and spring animation.
 */

class ModalSystem {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    if (!document.getElementById('modal-root')) {
      const modalRoot = document.createElement('div');
      modalRoot.id = 'modal-root';
      modalRoot.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay hidden';
      modalRoot.innerHTML = `
        <div id="modal-card-box" class="relative w-full max-w-lg modal-acceptance-card animate-modal-pop p-6 max-h-[90vh] overflow-y-auto">
          <!-- Content dynamically injected here -->
        </div>
      `;
      document.body.appendChild(modalRoot);
      this.container = modalRoot;

      // Close on backdrop click (outside card)
      this.container.addEventListener('click', (e) => {
        if (e.target === this.container) {
          this.close();
        }
      });

      // Close on Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !this.container.classList.contains('hidden')) {
          this.close();
        }
      });
    } else {
      this.container = document.getElementById('modal-root');
    }
  }

  close() {
    if (this.container) {
      this.container.classList.add('hidden');
      const box = document.getElementById('modal-card-box');
      if (box) {
        box.innerHTML = '';
        box.className = 'relative w-full max-w-lg modal-acceptance-card animate-modal-pop p-6 max-h-[90vh] overflow-y-auto';
      }
    }
  }

  showCustom(contentHtml, maxWidthClass = 'max-w-xl') {
    this.init();
    const box = document.getElementById('modal-card-box');
    box.className = `relative w-full ${maxWidthClass} modal-acceptance-card animate-modal-pop p-6 max-h-[92vh] overflow-y-auto`;
    box.innerHTML = contentHtml;
    this.container.classList.remove('hidden');

    // Re-bind Lucide icons if available
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  /**
   * Shows a beautifully decorated centered acceptance card with custom buttons
   */
  showAcceptanceCard({
    title = 'Confirm Action',
    subtitle = 'Please review and confirm to proceed.',
    icon = 'check-circle',
    badgeText = 'Medical Authorization Required',
    badgeColor = 'badge-medical-teal',
    contentHtml = '',
    confirmText = 'Accept & Proceed',
    cancelText = 'Cancel',
    confirmType = 'primary', // 'primary', 'success', 'danger'
    onConfirm = () => {},
    onCancel = () => {}
  }) {
    this.init();
    const box = document.getElementById('modal-card-box');
    box.className = 'relative w-full max-w-lg modal-acceptance-card animate-modal-pop p-7 max-h-[90vh] overflow-y-auto';

    let confirmBtnClass = 'btn-decor-primary';
    let iconBgClass = 'bg-teal-50 text-teal-600 border border-teal-200';
    if (confirmType === 'success') {
      confirmBtnClass = 'btn-decor-success';
      iconBgClass = 'bg-emerald-50 text-emerald-600 border border-emerald-200';
    } else if (confirmType === 'danger') {
      confirmBtnClass = 'btn-decor-danger';
      iconBgClass = 'bg-rose-50 text-rose-600 border border-rose-200';
    }

    box.innerHTML = `
      <!-- Top Decorative Accent Bar -->
      <div class="absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl ${confirmType === 'danger' ? 'bg-rose-500' : 'bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500'}"></div>

      <!-- Header with Icon & Badge -->
      <div class="flex items-start gap-4 mb-5 pt-2">
        <div class="w-14 h-14 rounded-2xl ${iconBgClass} flex items-center justify-center shrink-0 shadow-sm">
          <i data-lucide="${icon}" class="w-7 h-7"></i>
        </div>
        <div class="flex-1">
          <span class="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${badgeColor} mb-1.5">
            ${badgeText}
          </span>
          <h3 class="text-xl font-bold text-slate-900 tracking-tight leading-snug">${title}</h3>
          <p class="text-sm text-slate-500 mt-0.5">${subtitle}</p>
        </div>
        <button id="modal-x-close" class="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <!-- Main Body Content -->
      <div class="py-2 text-slate-700 text-sm">
        ${contentHtml}
      </div>

      <!-- Decorated Footer Actions -->
      <div class="mt-7 pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
        <button id="modal-btn-cancel" class="px-5 py-2.5 rounded-xl text-sm font-semibold btn-decor-secondary">
          ${cancelText}
        </button>
        <button id="modal-btn-confirm" class="px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 ${confirmBtnClass}">
          <span>${confirmText}</span>
          <i data-lucide="arrow-right" class="w-4 h-4"></i>
        </button>
      </div>
    `;

    this.container.classList.remove('hidden');

    if (window.lucide) {
      window.lucide.createIcons();
    }

    // Attach button events
    document.getElementById('modal-x-close').onclick = () => {
      this.close();
      onCancel();
    };
    document.getElementById('modal-btn-cancel').onclick = () => {
      this.close();
      onCancel();
    };
    document.getElementById('modal-btn-confirm').onclick = () => {
      this.close();
      onConfirm();
    };
  }

  /**
   * Quick confirmation helper returning a Promise
   */
  confirm(title, message, confirmText = 'Confirm', confirmType = 'primary') {
    return new Promise((resolve) => {
      this.showAcceptanceCard({
        title,
        subtitle: 'Authorization verification',
        icon: confirmType === 'danger' ? 'alert-triangle' : 'shield-check',
        badgeText: 'Action Confirmation',
        badgeColor: confirmType === 'danger' ? 'badge-medical-rose' : 'badge-medical-teal',
        contentHtml: `<p class="leading-relaxed">${message}</p>`,
        confirmText,
        confirmType,
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false)
      });
    });
  }

  /**
   * Quick alert modal
   */
  alert(title, message, type = 'info') {
    const iconMap = {
      info: 'info',
      success: 'check-circle-2',
      danger: 'alert-octagon',
      warning: 'alert-triangle'
    };
    this.showAcceptanceCard({
      title,
      subtitle: '',
      icon: iconMap[type] || 'info',
      badgeText: type.toUpperCase(),
      badgeColor: type === 'danger' ? 'badge-medical-rose' : type === 'success' ? 'badge-medical-emerald' : 'badge-medical-teal',
      contentHtml: `<p class="text-slate-600">${message}</p>`,
      confirmText: 'Acknowledged',
      cancelText: 'Close',
      confirmType: type === 'danger' ? 'danger' : 'primary',
      onConfirm: () => {},
      onCancel: () => {}
    });
  }

  /**
   * Centered Quick Login & Role Switcher acceptance card
   */
  showLoginModal() {
    const state = window.AppStore.getState();
    const current = state.currentUser;

    const roleCards = state.users.map(u => {
      const isSelected = u.id === current.id;
      const rolePerm = window.Auth.getRolePermissions(u.role);
      return `
        <div class="user-select-card cursor-pointer p-3.5 rounded-xl border ${isSelected ? 'border-teal-500 bg-teal-50/50 shadow-sm' : 'border-slate-200 hover:border-teal-300 hover:bg-slate-50'} transition-all flex items-center justify-between"
             data-user-id="${u.id}">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center font-bold text-slate-700 text-sm shrink-0">
              ${u.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
            </div>
            <div>
              <div class="font-bold text-sm text-slate-900">${u.name}</div>
              <div class="text-xs text-slate-500">${u.department}</div>
            </div>
          </div>
          <div class="text-right">
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full ${rolePerm.badgeClass}">${u.role.toUpperCase()}</span>
            ${isSelected ? '<span class="block text-[10px] text-teal-600 font-bold mt-1">● Active</span>' : ''}
          </div>
        </div>
      `;
    }).join('');

    const html = `
      <div class="text-center mb-5">
        <div class="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 border border-teal-200 mx-auto flex items-center justify-center mb-3">
          <i data-lucide="key-round" class="w-6 h-6"></i>
        </div>
        <h3 class="text-xl font-bold text-slate-900">Staff Authentication &amp; Role Switch</h3>
        <p class="text-xs text-slate-500 mt-1">Select an authenticated staff profile to switch role privileges</p>
      </div>

      <div class="space-y-2.5 max-h-72 overflow-y-auto pr-1">
        ${roleCards}
      </div>

      <div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
        <span class="text-xs text-slate-400">SerenityCare Secure RBAC v1.0</span>
        <button id="close-login-btn" class="px-5 py-2 rounded-xl text-sm font-semibold btn-decor-secondary">
          Close
        </button>
      </div>
    `;

    this.showCustom(html, 'max-w-md');

    document.querySelectorAll('.user-select-card').forEach(card => {
      card.addEventListener('click', () => {
        const uid = card.getAttribute('data-user-id');
        window.Auth.switchUser(uid);
        this.close();
      });
    });

  async showCloudDiagnosticModal() {
    this.init();
    const loadingHtml = `
      <div class="text-center p-6 space-y-4">
        <div class="w-12 h-12 rounded-full border-4 border-teal-500 border-t-transparent animate-spin mx-auto"></div>
        <p class="text-xs font-bold text-slate-700">Testing Cloudflare Workers KV &amp; Cloud Connection...</p>
      </div>
    `;
    this.showCustom(loadingHtml, 'max-w-lg');

    const conn = await window.AppStore.checkConnectivity();
    const isConnected = window.AppStore.isCloudConnected;
    const lastSync = window.AppStore.lastSyncedAt ? new Date(window.AppStore.lastSyncedAt).toLocaleTimeString() : 'Never';
    const state = window.AppStore.getState();
    const currentEndpoint = localStorage.getItem('sobber_cloud_endpoint') || '';
    const currentSecret = localStorage.getItem('sobber_admin_secret') || '';

    const html = `
      <div class="space-y-4 text-xs">
        <div class="flex items-center justify-between pb-3 border-b border-slate-200">
          <div class="flex items-center gap-2">
            <div class="w-9 h-9 rounded-xl ${isConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} flex items-center justify-center font-bold">
              <i data-lucide="${isConnected ? 'cloud-check' : 'cloud-off'}" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900">Multi-Device Cloud Sync Diagnostics</h3>
              <p class="text-[11px] text-slate-500">Real-time replication status across PC, mobile, and staff devices</p>
            </div>
          </div>
          <button id="close-diag-modal-btn" class="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- Status Card -->
        <div class="p-4 rounded-xl border ${isConnected ? 'border-emerald-200 bg-emerald-50/40 text-emerald-900' : 'border-rose-200 bg-rose-50/40 text-rose-900'} space-y-2">
          <div class="flex items-center justify-between">
            <span class="font-bold flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}"></span>
              ${isConnected ? 'Cloudflare Workers KV Active (Global Live Sync)' : 'Local Storage Only (Not Synced to Phone)'}
            </span>
            <span class="text-[10px] font-mono font-bold">${conn.latency}ms latency</span>
          </div>
          <p class="text-[11px] leading-relaxed">
            ${isConnected 
              ? 'Any record added on your PC (residents, staff, MAR doses, inventory) immediately syncs to your phone and all connected devices.' 
              : 'Changes are currently saving on this browser only. Your phone cannot see updates until Cloudflare KV is bound or a cloud endpoint is connected.'}
          </p>
        </div>

        <!-- Metrics Grid -->
        <div class="grid grid-cols-3 gap-2 text-center text-[11px]">
          <div class="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
            <span class="text-slate-400 block text-[9px] uppercase font-bold">Residents</span>
            <strong class="text-slate-800 text-sm">${state.patients ? state.patients.length : 0}</strong>
          </div>
          <div class="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
            <span class="text-slate-400 block text-[9px] uppercase font-bold">Staff Accounts</span>
            <strong class="text-slate-800 text-sm">${state.users ? state.users.length : 0}</strong>
          </div>
          <div class="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
            <span class="text-slate-400 block text-[9px] uppercase font-bold">Last Synced</span>
            <strong class="text-slate-800 font-mono text-[10px]">${lastSync}</strong>
          </div>
        </div>

        ${!isConnected ? `
          <!-- Cloudflare KV 30-Second Setup Guide -->
          <div class="p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 space-y-2 text-[11px]">
            <div class="font-bold flex items-center gap-1.5 text-amber-800">
              <i data-lucide="help-circle" class="w-4 h-4 text-amber-600"></i>
              How to enable Global Cloud Sync in 30 seconds:
            </div>
            <ol class="list-decimal list-inside space-y-1 text-slate-700 text-[11px]">
              <li>Log in to <a href="https://dash.cloudflare.com" target="_blank" class="underline text-teal-700 font-bold">dash.cloudflare.com</a> and open your Pages project.</li>
              <li>Go to <strong>Settings</strong> &rarr; <strong>Functions</strong> &rarr; <strong>KV namespace bindings</strong>.</li>
              <li>Click <strong>Add binding</strong>: set Variable name to <code class="bg-amber-100 text-amber-900 px-1 py-0.5 rounded font-mono font-bold">SOBBER_KV</code> and select your KV namespace.</li>
              <li>Redeploy or refresh, and both PC and Phone will sync in real time!</li>
            </ol>
          </div>
        ` : ''}

        <!-- Custom Cloud Endpoint & Admin Secret (Optional for Custom Workers / Authorization) -->
        <div class="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
          <div>
            <label class="block font-bold text-slate-700 text-[11px] mb-1">
              Custom Remote Cloud Endpoint (Optional)
            </label>
            <input type="url" id="custom-cloud-endpoint-input" placeholder="https://your-worker-subdomain.workers.dev" value="${currentEndpoint}" class="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono">
            <span class="text-[10px] text-slate-400 block mt-0.5">Leave blank to use current origin / Cloudflare Pages default.</span>
          </div>

          <div>
            <label class="block font-bold text-slate-700 text-[11px] mb-1">
              Admin Secret / Bearer Token (Optional Authorization)
            </label>
            <div class="flex gap-2">
              <input type="password" id="custom-admin-secret-input" placeholder="e.g. YOUR_ADMIN_SECRET" value="${currentSecret}" class="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono">
              <button type="button" id="save-endpoint-btn" class="px-3 py-1.5 rounded-lg btn-decor-primary font-bold text-xs">Save</button>
            </div>
            <span class="text-[10px] text-slate-400 block mt-0.5">Sent as <code class="font-mono bg-slate-200 px-1 py-0.5 rounded text-slate-700">Authorization: Bearer &lt;SECRET&gt;</code> on write operations.</span>
          </div>
        </div>

        <div class="flex items-center justify-between pt-3 border-t border-slate-200">
          <button type="button" id="force-cloud-sync-btn" class="px-4 py-2 rounded-xl btn-decor-primary font-bold text-xs flex items-center gap-1.5">
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
            <span>Test &amp; Sync Now</span>
          </button>
          <button type="button" id="close-diag-btn" class="px-4 py-2 rounded-xl btn-decor-secondary font-semibold text-xs">
            Close
          </button>
        </div>
      </div>
    `;

    this.showCustom(html, 'max-w-lg');

    document.getElementById('close-diag-modal-btn').onclick = () => this.close();
    document.getElementById('close-diag-btn').onclick = () => this.close();

    document.getElementById('save-endpoint-btn').onclick = () => {
      const endpointVal = document.getElementById('custom-cloud-endpoint-input').value.trim();
      const secretVal = document.getElementById('custom-admin-secret-input').value.trim();
      if (endpointVal) {
        localStorage.setItem('sobber_cloud_endpoint', endpointVal);
      } else {
        localStorage.removeItem('sobber_cloud_endpoint');
      }

      if (secretVal) {
        localStorage.setItem('sobber_admin_secret', secretVal);
      } else {
        localStorage.removeItem('sobber_admin_secret');
      }
      window.AppStore.syncFromServer();
      this.close();
    };

    document.getElementById('force-cloud-sync-btn').onclick = async () => {
      await window.AppStore.syncFromServer();
      await window.AppStore.pushToServer();
      this.showCloudDiagnosticModal();
    };

    if (window.lucide) window.lucide.createIcons();
  }
}

window.AppModal = new ModalSystem();
