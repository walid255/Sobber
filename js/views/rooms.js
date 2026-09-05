/**
 * SerenityCare Room & Bed Management View
 * 
 * Provides interactive residential floor management:
 * - Real-time bed occupancy and availability tracking
 * - Add/Edit/Remove rooms with role-based permission gating (Admin & permitted staff)
 * - Add/Remove/Vacate/Reassign beds with occupancy safety locks
 * - Instant global Cloudflare KV & D1 synchronization
 */

class RoomsView {
  constructor() {
    this.searchQuery = '';
    this.floorFilter = 'all';
    this.statusFilter = 'all';
  }

  canManage() {
    const user = window.Auth.getCurrentUser();
    if (!user) return false;
    if (user.role === 'admin') return true;
    return Boolean(window.Auth.hasPermission('rooms') || window.Auth.hasPermission('canManageRooms'));
  }

  render() {
    const state = window.AppStore.getState();
    const rooms = state.rooms || [];
    const beds = state.beds || [];
    const patients = state.patients || [];
    const canManage = this.canManage();

    const totalRooms = rooms.length;
    const totalBeds = beds.length;
    const occupiedBeds = beds.filter(b => b.status === 'Occupied').length;
    const availableBeds = beds.filter(b => b.status === 'Available').length;
    const maintenanceBeds = beds.filter(b => b.status === 'Maintenance').length;
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    // Filter floors
    const floors = Array.from(new Set(rooms.map(r => r.floor || '1st Floor'))).sort();

    // Filter rooms & beds based on filters and search
    const filteredRooms = rooms.filter(rm => {
      if (this.floorFilter !== 'all' && rm.floor !== this.floorFilter) return false;
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        const matchRoom = (rm.roomNumber && rm.roomNumber.toLowerCase().includes(q)) ||
                          (rm.name && rm.name.toLowerCase().includes(q)) ||
                          (rm.floor && rm.floor.toLowerCase().includes(q));
        const roomBeds = beds.filter(b => b.roomId === rm.id);
        const matchBedOrPatient = roomBeds.some(b => {
          if (b.bedNumber && b.bedNumber.toLowerCase().includes(q)) return true;
          if (b.patientId) {
            const p = patients.find(pt => pt.id === b.patientId);
            return p && (p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
          }
          return false;
        });
        if (!matchRoom && !matchBedOrPatient) return false;
      }
      return true;
    });

    return `
      <div class="p-4 md:p-8 space-y-6">

        <!-- Header -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <i data-lucide="hotel" class="w-6 h-6 text-teal-600"></i>
                <span>Rooms &amp; Bed Allocation</span>
              </h1>
              <span class="badge-medical-teal text-[10px] font-bold px-2 py-0.5 rounded-full">FACILITY CENSUS</span>
            </div>
            <p class="text-xs text-slate-500 mt-1">
              Real-time room occupancy, bed availability matrix, and residential facility administration.
            </p>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <button id="refresh-rooms-btn" class="px-3 py-2 rounded-xl btn-decor-secondary text-xs font-semibold flex items-center gap-1.5">
              <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
              <span>Sync Status</span>
            </button>

            ${canManage ? `
              <button id="add-bed-header-btn" class="px-3.5 py-2 rounded-xl btn-decor-secondary text-xs font-bold flex items-center gap-1.5">
                <i data-lucide="bed-double" class="w-3.5 h-3.5 text-teal-600"></i>
                <span>+ Add Bed</span>
              </button>
              <button id="add-room-btn" class="px-4 py-2 rounded-xl btn-decor-primary text-xs font-bold flex items-center gap-1.5 shadow-md shadow-teal-700/20">
                <i data-lucide="plus-circle" class="w-4 h-4"></i>
                <span>+ Add New Room</span>
              </button>
            ` : `
              <span class="text-[11px] text-slate-400 italic bg-slate-100 px-3 py-1.5 rounded-xl">View-Only Access (Admin managed)</span>
            `}
          </div>
        </div>

        <!-- KPI Summary Cards -->
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div class="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
            <div class="flex items-center justify-between text-slate-400">
              <span class="text-[10px] font-bold uppercase tracking-wider">Total Rooms</span>
              <i data-lucide="door-open" class="w-4 h-4 text-teal-600"></i>
            </div>
            <div class="text-2xl font-black text-slate-900">${totalRooms}</div>
            <div class="text-[10px] text-slate-500">${floors.length} Floors / Wings</div>
          </div>

          <div class="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
            <div class="flex items-center justify-between text-slate-400">
              <span class="text-[10px] font-bold uppercase tracking-wider">Total Beds</span>
              <i data-lucide="bed" class="w-4 h-4 text-teal-600"></i>
            </div>
            <div class="text-2xl font-black text-slate-900">${totalBeds}</div>
            <div class="text-[10px] text-slate-500">Facility Capacity</div>
          </div>

          <div class="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 shadow-xs space-y-1">
            <div class="flex items-center justify-between text-emerald-600">
              <span class="text-[10px] font-bold uppercase tracking-wider">Available Beds</span>
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <div class="text-2xl font-black text-emerald-900">${availableBeds}</div>
            <div class="text-[10px] text-emerald-700 font-semibold">Ready for intake</div>
          </div>

          <div class="p-4 rounded-2xl bg-teal-50/50 border border-teal-200/80 shadow-xs space-y-1">
            <div class="flex items-center justify-between text-teal-700">
              <span class="text-[10px] font-bold uppercase tracking-wider">Occupied Beds</span>
              <i data-lucide="user-check" class="w-4 h-4 text-teal-700"></i>
            </div>
            <div class="text-2xl font-black text-teal-900">${occupiedBeds}</div>
            <div class="text-[10px] text-teal-700 font-semibold">Active residents</div>
          </div>

          <div class="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1 col-span-2 lg:col-span-1">
            <div class="flex items-center justify-between text-slate-400">
              <span class="text-[10px] font-bold uppercase tracking-wider">Occupancy Rate</span>
              <span class="text-xs font-bold text-slate-700">${occupancyRate}%</span>
            </div>
            <div class="text-2xl font-black text-slate-900">${occupancyRate}%</div>
            <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mt-1">
              <div class="bg-teal-600 h-1.5 rounded-full transition-all" style="width: ${occupancyRate}%"></div>
            </div>
          </div>
        </div>

        <!-- Filter and Search Bar -->
        <div class="p-3 bg-white border border-slate-200/80 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
          <div class="relative w-full md:w-80">
            <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"></i>
            <input type="text" id="rooms-search-input" value="${this.searchQuery}" placeholder="Search room, wing, or resident..." 
                   class="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-teal-500">
          </div>

          <div class="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Floor:</span>
            <select id="floor-filter-select" class="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:border-teal-500">
              <option value="all" ${this.floorFilter === 'all' ? 'selected' : ''}>All Floors</option>
              ${floors.map(f => `<option value="${f}" ${this.floorFilter === f ? 'selected' : ''}>${f}</option>`).join('')}
            </select>

            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap ml-2">Status:</span>
            <select id="status-filter-select" class="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:border-teal-500">
              <option value="all" ${this.statusFilter === 'all' ? 'selected' : ''}>All Statuses</option>
              <option value="Available" ${this.statusFilter === 'Available' ? 'selected' : ''}>Available Only</option>
              <option value="Occupied" ${this.statusFilter === 'Occupied' ? 'selected' : ''}>Occupied Only</option>
              <option value="Maintenance" ${this.statusFilter === 'Maintenance' ? 'selected' : ''}>Maintenance</option>
            </select>
          </div>
        </div>

        <!-- Rooms Grid -->
        ${filteredRooms.length === 0 ? `
          <div class="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 space-y-3">
            <div class="w-12 h-12 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mx-auto">
              <i data-lucide="hotel" class="w-6 h-6"></i>
            </div>
            <h3 class="text-sm font-bold text-slate-800">No Rooms Found</h3>
            <p class="text-xs text-slate-500 max-w-sm mx-auto">
              ${this.searchQuery || this.floorFilter !== 'all' ? 'No rooms match your filter criteria.' : 'Create your first room to begin assigning beds to incoming residents.'}
            </p>
            ${canManage && !this.searchQuery ? `
              <button id="add-first-room-btn" class="px-4 py-2 rounded-xl btn-decor-primary text-xs font-bold inline-flex items-center gap-1.5">
                <i data-lucide="plus" class="w-4 h-4"></i>
                <span>Add First Room</span>
              </button>
            ` : ''}
          </div>
        ` : `
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            ${filteredRooms.map(rm => this.renderRoomCard(rm, beds, patients, canManage)).join('')}
          </div>
        `}

      </div>
    `;
  }

