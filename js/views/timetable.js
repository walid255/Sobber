/**
 * SerenityCare House Routine & Timetable Planner View
 * Manages daily/weekly schedule, group therapy, 12-step meetings, chores, and printable house schedules.
 */

class TimetableView {
  constructor() {
    this.currentDay = 'Monday'; // Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday, All
  }

  render(container) {
    const state = window.AppStore.getState();
    const timetable = state.timetable;

    const filteredEvents = timetable.filter(e => {
      return this.currentDay === 'All' || e.day === this.currentDay;
    });

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'All'];

    container.innerHTML = `
      <div class="space-y-6">
        
        <!-- Header -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 class="text-2xl font-black text-slate-900 tracking-tight">Recovery House Schedule &amp; Timetable</h2>
            <p class="text-xs text-slate-500 mt-0.5">Structured daily curriculum, therapy groups, 12-step meetings, and chores</p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <button id="print-timetable-btn" class="px-4 py-2.5 rounded-xl text-xs font-bold btn-decor-secondary flex items-center gap-2">
              <i data-lucide="printer" class="w-4 h-4 text-teal-600"></i>
              <span>Print House Timetable</span>
            </button>
            <button id="add-schedule-event-btn" class="px-4 py-2.5 rounded-xl text-xs font-bold btn-decor-primary flex items-center gap-2">
              <i data-lucide="calendar-plus" class="w-4 h-4"></i>
              <span>Add Timetable Event</span>
            </button>
          </div>
        </div>

        <!-- Day Selector Tabs -->
        <div class="medical-card p-3 flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            ${days.map(d => `
              <button class="day-tab-btn px-4 py-2 rounded-xl text-xs font-bold transition-all ${this.currentDay === d ? 'bg-teal-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
                      data-day="${d}">
                ${d}
              </button>
            `).join('')}
          </div>
          <span class="text-xs text-slate-400 font-semibold px-2">${filteredEvents.length} Scheduled Activities</span>
        </div>

        <!-- Timetable Events Grid / Timeline -->
        <div id="timetable-print-area" class="space-y-3">
          ${filteredEvents.length > 0 ? filteredEvents.map(item => `
            <div class="medical-card p-4 hover:border-teal-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group">
              <div class="flex items-start md:items-center gap-4">
                <!-- Time Badge -->
                <div class="w-28 text-center px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 shrink-0">
                  <span class="block text-xs font-mono font-bold text-teal-800">${item.time}</span>
                  <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">${item.day}</span>
                </div>

                <div>
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${this.getCategoryBadge(item.category)}">
                      ${item.category}
                    </span>
                    <h4 class="text-sm font-bold text-slate-900 group-hover:text-teal-700 transition-colors">${item.title}</h4>
                  </div>
                  <p class="text-xs text-slate-500">${item.notes || 'Routine recovery house event'}</p>
                  <div class="text-[11px] text-slate-400 mt-1 flex items-center gap-3">
                    <span class="flex items-center gap-1"><i data-lucide="map-pin" class="w-3 h-3 text-slate-400"></i> ${item.location}</span>
                    <span class="flex items-center gap-1"><i data-lucide="user" class="w-3 h-3 text-slate-400"></i> ${item.facilitator}</span>
                  </div>
                </div>
              </div>

              <!-- Delete action button -->
              <div class="flex items-center justify-end">
                <button class="text-slate-300 hover:text-rose-600 p-2 rounded-lg hover:bg-rose-50 transition delete-tt-btn" data-event-id="${item.id}" title="Remove event">
                  <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
              </div>
            </div>
          `).join('') : `
            <div class="medical-card p-12 text-center text-slate-400">
              <i data-lucide="calendar" class="w-12 h-12 mx-auto text-slate-300 mb-3"></i>
              <h3 class="text-base font-bold text-slate-700">No Events Scheduled for ${this.currentDay}</h3>
              <p class="text-xs text-slate-500 mt-1">Click "Add Timetable Event" above to schedule house routines.</p>
            </div>
          `}
        </div>

      </div>
    `;

    // Bind Day Tabs
    document.querySelectorAll('.day-tab-btn').forEach(btn => {
      btn.onclick = () => {
        this.currentDay = btn.getAttribute('data-day');
        this.render(container);
      };
    });

    // Add Event
    document.getElementById('add-schedule-event-btn').onclick = () => {
      this.openAddEventModal();
    };

    // Print Timetable
    document.getElementById('print-timetable-btn').onclick = () => {
      window.AppDocs.printElement('timetable-print-area', 'SerenityCare_House_Timetable');
    };

