/**
 * SerenityCare Main SPA Application Router & Bootstrap Controller
 * Production Ready with dedicated Login Panel screen and session gating.
 */

class AppRouter {
  constructor() {
    this.routes = {
      dashboard: new window.DashboardView(),
      patients: new window.PatientsView(),
      medications: new window.MedicationsView(),
      inventory: new window.InventoryView(),
      timetable: new window.TimetableView(),
      certificates: new window.CertificatesView(),
      'batch-upload': new window.BatchUploadView(),
      payments: new window.PaymentsView(),
      users: new window.UsersView(),
      settings: new window.SettingsView()
    };

    this.currentRoute = 'dashboard';
    this.mainContainer = null;
    this.init();
  }

  init() {
    this.mainContainer = document.getElementById('view-container');
    this.isSidebarCollapsed = localStorage.getItem('serenitycare_sidebar_collapsed') === 'true';

    // Subscribe to store updates for global instant reactivity!
    window.AppStore.subscribe('state:changed', (e, state) => {
      this.checkAuthAndRender();
    });

    window.AppStore.subscribe('sync:updated', () => {
      this.updateCloudSyncStatus();
    });

    window.AppStore.subscribe('sync:success', () => {
      this.updateCloudSyncStatus();
    });

    window.AppStore.subscribe('sync:error', () => {
      this.updateCloudSyncStatus();
    });

    // Trigger immediate Cloudflare Workers KV state sync (SOBBER_KV)
    if (window.AppStore) {
      window.AppStore.syncFromServer();
    }

    // Handle hash navigation
    window.addEventListener('hashchange', () => {
      if (window.Auth.isAuthenticated()) {
        const route = window.location.hash.replace('#', '') || 'dashboard';
        this.navigate(route, false);
      }
    });

    // Setup Login Panel events
    this.bindLoginPanel();

    // Setup Header Actions (Sidebar Toggle, Language Switcher)
    this.bindHeaderControls();

    // Apply initial sidebar state
    this.applySidebarState();

    // Check initial authentication and render appropriate view
    this.checkAuthAndRender();

    // Set initial favicon
    this.applyFavicon(window.AppStore.getState().facility.faviconUrl);
  }