  renderRoomCard(rm, allBeds, patients, canManage) {
    let roomBeds = allBeds.filter(b => b.roomId === rm.id);
    if (this.statusFilter !== 'all') {
      roomBeds = roomBeds.filter(b => b.status === this.statusFilter);
    }

    const totalInRoom = allBeds.filter(b => b.roomId === rm.id).length;
    const occupiedInRoom = allBeds.filter(b => b.roomId === rm.id && b.status === 'Occupied').length;
    const isFull = totalInRoom > 0 && occupiedInRoom === totalInRoom;

    let typeBadge = 'bg-slate-100 text-slate-700';
    if (rm.type === 'Detox') typeBadge = 'bg-rose-100 text-rose-800 border-rose-200';
    else if (rm.type === 'Single') typeBadge = 'bg-indigo-100 text-indigo-800 border-indigo-200';
    else if (rm.type === 'Double') typeBadge = 'bg-teal-100 text-teal-800 border-teal-200';
    else if (rm.type === 'Ward') typeBadge = 'bg-amber-100 text-amber-800 border-amber-200';

    return `
      <div class="bg-white rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between overflow-hidden hover:border-teal-400/80 transition-all">
        
        <!-- Room Header -->
        <div class="p-4 border-b border-slate-100 bg-slate-50/50">
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-black text-slate-900 text-base">${rm.roomNumber}</span>
                <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${typeBadge}">${rm.type || 'Standard'}</span>
              </div>
              <div class="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                <span>${rm.name || 'Resident Room'}</span>
                <span>&bull;</span>
                <span class="font-medium text-slate-600">${rm.floor || '1st Floor'}</span>
              </div>
            </div>

            <!-- Occupancy ratio badge -->
            <div class="text-right">
              <span class="px-2 py-1 rounded-lg text-[11px] font-mono font-bold ${isFull ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}">
                ${occupiedInRoom}/${rm.capacity || totalInRoom} Beds
              </span>
            </div>
          </div>

          ${rm.notes ? `
            <p class="text-[10px] text-slate-400 italic mt-2 line-clamp-1">${rm.notes}</p>
          ` : ''}
        </div>

        <!-- Beds list inside room -->
        <div class="p-4 space-y-2.5 flex-1">
          <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Beds in Room (${roomBeds.length})</span>
            ${canManage ? `
              <button class="add-bed-btn text-teal-700 hover:text-teal-900 font-bold flex items-center gap-1" data-room-id="${rm.id}">
                <i data-lucide="plus" class="w-3 h-3"></i> <span>Add Bed</span>
              </button>
            ` : ''}
          </div>

          ${roomBeds.length === 0 ? `
            <div class="p-4 text-center text-[11px] text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              No beds allocated in this room yet.
            </div>
          ` : `
            <div class="space-y-2">
              ${roomBeds.map(b => this.renderBedItem(b, rm, patients, canManage)).join('')}
            </div>
          `}
        </div>

        <!-- Room Action Footer -->
        ${canManage ? `
          <div class="px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs">
            <button class="edit-room-btn text-slate-600 hover:text-teal-700 font-semibold flex items-center gap-1 text-[11px]" data-room-id="${rm.id}">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
              <span>Edit Room</span>
            </button>

            <button class="delete-room-btn text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 text-[11px]" 
                    data-room-id="${rm.id}" data-room-num="${rm.roomNumber}" ${occupiedInRoom > 0 ? 'disabled title="Cannot delete: room has occupied beds"' : ''}>
              <i data-lucide="trash-2" class="w-3.5 h-3.5 ${occupiedInRoom > 0 ? 'text-slate-300' : ''}"></i>
              <span class="${occupiedInRoom > 0 ? 'text-slate-400 line-through cursor-not-allowed' : ''}">Delete</span>
            </button>
          </div>
        ` : ''}

      </div>
    `;
  }