    // Delete Event
    document.querySelectorAll('.delete-tt-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-event-id');
        window.AppModal.confirm('Delete Schedule Event?', 'Are you sure you want to remove this event from the house timetable?', 'Delete Event', 'danger')
          .then(async confirmed => {
            if (confirmed) {
              await window.AppStore.deleteTimetableEvent(id);
            }
          });
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
      case 'Life Skills': return 'badge-medical-emerald';
      default: return 'badge-medical-teal';
    }
  }

  openAddEventModal() {
    const html = `
      <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
        <h3 class="text-lg font-bold text-slate-900">Schedule House Timetable Event</h3>
        <button id="close-tt-modal" class="p-1 text-slate-400 hover:bg-slate-100 rounded-lg">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <form id="new-tt-form" class="space-y-4 text-xs">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Day of Week *</label>
            <select id="tt-day" class="w-full px-3 py-2 rounded-lg border border-slate-200">
              <option value="Monday">Monday</option>
              <option value="Tuesday">Tuesday</option>
              <option value="Wednesday">Wednesday</option>
              <option value="Thursday">Thursday</option>
              <option value="Friday">Friday</option>
              <option value="Saturday">Saturday</option>
              <option value="Sunday">Sunday</option>
            </select>
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Time Slot *</label>
            <input type="text" id="tt-time" required value="09:00 - 10:30" placeholder="E.g., 09:00 - 10:30" class="w-full px-3 py-2 rounded-lg border border-slate-200">
          </div>
        </div>

        <div>
          <label class="block font-bold text-slate-700 mb-1">Activity Title *</label>
          <input type="text" id="tt-title" required placeholder="E.g., 12-Step Big Book Study, Chores Duty" class="w-full px-3 py-2 rounded-lg border border-slate-200">
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Category *</label>
            <select id="tt-cat" class="w-full px-3 py-2 rounded-lg border border-slate-200">
              <option value="Wellness">Wellness &amp; Meditation</option>
              <option value="Therapy">Therapy &amp; Clinical</option>
              <option value="12-Step">12-Step Recovery</option>
              <option value="Medical">Medical &amp; MAR</option>
              <option value="Chores">House Chores</option>
              <option value="Life Skills">Life Skills &amp; Job Prep</option>
              <option value="Recreation">Recreation &amp; Outings</option>
            </select>
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Location *</label>
            <input type="text" id="tt-loc" value="Clinical Room A" placeholder="Dining Hall, Auditorium, Lounge" class="w-full px-3 py-2 rounded-lg border border-slate-200">
          </div>
        </div>

        <div>
          <label class="block font-bold text-slate-700 mb-1">Facilitator / Staff Leader *</label>
          <input type="text" id="tt-fac" value="David K. O'Connor, LCDC" class="w-full px-3 py-2 rounded-lg border border-slate-200">
        </div>

        <div>
          <label class="block font-bold text-slate-700 mb-1">Curriculum Notes &amp; Objectives</label>
          <textarea id="tt-notes" rows="2" placeholder="Focus areas, materials required, attendance requirements..." class="w-full px-3 py-2 rounded-lg border border-slate-200"></textarea>
        </div>

        <div class="pt-4 border-t border-slate-200 flex justify-end gap-3">
          <button type="button" id="cancel-tt-btn" class="px-4 py-2 rounded-xl btn-decor-secondary font-semibold">Cancel</button>
          <button type="submit" class="px-5 py-2 rounded-xl btn-decor-primary font-bold">Add to Timetable</button>
        </div>
      </form>
    `;

    window.AppModal.showCustom(html, 'max-w-lg');

    document.getElementById('close-tt-modal').onclick = () => window.AppModal.close();
    document.getElementById('cancel-tt-btn').onclick = () => window.AppModal.close();

    document.getElementById('new-tt-form').onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="animate-spin inline-block mr-1">⏳</span> Adding...';
      }
      try {
        await window.AppStore.addTimetableEvent({
          day: document.getElementById('tt-day').value,
          time: document.getElementById('tt-time').value.trim(),
          title: document.getElementById('tt-title').value.trim(),
          category: document.getElementById('tt-cat').value,
          location: document.getElementById('tt-loc').value.trim(),
          facilitator: document.getElementById('tt-fac').value.trim(),
          notes: document.getElementById('tt-notes').value.trim()
        });
        window.AppModal.close();
      } catch (err) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Add to Schedule';
        }
        window.AppModal.close();
      }
    };
  }
}

window.TimetableView = TimetableView;
