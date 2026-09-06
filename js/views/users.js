/**
 * SerenityCare User Management View (Admin Only)
 * Manages staff profiles, role privileges (Admin, Doctor, Nurse, Counselor), and user access controls.
 */

class UsersView {
  render(container) {
    const state = window.AppStore.getState();
    const currentUser = state.currentUser;
    const isAdmin = currentUser.role === 'admin';
    const users = state.users;

    container.innerHTML = `
      <div class="space-y-6">
        
        <!-- Header -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-2xl font-black text-slate-900 tracking-tight">Staff &amp; User Management</h2>
              <span class="badge-medical-rose text-xs px-2.5 py-0.5 rounded-full font-bold">Admin Controlled</span>
            </div>
            <p class="text-xs text-slate-500 mt-0.5">Manage clinical staff accounts, assign operational roles, and enforce security policies</p>
          </div>

          <div class="flex items-center gap-3">
            <button id="add-user-btn" class="px-4 py-2.5 rounded-xl text-xs font-bold btn-decor-primary flex items-center gap-2 ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}">
              <i data-lucide="user-plus" class="w-4 h-4"></i>
              <span>Add Staff Member</span>
            </button>
          </div>
        </div>

        ${!isAdmin ? `
          <div class="medical-card p-4 bg-amber-50 border-amber-200 flex items-center gap-3 text-xs text-amber-800">
            <i data-lucide="shield-alert" class="w-5 h-5 text-amber-600 shrink-0"></i>
            <div>
              <strong>Restricted Access Mode:</strong> You are currently logged in as <strong>${currentUser.name} (${currentUser.role})</strong>.
              Only users with the <strong>Admin</strong> role can modify user privileges or add new staff. 
              <button onclick="window.Auth.logout()" class="font-bold underline text-amber-900 ml-1">Switch to Admin Profile</button>
            </div>
          </div>
        ` : ''}

        <!-- Staff Users Table -->
        <div class="medical-card overflow-hidden">
          <div class="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 class="text-sm font-bold text-slate-900">Registered Clinical Staff Directory</h3>
            <span class="text-xs text-slate-400 font-semibold">${users.length} Active Accounts</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="border-b border-slate-200 bg-slate-50 text-[11px] text-slate-500 font-semibold uppercase">
                  <th class="py-3 px-4">Staff Member</th>
                  <th class="py-3 px-4">Assigned Role</th>
                  <th class="py-3 px-4">Department</th>
                  <th class="py-3 px-4">Contact Phone</th>
                  <th class="py-3 px-4">Status</th>
                  <th class="py-3 px-4">Last Active</th>
                  <th class="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${users.map(u => {
                  const perms = window.Auth.getRolePermissions(u.role);
                  const isCurrent = u.id === currentUser.id;
                  return `
                    <tr class="hover:bg-slate-50/70 transition">
                      <td class="py-3 px-4">
                        <div class="flex items-center gap-3">
                          <div class="w-9 h-9 rounded-xl bg-teal-50 text-teal-800 font-bold flex items-center justify-center text-xs shrink-0">
                            ${u.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                          </div>
                          <div>
                            <strong class="text-slate-900 block">${u.name} ${isCurrent ? '<span class="text-[10px] text-teal-600 font-bold">(You)</span>' : ''}</strong>
                            <span class="text-[11px] text-slate-400 font-mono">${u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td class="py-3 px-4">
                        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${perms.badgeClass}">
                          ${u.role.toUpperCase()}
                        </span>
                      </td>
                      <td class="py-3 px-4 text-slate-600 font-medium">${u.department}</td>
                      <td class="py-3 px-4 text-slate-500 font-mono">${u.phone || 'N/A'}</td>
                      <td class="py-3 px-4">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${u.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">
                          ● ${u.status}
                        </span>
                      </td>
                      <td class="py-3 px-4 text-slate-400 font-mono text-[11px]">${u.lastLogin || 'Never'}</td>
                      <td class="py-3 px-4 text-right">
                        <div class="flex items-center justify-end gap-1.5">
                          <button class="px-2.5 py-1 rounded-lg text-[11px] font-semibold btn-decor-secondary switch-user-action" data-user-id="${u.id}">
                            Switch To
                          </button>
                          ${isAdmin ? `
                            <button class="text-slate-400 hover:text-teal-700 p-1.5 rounded-lg hover:bg-teal-50 edit-user-action" data-user-id="${u.id}" title="Edit User & Permissions">
                              <i data-lucide="edit-3" class="w-4 h-4"></i>
                            </button>
                          ` : ''}
                          ${isAdmin && !isCurrent ? `
                            <button class="text-slate-300 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 delete-user-action" data-user-id="${u.id}" title="Delete Account">
                              <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                          ` : ''}
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Role Permissions Matrix Breakdown -->
        <div class="medical-card p-5">
          <div class="mb-4">
            <h3 class="text-sm font-bold text-slate-900">Role-Based Access Control (RBAC) Permission Matrix</h3>
            <p class="text-xs text-slate-500">Privileges granted to each medical role in SerenityCare</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div class="p-4 rounded-xl border border-rose-200 bg-rose-50/30 space-y-2">
              <span class="badge-medical-rose px-2 py-0.5 rounded-full font-bold text-[10px]">ADMIN / DIRECTOR</span>
              <ul class="space-y-1 text-slate-600 text-[11px]">
                <li>✔ User &amp; Staff Account Management</li>
                <li>✔ Facility &amp; Branding Settings</li>
                <li>✔ Clinical Audits &amp; Data Reset</li>
                <li>✔ Full Patient Registry Access</li>
              </ul>
            </div>

            <div class="p-4 rounded-xl border border-teal-200 bg-teal-50/30 space-y-2">
              <span class="badge-medical-teal px-2 py-0.5 rounded-full font-bold text-[10px]">DOCTOR / PSYCHIATRIST</span>
              <ul class="space-y-1 text-slate-600 text-[11px]">
                <li>✔ Authorize Medication Prescriptions</li>
                <li>✔ Conduct Psychiatric Evaluations</li>
                <li>✔ Approve Graduation &amp; Release</li>
                <li>✔ Clinical Vitals &amp; Progress Notes</li>
              </ul>
            </div>

            <div class="p-4 rounded-xl border border-cyan-200 bg-cyan-50/30 space-y-2">
              <span class="badge-medical-cyan px-2 py-0.5 rounded-full font-bold text-[10px]">NURSE / MEDICAL STAFF</span>
              <ul class="space-y-1 text-slate-600 text-[11px]">
                <li>✔ Supervised MAR Administration</li>
                <li>✔ Record Vitals &amp; Drug Screens</li>
                <li>✔ Pharmacy Dispensing &amp; Restock</li>
                <li>✔ Emergency Supply Verification</li>
              </ul>
            </div>

            <div class="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 space-y-2">
              <span class="badge-medical-emerald px-2 py-0.5 rounded-full font-bold text-[10px]">ADDICTION COUNSELOR</span>
              <ul class="space-y-1 text-slate-600 text-[11px]">
                <li>✔ 12-Step Progress Notes &amp; Logs</li>
                <li>✔ Group Therapy Timetable Leading</li>
                <li>✔ Behavioral Milestone Verification</li>
                <li>✔ Recommend Graduation Candidates</li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    `;

    // Add user button
    const addBtn = document.getElementById('add-user-btn');
    if (addBtn && isAdmin) {
      addBtn.onclick = () => this.openAddUserModal();
    }

    // Switch user actions
    document.querySelectorAll('.switch-user-action').forEach(btn => {
      btn.onclick = () => {
        const uid = btn.getAttribute('data-user-id');
        window.Auth.switchUser(uid);
      };
    });

    // Edit user actions
    document.querySelectorAll('.edit-user-action').forEach(btn => {
      btn.onclick = () => {
        const uid = btn.getAttribute('data-user-id');
        this.openEditUserModal(uid);
      };
    });

    // Delete user
    document.querySelectorAll('.delete-user-action').forEach(btn => {
      btn.onclick = () => {
        const uid = btn.getAttribute('data-user-id');
        const state = window.AppStore.getState();
        const targetUser = state.users.find(u => u.id === uid);
        const name = targetUser ? targetUser.name : 'this staff user';
        window.AppModal.confirm('Delete Staff Account?', `Are you sure you want to permanently remove ${name} from SerenityCare?`, 'Delete Account', 'danger')
          .then(async confirmed => {
            if (confirmed) {
              await window.AppStore.deleteUser(uid);
            }
          });
      };
    });

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  renderPermissionsCheckboxes(currentPerms = {}) {
    const modules = [
      { key: 'dashboard', label: 'Dashboard & Metrics', desc: 'Real-time census and clinical KPI analytics' },
      { key: 'patients', label: 'Resident Registry', desc: 'Patient dossiers, next of kin, psychiatric notes' },
      { key: 'medications', label: 'Medications (MAR)', desc: 'Supervised dose delivery & MAR verification' },
      { key: 'timetable', label: 'House Timetable', desc: 'Daily schedule, chores, 12-step therapy meetings' },
      { key: 'inventory', label: 'Pharmacy & Store', desc: 'Facility stock, supplies, audits, and dispensing' },
      { key: 'certificates', label: 'Graduation & Release', desc: 'Sober milestones & official certificate issuance' },
      { key: 'batch_upload', label: 'Batch CSV Import', desc: 'Bulk import residents from CSV data' },
      { key: 'users', label: 'Staff & RBAC', desc: 'User accounts, role assignments, permissions' },
      { key: 'settings', label: 'Facility & Settings', desc: 'Facility branding, licenses, and cloud storage' }
    ];

    return `
      <div class="pt-3 border-t border-slate-200">
        <div class="flex items-center justify-between mb-2">
          <div>
            <label class="block font-bold text-slate-800 text-xs">Assign or Remove Permissions</label>
            <span class="text-[10px] text-slate-500">Configure access rights for each operational module</span>
          </div>
          <div class="flex gap-2 text-[10px]">
            <button type="button" id="btn-select-all-perms" class="text-teal-700 font-bold hover:underline">Select All</button>
            <span class="text-slate-300">|</span>
            <button type="button" id="btn-clear-all-perms" class="text-slate-500 font-bold hover:underline">Clear All</button>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
          ${modules.map(m => {
            const isChecked = typeof currentPerms[m.key] !== 'undefined' ? Boolean(currentPerms[m.key]) : true;
            return `
              <label class="flex items-start gap-2 p-2 rounded-lg bg-white border border-slate-200/90 hover:border-teal-400 cursor-pointer transition select-none">
                <input type="checkbox" class="perm-checkbox rounded text-teal-600 focus:ring-teal-500 mt-0.5" ${isChecked ? 'checked' : ''} data-perm-key="${m.key}">
                <div class="min-w-0">
                  <span class="block font-bold text-slate-800 text-[11px] leading-tight truncate">${m.label}</span>
                  <span class="block text-[9px] text-slate-400 leading-tight truncate">${m.desc}</span>
                </div>
              </label>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  collectPermissions() {
    const perms = {};
    document.querySelectorAll('.perm-checkbox').forEach(cb => {
      const key = cb.getAttribute('data-perm-key');
      if (key) {
        perms[key] = cb.checked;
      }
    });
    return perms;
  }

  openEditUserModal(userId) {
    const state = window.AppStore.getState();
    const user = state.users.find(u => u.id === userId);
    if (!user) return;

    const currentPerms = user.permissions || {
      dashboard: true,
      patients: true,
      medications: user.role !== 'counselor',
      timetable: true,
      inventory: user.role === 'admin' || user.role === 'nurse',
      certificates: true,
      batch_upload: user.role === 'admin',
      users: user.role === 'admin',
      settings: user.role === 'admin'
    };

    const html = `
      <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
        <div>
          <h3 class="text-lg font-bold text-slate-900">Edit Staff Account &amp; Permissions</h3>
          <p class="text-xs text-slate-500">Modify credentials, operational role, and assigned module privileges</p>
        </div>
        <button id="close-user-modal" class="p-1 text-slate-400 hover:bg-slate-100 rounded-lg">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <form id="edit-user-form" class="space-y-4 text-xs">
        <div>
          <label class="block font-bold text-slate-700 mb-1">Full Legal Name *</label>
          <input type="text" id="usr-name" required value="${user.name}" class="w-full px-3 py-2 rounded-lg border border-slate-200 font-semibold text-slate-800">
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Email Address *</label>
            <input type="email" id="usr-email" required value="${user.email}" class="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono">
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Role Privilege *</label>
            <select id="usr-role" class="w-full px-3 py-2 rounded-lg border border-slate-200 font-bold text-teal-800">
              <option value="doctor" ${user.role === 'doctor' ? 'selected' : ''}>Doctor / Psychiatrist</option>
              <option value="nurse" ${user.role === 'nurse' ? 'selected' : ''}>Nurse / Medical Staff</option>
              <option value="counselor" ${user.role === 'counselor' ? 'selected' : ''}>Addiction Counselor</option>
              <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Super Administrator</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Department</label>
            <input type="text" id="usr-dept" value="${user.department || 'Clinical Team'}" class="w-full px-3 py-2 rounded-lg border border-slate-200">
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Contact Phone</label>
            <input type="text" id="usr-phone" value="${user.phone || ''}" placeholder="+255 700 000 000" class="w-full px-3 py-2 rounded-lg border border-slate-200">
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Account Status</label>
            <select id="usr-status" class="w-full px-3 py-2 rounded-lg border border-slate-200 font-bold ${user.status === 'Active' ? 'text-emerald-700' : 'text-slate-600'}">
              <option value="Active" ${user.status === 'Active' ? 'selected' : ''}>Active</option>
              <option value="Inactive" ${user.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block font-bold text-slate-700 mb-1">Update Password (Optional)</label>
          <input type="password" id="usr-password" placeholder="Leave blank to keep current password" class="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono">
        </div>

        <!-- Granular Permissions Section -->
        ${this.renderPermissionsCheckboxes(currentPerms)}

        <div class="pt-4 border-t border-slate-200 flex justify-end gap-3">
          <button type="button" id="cancel-usr-btn" class="px-4 py-2 rounded-xl btn-decor-secondary font-semibold">Cancel</button>
          <button type="submit" class="px-5 py-2 rounded-xl btn-decor-primary font-bold">Save Changes</button>
        </div>
      </form>
    `;

    window.AppModal.showCustom(html, 'max-w-2xl');

    document.getElementById('close-user-modal').onclick = () => window.AppModal.close();
    document.getElementById('cancel-usr-btn').onclick = () => window.AppModal.close();

    const selectAllBtn = document.getElementById('btn-select-all-perms');
    if (selectAllBtn) {
      selectAllBtn.onclick = () => {
        document.querySelectorAll('.perm-checkbox').forEach(cb => cb.checked = true);
      };
    }
    const clearAllBtn = document.getElementById('btn-clear-all-perms');
    if (clearAllBtn) {
      clearAllBtn.onclick = () => {
        document.querySelectorAll('.perm-checkbox').forEach(cb => cb.checked = false);
      };
    }

    document.getElementById('edit-user-form').onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="animate-spin inline-block mr-1">⏳</span> Saving...';
      }

      const updates = {
        name: document.getElementById('usr-name').value.trim(),
        email: document.getElementById('usr-email').value.trim(),
        role: document.getElementById('usr-role').value,
        department: document.getElementById('usr-dept').value.trim(),
        phone: document.getElementById('usr-phone').value.trim(),
        status: document.getElementById('usr-status').value,
        permissions: this.collectPermissions()
      };

      const newPwd = document.getElementById('usr-password').value;
      if (newPwd && newPwd.trim().length > 0) {
        updates.password = newPwd.trim();
      }

      try {
        await window.AppStore.updateUser(userId, updates);
        window.AppModal.close();

        window.AppModal.showAcceptanceCard({
          title: 'Staff Profile Updated',
          subtitle: `Changes to ${updates.name} and module permissions have been replicated globally`,
          icon: 'check-circle-2',
          badgeText: 'PERMISSIONS UPDATED',
          badgeColor: 'badge-medical-emerald',
          confirmType: 'success',
          confirmText: 'Done'
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

  openAddUserModal() {
    const defaultPerms = {
      dashboard: true,
      patients: true,
      medications: true,
      timetable: true,
      inventory: false,
      certificates: true,
      batch_upload: false,
      users: false,
      settings: false
    };

    const html = `
      <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
        <div>
          <h3 class="text-lg font-bold text-slate-900">Add Clinical Staff Account</h3>
          <p class="text-xs text-slate-500">Register a new healthcare worker and configure access privileges</p>
        </div>
        <button id="close-user-modal" class="p-1 text-slate-400 hover:bg-slate-100 rounded-lg">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <form id="new-user-form" class="space-y-4 text-xs">
        <div>
          <label class="block font-bold text-slate-700 mb-1">Full Legal Name *</label>
          <input type="text" id="usr-name" required placeholder="E.g., Dr. Robert Miles, MD" class="w-full px-3 py-2 rounded-lg border border-slate-200">
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Email Address *</label>
            <input type="email" id="usr-email" required placeholder="name@serenitycare.org" class="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono">
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Role Privilege *</label>
            <select id="usr-role" class="w-full px-3 py-2 rounded-lg border border-slate-200 font-bold text-teal-800">
              <option value="doctor">Doctor / Psychiatrist</option>
              <option value="nurse">Nurse / Medical Staff</option>
              <option value="counselor">Addiction Counselor</option>
              <option value="admin">Super Administrator</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Department</label>
            <input type="text" id="usr-dept" value="Inpatient Clinical Team" class="w-full px-3 py-2 rounded-lg border border-slate-200">
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Contact Phone</label>
            <input type="text" id="usr-phone" placeholder="+255 700 000 000" class="w-full px-3 py-2 rounded-lg border border-slate-200">
          </div>
        </div>

        <div>
          <label class="block font-bold text-slate-700 mb-1">Account Password *</label>
          <input type="password" id="usr-password" required value="Staff@Serenity2026!" placeholder="Minimum 8 characters" class="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono">
          <span class="text-[10px] text-slate-400">Default initial password for first login</span>
        </div>

        <!-- Granular Permissions Checklist -->
        ${this.renderPermissionsCheckboxes(defaultPerms)}

        <div class="pt-4 border-t border-slate-200 flex justify-end gap-3">
          <button type="button" id="cancel-usr-btn" class="px-4 py-2 rounded-xl btn-decor-secondary font-semibold">Cancel</button>
          <button type="submit" class="px-5 py-2 rounded-xl btn-decor-primary font-bold">Create Account</button>
        </div>
      </form>
    `;

    window.AppModal.showCustom(html, 'max-w-2xl');

    document.getElementById('close-user-modal').onclick = () => window.AppModal.close();
    document.getElementById('cancel-usr-btn').onclick = () => window.AppModal.close();

    const roleSelect = document.getElementById('usr-role');
    if (roleSelect) {
      roleSelect.onchange = (e) => {
        const role = e.target.value;
        const roleDefaults = {
          admin: { dashboard: true, patients: true, medications: true, timetable: true, inventory: true, certificates: true, batch_upload: true, users: true, settings: true },
          doctor: { dashboard: true, patients: true, medications: true, timetable: true, inventory: false, certificates: true, batch_upload: true, users: false, settings: false },
          nurse: { dashboard: true, patients: true, medications: true, timetable: false, inventory: true, certificates: false, batch_upload: false, users: false, settings: false },
          counselor: { dashboard: true, patients: true, medications: false, timetable: true, inventory: false, certificates: true, batch_upload: false, users: false, settings: false }
        };
        const defaults = roleDefaults[role] || {};
        document.querySelectorAll('.perm-checkbox').forEach(cb => {
          const key = cb.getAttribute('data-perm-key');
          if (typeof defaults[key] !== 'undefined') {
            cb.checked = defaults[key];
          }
        });
      };
    }

    const selectAllBtn = document.getElementById('btn-select-all-perms');
    if (selectAllBtn) {
      selectAllBtn.onclick = () => {
        document.querySelectorAll('.perm-checkbox').forEach(cb => cb.checked = true);
      };
    }
    const clearAllBtn = document.getElementById('btn-clear-all-perms');
    if (clearAllBtn) {
      clearAllBtn.onclick = () => {
        document.querySelectorAll('.perm-checkbox').forEach(cb => cb.checked = false);
      };
    }

    document.getElementById('new-user-form').onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="animate-spin inline-block mr-1">⏳</span> Creating Account...';
      }

      try {
        const newUser = await window.AppStore.addUser({
          name: document.getElementById('usr-name').value.trim(),
          email: document.getElementById('usr-email').value.trim(),
          role: document.getElementById('usr-role').value,
          department: document.getElementById('usr-dept').value.trim(),
          phone: document.getElementById('usr-phone').value.trim(),
          password: document.getElementById('usr-password').value,
          permissions: this.collectPermissions()
        });
        window.AppModal.close();

        window.AppModal.showAcceptanceCard({
          title: 'Staff Account Created',
          subtitle: `${newUser.name} is registered with custom permissions across all devices`,
          icon: 'check-circle-2',
          badgeText: 'ACCOUNT CREATED',
          badgeColor: 'badge-medical-emerald',
          confirmType: 'success',
          confirmText: 'Done'
        });
      } catch (err) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Create Account';
        }
        window.AppModal.close();
      }
    };

    if (window.lucide) window.lucide.createIcons();
  }
}

window.UsersView = UsersView;