  renderBedItem(bed, room, patients, canManage) {
    const isOccupied = bed.status === 'Occupied';
    const isMaintenance = bed.status === 'Maintenance';
    const patient = isOccupied && bed.patientId ? patients.find(p => p.id === bed.patientId) : null;

    let statusClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    let statusLabel = 'Available';
    let statusDot = 'bg-emerald-500';

    if (isOccupied) {
      statusClass = 'bg-teal-50 text-teal-800 border-teal-200';
      statusLabel = 'Occupied';
      statusDot = 'bg-teal-600';
    } else if (isMaintenance) {
      statusClass = 'bg-amber-50 text-amber-800 border-amber-200';
      statusLabel = 'Maintenance';
      statusDot = 'bg-amber-500';
    }

    return `
      <div class="p-2.5 rounded-xl border ${isOccupied ? 'border-teal-200 bg-teal-50/20' : (isMaintenance ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200 bg-white')} flex items-center justify-between gap-2 text-xs">
        
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-2.5 h-2.5 rounded-full ${statusDot} shrink-0"></div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-slate-800 text-[11px] truncate">${bed.bedNumber}</span>
              <span class="text-[9px] text-slate-400 font-mono">(${bed.type || 'Standard'})</span>
            </div>

            ${isOccupied && patient ? `
              <div class="text-[10px] text-teal-800 font-medium truncate flex items-center gap-1">
                <i data-lucide="user" class="w-3 h-3 text-teal-600 shrink-0"></i>
                <span class="font-bold cursor-pointer hover:underline view-resident-link" data-patient-id="${patient.id}">
                  ${patient.name}
                </span>
                <span class="text-slate-400 font-mono text-[9px]">(${patient.id})</span>
              </div>
            ` : (isOccupied ? `
              <div class="text-[10px] text-slate-400 italic">Occupied (ID: ${bed.patientId})</div>
            ` : `
              <div class="text-[10px] ${isMaintenance ? 'text-amber-700' : 'text-emerald-700'} font-medium">${statusLabel}</div>
            `)}
          </div>
        </div>

        <!-- Bed Action buttons -->
        ${canManage ? `
          <div class="flex items-center gap-1 shrink-0">
            ${isOccupied ? `
              <button class="vacate-bed-btn p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-rose-600 transition" 
                      title="Vacate Bed (Discharge resident from bed)" data-bed-id="${bed.id}" data-bed-num="${bed.bedNumber}">
                <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
              </button>
            ` : (isMaintenance ? `
              <button class="set-available-btn px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition" 
                      data-bed-id="${bed.id}">
                Set Active
              </button>
            ` : `
              <button class="set-maintenance-btn p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-amber-600 transition" 
                      title="Mark as Under Maintenance" data-bed-id="${bed.id}">
                <i data-lucide="wrench" class="w-3.5 h-3.5"></i>
              </button>
            `)}

            <button class="delete-bed-btn p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition" 
                    title="Remove Bed" data-bed-id="${bed.id}" data-bed-num="${bed.bedNumber}" ${isOccupied ? 'disabled' : ''}>
              <i data-lucide="trash-2" class="w-3.5 h-3.5 ${isOccupied ? 'text-slate-200 cursor-not-allowed' : ''}"></i>
            </button>
          </div>
        ` : ''}

      </div>
    `;
  }

