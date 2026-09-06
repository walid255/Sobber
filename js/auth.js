/**
 * SerenityCare Authentication & Role-Based Access Control (RBAC)
 * Production Ready with secure session handling and dedicated login interface.
 */

const ROLE_PERMISSIONS = {
  admin: {
    title: 'Super Administrator / Director',
    badgeClass: 'badge-medical-rose',
    canManageUsers: true,
    canEditFacilitySettings: true,
    canViewAllPatients: true,
    canEditPatientBio: true,
    canPrescribe: true,
    canAdministerMeds: true,
    canWriteClinicalNotes: true,
    canWriteCounselingNotes: true,
    canQualifyGraduation: true,
    canManageInventory: true,
    canManageTimetable: true,
    canBatchImport: true,
    canViewAudits: true,
    canManagePayments: true
  },
  doctor: {
    title: 'Addiction Psychiatrist / MD',
    badgeClass: 'badge-medical-teal',
    canManageUsers: false,
    canEditFacilitySettings: false,
    canViewAllPatients: true,
    canEditPatientBio: true,
    canPrescribe: true,
    canAdministerMeds: true,
    canWriteClinicalNotes: true,
    canWriteCounselingNotes: true,
    canQualifyGraduation: true,
    canManageInventory: false,
    canManageTimetable: true,
    canBatchImport: true,
    canViewAudits: false
  },
  nurse: {
    title: 'Clinical Nurse / Medical Staff',
    badgeClass: 'badge-medical-cyan',
    canManageUsers: false,
    canEditFacilitySettings: false,
    canViewAllPatients: true,
    canEditPatientBio: false,
    canPrescribe: false,
    canAdministerMeds: true,
    canWriteClinicalNotes: true,
    canWriteCounselingNotes: false,
    canQualifyGraduation: false,
    canManageInventory: true,
    canManageTimetable: false,
    canBatchImport: false,
    canViewAudits: false
  },
  counselor: {
    title: 'Licensed Addiction Counselor (LCDC)',
    badgeClass: 'badge-medical-emerald',
    canManageUsers: false,
    canEditFacilitySettings: false,
    canViewAllPatients: true,
    canEditPatientBio: false,
    canPrescribe: false,
    canAdministerMeds: false,
    canWriteClinicalNotes: false,
    canWriteCounselingNotes: true,
    canQualifyGraduation: true,
    canManageInventory: false,
    canManageTimetable: true,
    canBatchImport: false,
    canViewAudits: false
  }
};

class AuthService {
  constructor() {
    this.store = window.AppStore;
  }

  isAuthenticated() {
    const user = this.getCurrentUser();
    return Boolean(user && user.id);
  }

  getCurrentUser() {
    return this.store.getState().currentUser;
  }

  getCurrentRole() {
    const user = this.getCurrentUser();
    return user ? user.role : 'guest';
  }

  getRolePermissions(role = null) {
    const targetRole = role || this.getCurrentRole();
    return ROLE_PERMISSIONS[targetRole] || {
      title: 'Guest',
      badgeClass: 'badge-medical-slate'
    };
  }

  hasPermission(permissionKey) {
    const user = this.getCurrentUser();
    if (!user) return false;

    // Normalize hyphen to underscore (e.g. 'batch-upload' to 'batch_upload')
    const key = permissionKey.replace(/-/g, '_');

    // If user has specific permissions assigned, strictly enforce them:
    // User ONLY has access to what is explicitly true, and nothing else!
    if (user.permissions) {
      return Boolean(user.permissions[key]);
    }

    if (user.role === 'admin') return true;

    const perms = this.getRolePermissions(user.role);
    return Boolean(perms[key] || perms[permissionKey]);
  }

  getAllowedRoutes() {
    const allRoutes = ['dashboard', 'patients', 'medications', 'timetable', 'inventory', 'certificates', 'batch-upload', 'payments', 'users', 'settings'];
    return allRoutes.filter(r => this.hasPermission(r));
  }

  switchUser(userId) {
    this.store.setCurrentUser(userId);
  }

  login(email, password) {
    return this.store.loginUser(email, password);
  }

  logout() {
    if (window.AppModal) {
      window.AppModal.showAcceptanceCard({
        title: 'Sign Out of Clinical Portal?',
        subtitle: 'Secure session termination',
        icon: 'log-out',
        badgeText: 'SECURITY PROTOCOL',
        badgeColor: 'badge-medical-rose',
        confirmType: 'danger',
        contentHtml: '<p class="text-slate-600 text-xs leading-relaxed">Are you sure you want to end your active workstation session? All pending form inputs should be saved first.</p>',
        confirmText: 'Confirm Sign Out',
        cancelText: 'Stay Signed In',
        onConfirm: () => {
          this.store.logout();
          window.AppModal.close();
          if (window.AppRouter) {
            window.AppRouter.checkAuthAndRender();
          }
        }
      });
    } else {
      this.store.logout();
      if (window.AppRouter) {
        window.AppRouter.checkAuthAndRender();
      }
    }
  }
}

window.Auth = new AuthService();