  checkAuthAndRender() {
    const loginScreen = document.getElementById('login-screen');
    const appShell = document.getElementById('app-shell');
    const isAuth = window.Auth.isAuthenticated();

    if (isAuth) {
      if (loginScreen) loginScreen.classList.add('hidden');
      if (appShell) appShell.classList.remove('hidden');

      const state = window.AppStore.getState();
      const currentUser = state.currentUser;

      // Initialize individual user language preference
      if (currentUser && window.I18n) {
        window.I18n.initForUser(currentUser.id);
      }

      this.updateLanguageUI();
      const allowedRoutes = window.Auth.getAllowedRoutes();
      let route = window.location.hash.replace('#', '') || this.currentRoute || 'dashboard';

      // If user does not have permission for the current/default route, fall back to first allowed route
      if (!window.Auth.hasPermission(route)) {
        route = allowedRoutes.length > 0 ? allowedRoutes[0] : 'dashboard';
      }

      this.navigate(route, true);
    } else {
      if (loginScreen) loginScreen.classList.remove('hidden');
      if (appShell) appShell.classList.add('hidden');
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  bindHeaderControls() {
    // Desktop Sidebar Toggle
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    if (sidebarToggleBtn) {
      sidebarToggleBtn.onclick = () => this.toggleSidebar();
    }

    // Individual Language Picker Dropdown
    const langBtn = document.getElementById('lang-menu-btn');
    const langDropdown = document.getElementById('lang-dropdown-menu');
    const optEn = document.getElementById('lang-opt-en');
    const optSw = document.getElementById('lang-opt-sw');

    if (langBtn && langDropdown) {
      langBtn.onclick = (e) => {
        e.stopPropagation();
        langDropdown.classList.toggle('hidden');
      };

      document.addEventListener('click', () => {
        if (!langDropdown.classList.contains('hidden')) {
          langDropdown.classList.add('hidden');
        }
      });
    }

    if (optEn) {
      optEn.onclick = () => {
        this.switchLanguage('en');
        if (langDropdown) langDropdown.classList.add('hidden');
      };
    }

    if (optSw) {
      optSw.onclick = () => {
        this.switchLanguage('sw');
        if (langDropdown) langDropdown.classList.add('hidden');
      };
    }
  }

  toggleSidebar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
    localStorage.setItem('serenitycare_sidebar_collapsed', this.isSidebarCollapsed ? 'true' : 'false');
    this.applySidebarState();
  }

  applySidebarState() {
    const sidebar = document.getElementById('sidebar');
    const mainShell = document.getElementById('app-shell-main');
    const toggleIcon = document.getElementById('sidebar-toggle-icon');

    if (sidebar) {
      sidebar.classList.toggle('sidebar-collapsed', this.isSidebarCollapsed);
    }
    if (mainShell) {
      mainShell.classList.toggle('sidebar-collapsed', this.isSidebarCollapsed);
    }
    if (toggleIcon) {
      toggleIcon.setAttribute('data-lucide', this.isSidebarCollapsed ? 'panel-left-open' : 'panel-left-close');
    }
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  switchLanguage(lang) {
    const user = window.AppStore.getState().currentUser;
    if (!user || !window.I18n) return;

    window.I18n.setUserLang(user.id, lang);
    this.updateLanguageUI();
    this.updateHeaderAndNav(window.AppStore.getState());
    this.renderCurrentView();

    // Show temporary confirmation badge in UI
    const langName = lang === 'sw' ? 'Kiswahili' : 'English';
    if (window.AppModal && typeof window.AppModal.showAcceptanceCard === 'function') {
      window.AppModal.showAcceptanceCard({
        title: lang === 'sw' ? 'Lugha Imesasishwa' : 'Language Switched',
        subtitle: lang === 'sw' ? `Lugha imebadilishwa kuwa ${langName} kwa akaunti yako` : `Language changed to ${langName} for your account`,
        icon: 'check-circle-2',
        badgeText: lang === 'sw' ? 'MABADILIKO YAMEHIFADHIWA' : 'SAVED TO ACCOUNT',
        badgeColor: 'badge-medical-teal',
        confirmType: 'success',
        confirmText: lang === 'sw' ? 'Sawa' : 'Continue'
      });
    }
  }

  updateLanguageUI() {
    if (!window.I18n) return;
    const currentLang = window.I18n.getLang();
    const flagEl = document.getElementById('header-lang-flag');
    const labelEl = document.getElementById('header-lang-label');

    if (flagEl) flagEl.textContent = currentLang === 'sw' ? '🇹🇿' : '🇺🇸';
    if (labelEl) labelEl.textContent = currentLang === 'sw' ? 'Kiswahili' : 'English';

    // Auto-translate all [data-i18n] in shell
    window.I18n.translatePage(document.getElementById('app-shell'));
  }

  bindLoginPanel() {
    const loginForm = document.getElementById('login-form');
    const errorBox = document.getElementById('login-error-box');
    const errorText = document.getElementById('login-error-text');
    const autofillBtn = document.getElementById('autofill-admin-btn');
    const togglePwdBtn = document.getElementById('toggle-pwd-btn');
    const pwdInput = document.getElementById('login-password');
    const emailInput = document.getElementById('login-email');

    // Autofill Default Production Admin Credentials
    if (autofillBtn) {
      autofillBtn.onclick = () => {
        if (emailInput) emailInput.value = 'admin@serenitycare.org';
        if (pwdInput) pwdInput.value = 'Admin@Serenity2026!';
        if (errorBox) errorBox.classList.add('hidden');
      };
    }

    // Toggle Password Visibility
    if (togglePwdBtn && pwdInput) {
      togglePwdBtn.onclick = () => {
        const isPassword = pwdInput.type === 'password';
        pwdInput.type = isPassword ? 'text' : 'password';
        const iconEl = document.getElementById('toggle-pwd-icon');
        if (iconEl) {
          iconEl.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
          if (window.lucide) window.lucide.createIcons();
        }
      };
    }

    // Login Form Submit
    if (loginForm) {
      loginForm.onsubmit = (e) => {
        e.preventDefault();
        const email = emailInput ? emailInput.value.trim() : '';
        const password = pwdInput ? pwdInput.value : '';

        const res = window.Auth.login(email, password);
        if (res.success) {
          if (errorBox) errorBox.classList.add('hidden');
          if (pwdInput) pwdInput.value = '';
          this.checkAuthAndRender();
        } else {
          if (errorBox && errorText) {
            errorText.textContent = res.message || 'Invalid email or password.';
            errorBox.classList.remove('hidden');
          }
        }
      };
    }

    // Logout triggers
    const headerLogout = document.getElementById('header-logout-btn');
    if (headerLogout) {
      headerLogout.onclick = () => window.Auth.logout();
    }

    const sidebarLogout = document.getElementById('sidebar-logout-btn');
    if (sidebarLogout) {
      sidebarLogout.onclick = () => window.Auth.logout();
    }
  }

  navigate(routeKey, updateHash = true) {
    if (!window.Auth.isAuthenticated()) {
      this.checkAuthAndRender();
      return;
    }

    const allowedRoutes = window.Auth.getAllowedRoutes();

    if (!this.routes[routeKey]) {
      routeKey = allowedRoutes.length > 0 ? allowedRoutes[0] : 'dashboard';
    }

    // Permission Guard Check
    if (!window.Auth.hasPermission(routeKey)) {
      // If landing on 'dashboard' by default, redirect to first allowed route
      if (routeKey === 'dashboard' && allowedRoutes.length > 0 && !allowedRoutes.includes('dashboard')) {
        this.navigate(allowedRoutes[0], true);
        return;
      }
      this.renderAccessRestricted(routeKey);
      return;
    }

    this.currentRoute = routeKey;
    if (updateHash) {
      window.location.hash = routeKey;
    }

    // Update active nav styling
    document.querySelectorAll('.nav-link').forEach(link => {
      const linkRoute = link.getAttribute('data-route');
      if (linkRoute === routeKey) {
        link.classList.add('bg-teal-700', 'text-white', 'shadow-sm');
        link.classList.remove('text-teal-100', 'hover:bg-slate-800');
      } else {
        link.classList.remove('bg-teal-700', 'text-white', 'shadow-sm');
        link.classList.add('text-teal-100', 'hover:bg-slate-800');
      }
    });

    this.renderCurrentView();
  }

  renderAccessRestricted(routeKey) {
    if (!this.mainContainer) return;
    const title = window.I18n ? window.I18n.t('access_denied', 'Access Restricted') : 'Access Restricted';
    const msg = window.I18n ? window.I18n.t('access_denied_msg', 'You do not have permission to access this module. Please contact the administrator.') : 'You do not have permission to access this module. Please contact the administrator.';

    const allowedRoutes = window.Auth.getAllowedRoutes();
    const fallbackRoute = allowedRoutes.length > 0 ? allowedRoutes[0] : null;
    const routeLabels = {
      dashboard: 'Dashboard & Metrics',
      patients: 'Resident Registry',
      medications: 'Medications (MAR)',
      timetable: 'House Timetable',
      inventory: 'Pharmacy & Store',
      certificates: 'Graduation & Release',
      'batch-upload': 'Batch CSV Import',
      payments: 'Billing & Payments',
      users: 'Staff & RBAC',
      settings: 'Facility & Cloudflare'
    };
    const fallbackLabel = fallbackRoute ? (routeLabels[fallbackRoute] || fallbackRoute) : '';

    this.mainContainer.innerHTML = `
      <div class="medical-card p-10 max-w-lg mx-auto text-center space-y-4 my-12 animate-modal-pop">
        <div class="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
          <i data-lucide="shield-alert" class="w-8 h-8"></i>
        </div>
        <div>
          <h3 class="text-xl font-black text-slate-900">${title}</h3>
          <p class="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">${msg}</p>
        </div>
        <div class="pt-4 border-t border-slate-100 flex justify-center">
          ${fallbackRoute ? `
            <button onclick="window.AppRouter.navigate('${fallbackRoute}')" class="px-5 py-2.5 rounded-xl btn-decor-primary text-xs font-bold flex items-center gap-2">
              <i data-lucide="arrow-left" class="w-4 h-4"></i>
              <span>Return to ${fallbackLabel}</span>
            </button>
          ` : `
            <button onclick="window.Auth.logout()" class="px-5 py-2.5 rounded-xl btn-decor-secondary text-xs font-bold flex items-center gap-2 text-rose-700">
              <i data-lucide="log-out" class="w-4 h-4"></i>
              <span>Sign Out Workstation</span>
            </button>
          `}
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  }

  renderCurrentView() {
    if (!this.mainContainer) return;
    const view = this.routes[this.currentRoute];
    if (view && typeof view.render === 'function') {
      view.render(this.mainContainer);
    }
  }

  updateHeaderAndNav(state) {
    if (!state.currentUser) return;

    // Update logo
    const logoImg = document.getElementById('top-bar-logo');
    if (logoImg && state.facility.logoUrl) {
      logoImg.src = state.facility.logoUrl;
    }

    // Update current user widget
    const user = state.currentUser;
    const userNameEl = document.getElementById('header-user-name');
    const userRoleEl = document.getElementById('header-user-role');
    const userAvatarEl = document.getElementById('header-user-avatar');

    if (userNameEl) userNameEl.textContent = user.name;
    if (userRoleEl) {
      const perms = window.Auth.getRolePermissions(user.role);
      userRoleEl.textContent = user.role.toUpperCase();
      userRoleEl.className = `text-[9px] font-bold px-1.5 py-0.2 rounded-full ${perms.badgeClass}`;
    }
    if (userAvatarEl) {
      userAvatarEl.textContent = user.name.split(' ').map(n => n[0]).join('').substring(0, 2);
    }

    // Update pending medication reminder badge
    const canMeds = window.Auth.hasPermission('medications');
    const pendingMeds = state.medicationLogs.filter(l => l.status === 'Pending').length;
    if (window.AppReminders && canMeds) {
      window.AppReminders.updateNotificationBadge(pendingMeds);
    }

    // Header Reminders & Dose Check button visibility based on 'medications' permission
    const bellContainer = document.getElementById('header-reminder-bell-container');
    if (bellContainer) {
      if (canMeds) {
        bellContainer.classList.remove('hidden');
        bellContainer.style.display = '';
      } else {
        bellContainer.classList.add('hidden');
        bellContainer.style.display = 'none';
      }
    }

    const doseBtn = document.getElementById('header-dose-check-btn');
    if (doseBtn) {
      if (canMeds) {
        doseBtn.classList.remove('hidden');
        doseBtn.style.display = '';
      } else {
        doseBtn.classList.add('hidden');
        doseBtn.style.display = 'none';
      }
    }

    // Strictly enforce: users ONLY see and have access to permitted modules in sidebar navigation
    document.querySelectorAll('.nav-link').forEach(link => {
      const linkRoute = link.getAttribute('data-route');
      const allowed = window.Auth.hasPermission(linkRoute);
      if (!allowed) {
        link.classList.add('hidden');
        link.style.display = 'none';
      } else {
        link.classList.remove('hidden');
        link.style.display = '';
      }
    });

    // Hide section headers if all children modules in that section are hidden
    const sectionMap = {
      clinical_ops: ['dashboard', 'patients', 'medications', 'timetable'],
      logistics: ['inventory', 'certificates', 'batch-upload', 'payments'],
      admin: ['users', 'settings']
    };

    document.querySelectorAll('.nav-section-title').forEach(header => {
      const sectionKey = header.getAttribute('data-section');
      const routes = sectionMap[sectionKey] || [];
      const hasAllowedChild = routes.some(r => window.Auth.hasPermission(r));
      if (hasAllowedChild) {
        header.classList.remove('hidden');
        header.style.display = '';
      } else {
        header.classList.add('hidden');
        header.style.display = 'none';
      }
    });

    // Update language strings across navigation
    if (window.I18n) {
      window.I18n.translatePage(document.getElementById('app-shell'));
    }

    // Update Cloudflare KV real-time connection status
    this.updateCloudSyncStatus();
  }

  updateCloudSyncStatus() {
    const isConnected = window.AppStore.isCloudConnected;
    const isSyncing = window.AppStore.isSyncing;
    const lastSync = window.AppStore.lastSyncedAt;
    const cloudError = window.AppStore.cloudError;

    // 1. Sidebar status
    const pulse = document.getElementById('cloud-sync-pulse');
    const label = document.getElementById('cloud-sync-label');
    if (pulse && label) {
      if (isConnected) {
        pulse.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
        label.textContent = 'Cloudflare KV Synced';
        label.title = `Globally connected. Last sync: ${lastSync || 'Active'}`;
      } else if (isSyncing) {
        pulse.className = 'w-2 h-2 rounded-full bg-amber-400 animate-ping';
        label.textContent = 'Syncing KV...';
      } else {
        pulse.className = 'w-2 h-2 rounded-full bg-rose-500';
        label.textContent = 'Local Mode (Offline)';
        label.title = cloudError || 'Changes stored locally only';
      }
    }

    // 2. Top Header status
    const topPulse = document.getElementById('top-sync-pulse');
    const topLabel = document.getElementById('top-sync-label');
    if (topPulse && topLabel) {
      if (isConnected) {
        topPulse.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
        topLabel.textContent = 'KV Synced';
        topLabel.className = 'text-[11px] font-bold text-emerald-700 hidden sm:inline';
      } else if (isSyncing) {
        topPulse.className = 'w-2 h-2 rounded-full bg-amber-400 animate-ping';
        topLabel.textContent = 'Syncing...';
        topLabel.className = 'text-[11px] font-bold text-amber-700 hidden sm:inline';
      } else {
        topPulse.className = 'w-2 h-2 rounded-full bg-rose-500';
        topLabel.textContent = 'Local Only';
        topLabel.className = 'text-[11px] font-bold text-rose-600 hidden sm:inline';
      }
    }

    // 3. Login screen sync indicator
    const loginPulse = document.getElementById('login-sync-pulse');
    const loginLabel = document.getElementById('login-sync-label');
    if (loginPulse && loginLabel) {
      if (isConnected) {
        loginPulse.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
        loginLabel.textContent = 'Cloud Sync Active';
      } else if (isSyncing) {
        loginPulse.className = 'w-2 h-2 rounded-full bg-amber-400 animate-ping';
        loginLabel.textContent = 'Checking Cloud...';
      } else {
        loginPulse.className = 'w-2 h-2 rounded-full bg-rose-500';
        loginLabel.textContent = 'Local Storage Mode';
      }
    }

    // 4. Warning banner
    const banner = document.getElementById('cloud-sync-warning-banner');
    if (banner) {
      if (!isConnected && !isSyncing) {
        banner.classList.remove('hidden');
      } else {
        banner.classList.add('hidden');
      }
    }
  }

  applyFavicon(url) {
    if (!url) return;
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = url;
  }
}

// Render data in UI
function renderApp(data) {
  if (data && typeof data === 'object') {
    if (window.AppStore) {
      if (Array.isArray(data.users) || Array.isArray(data.patients) || data.facility) {
        window.AppStore.applyRemoteState(data, true);
      }
    }
  }
  if (window.AppRouter && typeof window.AppRouter.checkAuthAndRender === 'function') {
    window.AppRouter.checkAuthAndRender();
  }
}
window.renderApp = renderApp;

// Global content loader
async function loadContent() {
  if (window.AppStore && typeof window.AppStore.loadContent === 'function') {
    return await window.AppStore.loadContent();
  }
  try {
    let customEndpoint = '';
    try {
      customEndpoint = localStorage.getItem('sobber_cloud_endpoint') || '';
    } catch (e) {}
    let base = (customEndpoint && customEndpoint.trim().startsWith('http')) 
      ? customEndpoint.trim().replace(/\/+$/, '') 
      : '';
    const sep = base.includes('?') ? '&' : '?';
    const response = await fetch(`${base}/api/content${sep}_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    if (response.ok) {
      const data = await response.json();
      renderApp(data);
      return data;
    }
  } catch (err) {
    console.debug('loadContent fallback:', err);
  }
}
window.loadContent = loadContent;

// Bootstrap once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.AppRouter = new AppRouter();

  // Call on app startup
  loadContent();

  // Bind Sidebar Nav Links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const route = link.getAttribute('data-route');
      window.AppRouter.navigate(route);
    });
  });

  // User Profile Switch Click
  const userProfileBtn = document.getElementById('header-user-profile-btn');
  if (userProfileBtn) {
    userProfileBtn.onclick = () => {
      window.AppModal.showLoginModal();
    };
  }

  // Bell Reminder Click
  const reminderBellBtn = document.getElementById('reminder-bell-btn');
  if (reminderBellBtn) {
    reminderBellBtn.onclick = () => {
      window.AppReminders.showRemindersListModal();
    };
  }

  // Cloud Sync Diagnostics Button in Header
  const headerCloudBtn = document.getElementById('header-cloud-sync-btn');
  if (headerCloudBtn) {
    headerCloudBtn.onclick = () => {
      if (window.AppModal && window.AppModal.showCloudDiagnosticModal) {
        window.AppModal.showCloudDiagnosticModal();
      }
    };
  }

  // Cloud Sync Status Container in Sidebar
  const sidebarCloudBtn = document.getElementById('cloud-sync-status-container');
  if (sidebarCloudBtn) {
    sidebarCloudBtn.style.cursor = 'pointer';
    sidebarCloudBtn.onclick = () => {
      if (window.AppModal && window.AppModal.showCloudDiagnosticModal) {
        window.AppModal.showCloudDiagnosticModal();
      }
    };
  }

  // Force Cloud Sync Button in Header
  const forceSyncBtn = document.getElementById('header-force-sync-btn');
  if (forceSyncBtn) {
    forceSyncBtn.onclick = async () => {
      const icon = document.getElementById('header-sync-icon');
      if (icon) icon.classList.add('animate-spin');
      await window.AppStore.syncFromServer();
      setTimeout(() => {
        if (icon) icon.classList.remove('animate-spin');
      }, 500);
    };
  }

  // Warning Banner Resolve Button
  const bannerResolveBtn = document.getElementById('cloud-sync-resolve-btn');
  if (bannerResolveBtn) {
    bannerResolveBtn.onclick = () => {
      if (window.AppModal && window.AppModal.showCloudDiagnosticModal) {
        window.AppModal.showCloudDiagnosticModal();
      }
    };
  }

  // Login Screen Sync Button
  const loginSyncBtn = document.getElementById('login-sync-now-btn');
  if (loginSyncBtn) {
    loginSyncBtn.onclick = async () => {
      await window.AppStore.syncFromServer();
    };
  }

  // Mobile menu toggle
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('sidebar');
  if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.onclick = () => {
      sidebar.classList.toggle('-translate-x-full');
    };
  }
});