  attachEvents() {
    // Search input
    const searchInput = document.getElementById('rooms-search-input');
    if (searchInput) {
      searchInput.oninput = (e) => {
        this.searchQuery = e.target.value;
        window.AppRouter.renderCurrentRoute();
      };
    }

    // Floor filter
    const floorSelect = document.getElementById('floor-filter-select');
    if (floorSelect) {
      floorSelect.onchange = (e) => {
        this.floorFilter = e.target.value;
        window.AppRouter.renderCurrentRoute();
      };
    }

    // Status filter
    const statusSelect = document.getElementById('status-filter-select');
    if (statusSelect) {
      statusSelect.onchange = (e) => {
        this.statusFilter = e.target.value;
        window.AppRouter.renderCurrentRoute();
      };
    }

    // Refresh
    const refreshBtn = document.getElementById('refresh-rooms-btn');
    if (refreshBtn) {
      refreshBtn.onclick = async () => {
        refreshBtn.classList.add('animate-spin');
        await window.AppStore.syncFromServer();
        setTimeout(() => refreshBtn.classList.remove('animate-spin'), 600);
      };
    }

    // Add room button
    const addRoomBtn = document.getElementById('add-room-btn');
    const addFirstRoomBtn = document.getElementById('add-first-room-btn');
    if (addRoomBtn) addRoomBtn.onclick = () => this.openAddRoomModal();
    if (addFirstRoomBtn) addFirstRoomBtn.onclick = () => this.openAddRoomModal();

    // Add bed header button
    const addBedHeaderBtn = document.getElementById('add-bed-header-btn');
    if (addBedHeaderBtn) addBedHeaderBtn.onclick = () => this.openAddBedModal();

    // Add bed to room buttons
    document.querySelectorAll('.add-bed-btn').forEach(btn => {
      btn.onclick = () => {
        const roomId = btn.getAttribute('data-room-id');
        this.openAddBedModal(roomId);
      };
    });

    // Edit room buttons
    document.querySelectorAll('.edit-room-btn').forEach(btn => {
      btn.onclick = () => {
        const roomId = btn.getAttribute('data-room-id');
        this.openEditRoomModal(roomId);
      };
    });

    // Delete room buttons
    document.querySelectorAll('.delete-room-btn').forEach(btn => {
      btn.onclick = () => {
        const roomId = btn.getAttribute('data-room-id');
        const roomNum = btn.getAttribute('data-room-num');
        window.AppModal.confirm(
          `Delete ${roomNum}?`,
          `Are you sure you want to remove ${roomNum} and its beds from the facility? This action cannot be undone.`,
          'Delete Room',
          'danger'
        ).then(async (confirmed) => {
          if (confirmed) {
            const res = await window.AppStore.deleteRoom(roomId);
            if (!res.success) {
              window.AppModal.alert('Action Blocked', res.error, 'danger');
            }
          }
        });
      };
    });

    // Delete bed buttons
    document.querySelectorAll('.delete-bed-btn').forEach(btn => {
      btn.onclick = () => {
        const bedId = btn.getAttribute('data-bed-id');
        const bedNum = btn.getAttribute('data-bed-num');
        window.AppModal.confirm(
          `Delete ${bedNum}?`,
          `Are you sure you want to remove bed ${bedNum}?`,
          'Remove Bed',
          'danger'
        ).then(async (confirmed) => {
          if (confirmed) {
            const res = await window.AppStore.deleteBed(bedId);
            if (!res.success) {
              window.AppModal.alert('Action Blocked', res.error, 'danger');
            }
          }
        });
      };
    });

    // Vacate bed buttons
    document.querySelectorAll('.vacate-bed-btn').forEach(btn => {
      btn.onclick = () => {
        const bedId = btn.getAttribute('data-bed-id');
        const bedNum = btn.getAttribute('data-bed-num');
        window.AppModal.confirm(
          `Vacate ${bedNum}?`,
          `This will unassign the resident and mark ${bedNum} as Available.`,
          'Vacate Bed',
          'warning'
        ).then(async (confirmed) => {
          if (confirmed) {
            await window.AppStore.vacateBed(bedId);
          }
        });
      };
    });

    // Maintenance / Available toggles
    document.querySelectorAll('.set-maintenance-btn').forEach(btn => {
      btn.onclick = async () => {
        const bedId = btn.getAttribute('data-bed-id');
        await window.AppStore.updateBed(bedId, { status: 'Maintenance' });
      };
    });

    document.querySelectorAll('.set-available-btn').forEach(btn => {
      btn.onclick = async () => {
        const bedId = btn.getAttribute('data-bed-id');
        await window.AppStore.updateBed(bedId, { status: 'Available', patientId: null });
      };
    });

    // Resident link click
    document.querySelectorAll('.view-resident-link').forEach(btn => {
      btn.onclick = () => {
        const pid = btn.getAttribute('data-patient-id');
        if (window.PatientsViewInstance) {
          window.location.hash = '#patients';
          setTimeout(() => {
            if (window.PatientsViewInstance.openPatientModal) {
              window.PatientsViewInstance.openPatientModal(pid);
            }
          }, 100);
        }
      };
    });

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  openAddRoomModal() {
    const html = `
      <form id="add-room-form" class="space-y-4 text-xs">
        <div class="flex items-center justify-between pb-3 border-b border-slate-200">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
              <i data-lucide="plus-circle" class="w-4 h-4"></i>
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900">Add New Facility Room</h3>
              <p class="text-[11px] text-slate-500">Configure room number, floor, capacity, and auto-generate beds</p>
            </div>
          </div>
          <button type="button" id="close-add-room-modal" class="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Room Number *</label>
            <input type="text" id="rm-number" required placeholder="E.g., Room 104 or Detox 02" class="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500">
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Room Name / Wing</label>
            <input type="text" id="rm-name" placeholder="E.g., Cedar Wing 104" class="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500">
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Floor / Location *</label>
            <select id="rm-floor" class="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500">
              <option value="Ground Floor">Ground Floor</option>
              <option value="1st Floor" selected>1st Floor</option>
              <option value="2nd Floor">2nd Floor</option>
              <option value="Detox Wing">Detox Wing</option>
              <option value="Transition Annex">Transition Annex</option>
            </select>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Room Type *</label>
            <select id="rm-type" class="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500">
              <option value="Single">Single (Private transition)</option>
              <option value="Double" selected>Double (Standard 2-bed)</option>
              <option value="Ward">Ward (Group recovery unit)</option>
              <option value="Detox">Detox (Monitored clinical unit)</option>
              <option value="Intensive">Intensive Care Recovery</option>
            </select>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Max Capacity (Beds) *</label>
            <input type="number" id="rm-capacity" value="2" min="1" max="20" required class="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500">
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Auto-Generate Beds</label>
            <select id="rm-initial-beds" class="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500">
              <option value="2" selected>Create 2 Beds (Bed A, Bed B)</option>
              <option value="1">Create 1 Bed (Bed A)</option>
              <option value="3">Create 3 Beds (Bed A, Bed B, Bed C)</option>
              <option value="4">Create 4 Beds (Bed A, B, C, D)</option>
              <option value="0">Do not auto-generate beds</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block font-bold text-slate-700 mb-1">Clinical / Operational Notes</label>
          <textarea id="rm-notes" rows="2" placeholder="Vitals monitoring notes, accessibility features, ensuite bathroom..." class="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500"></textarea>
        </div>

        <div class="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <button type="button" id="cancel-add-room-btn" class="px-4 py-2 rounded-xl btn-decor-secondary font-semibold">
            Cancel
          </button>
          <button type="submit" class="px-5 py-2 rounded-xl btn-decor-primary font-bold flex items-center gap-1.5">
            <i data-lucide="check" class="w-4 h-4"></i>
            <span>Save Room</span>
          </button>
        </div>
      </form>
    `;

    window.AppModal.showCustom(html, 'max-w-lg');

    document.getElementById('close-add-room-modal').onclick = () => window.AppModal.close();
    document.getElementById('cancel-add-room-btn').onclick = () => window.AppModal.close();

    document.getElementById('add-room-form').onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Saving...';
      }

      const roomData = {
        roomNumber: document.getElementById('rm-number').value.trim(),
        name: document.getElementById('rm-name').value.trim() || document.getElementById('rm-number').value.trim(),
        floor: document.getElementById('rm-floor').value,
        type: document.getElementById('rm-type').value,
        capacity: parseInt(document.getElementById('rm-capacity').value) || 2,
        initialBedsCount: parseInt(document.getElementById('rm-initial-beds').value) || 0,
        notes: document.getElementById('rm-notes').value.trim()
      };

      await window.AppStore.addRoom(roomData);
      window.AppModal.close();
      window.AppRouter.renderCurrentRoute();
    };

    if (window.lucide) window.lucide.createIcons();
  }

  openEditRoomModal(roomId) {
    const state = window.AppStore.getState();
    const rm = (state.rooms || []).find(r => r.id === roomId);
    if (!rm) return;

    const html = `
      <form id="edit-room-form" class="space-y-4 text-xs">
        <div class="flex items-center justify-between pb-3 border-b border-slate-200">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900">Edit Room: ${rm.roomNumber}</h3>
              <p class="text-[11px] text-slate-500">Update wing, floor, capacity, and clinical notes</p>
            </div>
          </div>
          <button type="button" id="close-edit-room-modal" class="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Room Number *</label>
            <input type="text" id="edit-rm-number" value="${rm.roomNumber}" required class="w-full px-3 py-2 rounded-xl border border-slate-200">
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Room Name / Wing</label>
            <input type="text" id="edit-rm-name" value="${rm.name || ''}" class="w-full px-3 py-2 rounded-xl border border-slate-200">
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Floor / Location *</label>
            <select id="edit-rm-floor" class="w-full px-3 py-2 rounded-xl border border-slate-200">
              <option value="Ground Floor" ${rm.floor === 'Ground Floor' ? 'selected' : ''}>Ground Floor</option>
              <option value="1st Floor" ${rm.floor === '1st Floor' ? 'selected' : ''}>1st Floor</option>
              <option value="2nd Floor" ${rm.floor === '2nd Floor' ? 'selected' : ''}>2nd Floor</option>
              <option value="Detox Wing" ${rm.floor === 'Detox Wing' ? 'selected' : ''}>Detox Wing</option>
              <option value="Transition Annex" ${rm.floor === 'Transition Annex' ? 'selected' : ''}>Transition Annex</option>
            </select>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Room Type *</label>
            <select id="edit-rm-type" class="w-full px-3 py-2 rounded-xl border border-slate-200">
              <option value="Single" ${rm.type === 'Single' ? 'selected' : ''}>Single (Private)</option>
              <option value="Double" ${rm.type === 'Double' ? 'selected' : ''}>Double (Standard 2-bed)</option>
              <option value="Ward" ${rm.type === 'Ward' ? 'selected' : ''}>Ward (Group recovery)</option>
              <option value="Detox" ${rm.type === 'Detox' ? 'selected' : ''}>Detox (Clinical)</option>
              <option value="Intensive" ${rm.type === 'Intensive' ? 'selected' : ''}>Intensive Care</option>
            </select>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Max Capacity (Beds)</label>
            <input type="number" id="edit-rm-capacity" value="${rm.capacity || 2}" min="1" class="w-full px-3 py-2 rounded-xl border border-slate-200">
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Operational Status</label>
            <select id="edit-rm-status" class="w-full px-3 py-2 rounded-xl border border-slate-200">
              <option value="Active" ${rm.status === 'Active' ? 'selected' : ''}>Active</option>
              <option value="Maintenance" ${rm.status === 'Maintenance' ? 'selected' : ''}>Maintenance</option>
              <option value="Inactive" ${rm.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block font-bold text-slate-700 mb-1">Notes</label>
          <textarea id="edit-rm-notes" rows="2" class="w-full px-3 py-2 rounded-xl border border-slate-200">${rm.notes || ''}</textarea>
        </div>

        <div class="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <button type="button" id="cancel-edit-room-btn" class="px-4 py-2 rounded-xl btn-decor-secondary font-semibold">Cancel</button>
          <button type="submit" class="px-5 py-2 rounded-xl btn-decor-primary font-bold flex items-center gap-1.5">
            <i data-lucide="check" class="w-4 h-4"></i>
            <span>Update Room</span>
          </button>
        </div>
      </form>
    `;

    window.AppModal.showCustom(html, 'max-w-lg');
    document.getElementById('close-edit-room-modal').onclick = () => window.AppModal.close();
    document.getElementById('cancel-edit-room-btn').onclick = () => window.AppModal.close();

    document.getElementById('edit-room-form').onsubmit = async (e) => {
      e.preventDefault();
      await window.AppStore.updateRoom(roomId, {
        roomNumber: document.getElementById('edit-rm-number').value.trim(),
        name: document.getElementById('edit-rm-name').value.trim(),
        floor: document.getElementById('edit-rm-floor').value,
        type: document.getElementById('edit-rm-type').value,
        capacity: parseInt(document.getElementById('edit-rm-capacity').value) || 2,
        status: document.getElementById('edit-rm-status').value,
        notes: document.getElementById('edit-rm-notes').value.trim()
      });
      window.AppModal.close();
      window.AppRouter.renderCurrentRoute();
    };

    if (window.lucide) window.lucide.createIcons();
  }

  openAddBedModal(preselectedRoomId = null) {
    const state = window.AppStore.getState();
    const rooms = state.rooms || [];
    if (rooms.length === 0) {
      window.AppModal.alert('No Rooms Available', 'Please create a room first before adding beds.', 'warning');
      return;
    }

    const defaultRoom = preselectedRoomId || (rooms[0] ? rooms[0].id : '');
    const rm = rooms.find(r => r.id === defaultRoom) || rooms[0];
    const existingBedsInRoom = (state.beds || []).filter(b => b.roomId === rm.id);
    const nextLetter = String.fromCharCode(65 + existingBedsInRoom.length);
    const suggestedNumber = `${rm.roomNumber}-${nextLetter}`;

    const html = `
      <form id="add-bed-form" class="space-y-4 text-xs">
        <div class="flex items-center justify-between pb-3 border-b border-slate-200">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
              <i data-lucide="bed-double" class="w-4 h-4"></i>
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900">Add Bed to Room</h3>
              <p class="text-[11px] text-slate-500">Allocate an individual recovery bed</p>
            </div>
          </div>
          <button type="button" id="close-add-bed-modal" class="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <div class="space-y-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Assign to Room *</label>
            <select id="bed-room-select" required class="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500">
              ${rooms.map(r => `<option value="${r.id}" ${r.id === defaultRoom ? 'selected' : ''}>${r.roomNumber} - ${r.name || r.type} (${r.floor})</option>`).join('')}
            </select>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Bed Number / Label *</label>
              <input type="text" id="bed-number" value="${suggestedNumber}" required class="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500">
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Bed Type *</label>
              <select id="bed-type" class="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500">
                <option value="Standard" selected>Standard Medical Bed</option>
                <option value="Medical">Medical / Detox Vitals Bunk</option>
                <option value="Orthopedic">Orthopedic Recovery Bed</option>
                <option value="Low-Profile">Low-Profile Safety Bed</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Initial Status</label>
            <select id="bed-status" class="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500">
              <option value="Available" selected>Available (Ready for admission)</option>
              <option value="Maintenance">Maintenance / Reserved</option>
            </select>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Notes</label>
            <input type="text" id="bed-notes" placeholder="E.g., Window position, equipped with IV stand" class="w-full px-3 py-2 rounded-xl border border-slate-200">
          </div>
        </div>

        <div class="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <button type="button" id="cancel-add-bed-btn" class="px-4 py-2 rounded-xl btn-decor-secondary font-semibold">Cancel</button>
          <button type="submit" class="px-5 py-2 rounded-xl btn-decor-primary font-bold flex items-center gap-1.5">
            <i data-lucide="check" class="w-4 h-4"></i>
            <span>Add Bed</span>
          </button>
        </div>
      </form>
    `;

    window.AppModal.showCustom(html, 'max-w-md');
    document.getElementById('close-add-bed-modal').onclick = () => window.AppModal.close();
    document.getElementById('cancel-add-bed-btn').onclick = () => window.AppModal.close();

    const roomSelect = document.getElementById('bed-room-select');
    const bedNumInput = document.getElementById('bed-number');
    roomSelect.onchange = () => {
      const selected = rooms.find(r => r.id === roomSelect.value);
      if (selected) {
        const count = (state.beds || []).filter(b => b.roomId === selected.id).length;
        bedNumInput.value = `${selected.roomNumber}-${String.fromCharCode(65 + count)}`;
      }
    };

    document.getElementById('add-bed-form').onsubmit = async (e) => {
      e.preventDefault();
      await window.AppStore.addBed({
        roomId: roomSelect.value,
        bedNumber: bedNumInput.value.trim(),
        type: document.getElementById('bed-type').value,
        status: document.getElementById('bed-status').value,
        notes: document.getElementById('bed-notes').value.trim()
      });
      window.AppModal.close();
      window.AppRouter.renderCurrentRoute();
    };

    if (window.lucide) window.lucide.createIcons();
  }
}

window.RoomsView = RoomsView;
