import { API } from '../api.js';
import { App } from '../app.js';
import { Utils } from '../utils.js';
import { createIcons, icons } from "https://unpkg.com/lucide@latest/dist/esm/lucide.js";

window.Utils = Utils;

const state = {
  leads: [],
  usersMap: {},
  teamsMap: {},
  allTeams: [],
  lastDoc: null,
  filters: { status: '', aura: '', search: '', course: '', route: '', team: '', executive: '' },
  settings: {},
  loading: false,
  pageSize: 20
};

export const LeadsController = {
  init: async () => {
    LeadsController.bindEvents();
    const el = document.getElementById('leads-list-container');
    if (el) el.innerHTML = '<div class="h-full flex flex-col items-center justify-center text-slate-400"><div class="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mb-2"></div><span class="text-xs">Syncing Database...</span></div>';

    try {
      const currentUser = App.state.user;

      // 1. FETCH DATA WITH ROLE-AWARENESS
      // (API.getTeams & API.getUsers are already updated to return filtered lists for Supervisors)
      const [s, u, t] = await Promise.all([
        API.getSettings().catch(() => ({})),
        API.getUsers(currentUser).catch(() => []),
        API.getTeams(currentUser).catch(() => [])
      ]);

      state.settings = s || {};
      state.allTeams = t || [];

      // Map Users & Teams for lookup
      (u || []).forEach(user => state.usersMap[user.id] = user);
      (t || []).forEach(team => state.teamsMap[team.id] = team.Name);

      // Populate Standard Filters
      LeadsController.populateDropdown('filter-course', s.Courses);
      LeadsController.populateDropdown('filter-route', s.Routes);

      // 2. FILTER VISIBILITY & POPULATION
      const role = (currentUser?.Role || '').toLowerCase();

      // 1. Hide Import/Export for non-SuperAdmin
      if (role !== 'superadmin') {
        const btnImport = document.getElementById('btn-import');
        // Remove the container div to get rid of the border/separator
        if (btnImport && btnImport.parentElement) {
          btnImport.parentElement.remove();
        }
      }

      if (role === 'superadmin' || role === 'supervisor') {
        const tEl = document.getElementById('filter-team');
        const eEl = document.getElementById('filter-executive');

        // STRICT FILTER: Only show teams returned by API.getTeams(user)
        if (tEl) {
          tEl.innerHTML = '<option value="">All Teams</option>' + t.map(tm => `<option value="${tm.id}">${tm.Name}</option>`).join('');
          tEl.parentElement.classList.remove('hidden');
        }

        // STRICT FILTER: Only show executives returned by API.getUsers(user)
        // Filter out self (Supervisor) from executive dropdown if desired, or keep all team members
        if (eEl) {
          const executives = u.filter(user => user.Role === 'Executive');
          eEl.innerHTML = '<option value="">All Executives</option>' + executives.map(us => `<option value="${us.id}">${us.Name}</option>`).join('');
        }

        const adminFilters = document.getElementById('admin-filters');
        if (adminFilters) adminFilters.classList.remove('hidden');
      } else {
        // Hide for Executives
        const adminFilters = document.getElementById('admin-filters');
        if (adminFilters) adminFilters.classList.add('hidden');
      }

      await LeadsController.load();
    } catch (e) { console.error(e); }
  },

  populateDropdown: (id, options) => {
    const el = document.getElementById(id);
    if (el && options) el.innerHTML += options.map(o => `<option value="${o}">${o}</option>`).join('');
  },

  bindEvents: () => {
    let timer;
    document.getElementById('lead-search')?.addEventListener('input', (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.filters.search = e.target.value.toLowerCase();
        LeadsController.resetAndLoad();
      }, 500);
    });

    ['filter-status', 'filter-type', 'filter-course', 'filter-route', 'filter-team', 'filter-executive'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', (e) => {
        const key = id.replace('filter-', '');
        state.filters[key] = e.target.value;
        LeadsController.resetAndLoad();
      });
    });

    document.getElementById('page-size-select')?.addEventListener('change', (e) => {
      state.pageSize = parseInt(e.target.value);
      LeadsController.resetAndLoad();
    });

    document.getElementById('btn-next')?.addEventListener('click', () => LeadsController.load(true));
    document.getElementById('btn-add-student')?.addEventListener('click', LeadsController.openStudentModal);
    document.getElementById('btn-add-other')?.addEventListener('click', LeadsController.openOtherModal);
    document.getElementById('btn-export')?.addEventListener('click', LeadsController.openExportModal);
    document.getElementById('btn-import')?.addEventListener('click', LeadsController.openImportModal);
  },

  resetAndLoad: () => {
    state.leads = [];
    state.lastDoc = null;
    const el = document.getElementById('leads-list-container');
    if (el) el.innerHTML = '<div class="py-10 text-center"><div class="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div></div>';
    document.getElementById('btn-next')?.classList.add('hidden');
    LeadsController.load();
  },

  load: async (isNext = false) => {
    if (state.loading) return;
    state.loading = true;

    try {
      const user = App.state.user || { Role: 'Executive', UserID: 'guest' };
      const res = await API.getLeads(user, state.lastDoc, state.pageSize, state.filters);

      if (res && res.data.length > 0) {
        state.lastDoc = res.lastDoc;
        state.leads = isNext ? [...state.leads, ...res.data] : res.data;

        document.getElementById('lead-count-badge').innerText = state.leads.length;
        LeadsController.render();

        const nextBtn = document.getElementById('btn-next');
        if (nextBtn) res.data.length < state.pageSize ? nextBtn.classList.add('hidden') : nextBtn.classList.remove('hidden');
      } else {
        document.getElementById('btn-next')?.classList.add('hidden');
        if (!isNext || state.leads.length === 0) {
          document.getElementById('leads-list-container').innerHTML = `<div class="h-full flex flex-col items-center justify-center text-center text-slate-400"><div class="p-3 bg-slate-100 rounded-full mb-2"><i data-lucide="search-x" class="w-6 h-6"></i></div><p class="text-sm font-medium">No matching leads.</p></div>`;
          createIcons({ icons });
        }
      }
    } catch (err) { console.error(err); }
    state.loading = false;
  },

  render: () => {
    const container = document.getElementById('leads-list-container');
    if (!container) return;
    container.innerHTML = state.leads.map(l => LeadsController.renderCard(l)).join('');
    createIcons({ icons });
  },

  renderCard: (l) => {
    const creator = state.usersMap[l.EnteredBy] || { Name: 'Unknown' };
    const subtext = l.LeadType === 'Student' ? (l.InstituteName || 'No School') : (l.Village ? `${l.Village}` : (l.RouteFrom || 'General'));
    const auraColor = l.LeadAura === 'Hot' ? 'bg-green-100 text-green-700' : l.LeadAura === 'Dead' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700';

    return `
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-blue-400 transition-all cursor-pointer mb-3 group" onclick="LeadsController.handleLeadClick('${l.LeadID}')">
          <div class="flex justify-between items-start mb-2">
              <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600 border border-white shadow-sm">
                      ${(l.Name || '?').charAt(0)}
                  </div>
                  <div>
                      <h3 class="font-bold text-slate-900 text-sm leading-tight group-hover:text-blue-600 transition">${l.Name}</h3>
                      <div class="text-[10px] font-medium text-slate-500 mt-0.5 flex items-center gap-1">
                          <span class="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">${l.LeadType}</span>
                          <span class="truncate max-w-[120px]">${subtext}</span>
                      </div>
                  </div>
              </div>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border border-transparent ${auraColor}">${l.LeadAura || 'New'}</span>
          </div>
          <div class="flex items-center gap-4 mt-3 pt-2 border-t border-slate-50 text-xs text-slate-400">
              <div>Added by ${creator.Name.split(' ')[0]}</div>
              <div class="flex gap-2 ml-auto opacity-60 group-hover:opacity-100 transition">
                  <a href="tel:${l.Phone || l.SarpanchPhone}" onclick="event.stopPropagation()" class="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100"><i data-lucide="phone" class="w-3.5 h-3.5"></i></a>
                  <a href="https://wa.me/${String(l.Phone || l.SarpanchPhone || '').replace(/\D/g, '')}" target="_blank" onclick="event.stopPropagation()" class="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100"><i data-lucide="message-circle" class="w-3.5 h-3.5"></i></a>
              </div>
          </div>
      </div>`;
  },

  handleLeadClick: (id) => {
    if (window.innerWidth < 1024) LeadsController.openMobileDrawer(id);
    else LeadsController.renderDrawerContent(id, 'lead-detail-drawer');
  },

  renderDrawerContent: (id, targetId) => {
    const l = state.leads.find(x => x.LeadID === id);
    if (!l) return;

    const container = document.getElementById(targetId);
    if (targetId === 'lead-detail-drawer') {
      document.getElementById('drawer-placeholder').classList.add('hidden');
      document.getElementById('drawer-content').classList.remove('hidden');
      document.getElementById('drawer-content').classList.add('flex');
    }

    let schoolsHTML = '';
    if (l.OtherType === 'Route' && l.Schools && l.Schools.length > 0) {
      schoolsHTML = `
            <div class="col-span-2 mt-2 border-t border-slate-100 pt-2">
                <label class="text-[10px] uppercase font-bold text-slate-400 mb-2 block">Schools Visited</label>
                <div class="space-y-2">
                    ${l.Schools.map(s => `
                        <div class="text-xs bg-slate-50 p-2 rounded border border-slate-200">
                            <div class="font-bold text-slate-800 flex justify-between">
                                <span>${s.Name}</span>
                                <span class="text-[10px] font-normal bg-white border px-1 rounded">${s.Role}</span>
                            </div>
                            <div class="flex justify-between mt-1 text-slate-500">
                                <span>${s.Person || '-'}</span>
                                <a href="tel:${s.Phone}" class="text-blue-600 font-bold hover:underline">${s.Phone || ''}</a>
                            </div>
                            ${s.Remark ? `<div class="mt-1 text-slate-400 italic border-t border-slate-100 pt-1">"${s.Remark}"</div>` : ''}
                        </div>`).join('')}
                </div>
            </div>`;
    }

    const isStudent = l.LeadType === 'Student';
    const detailsHTML = isStudent ? `
        <div class="grid grid-cols-2 gap-4 text-sm">
            <div><label class="text-[10px] uppercase font-bold text-slate-400">Father</label><div>${l.FatherName || '-'}</div></div>
            <div><label class="text-[10px] uppercase font-bold text-slate-400">DOB</label><div>${l.DOB || '-'}</div></div>
            <div><label class="text-[10px] uppercase font-bold text-slate-400">Class</label><div>${l.Class || '-'}</div></div>
            <div><label class="text-[10px] uppercase font-bold text-slate-400">Stream</label><div>${l.Specialization || '-'}</div></div>
            <div class="col-span-2"><label class="text-[10px] uppercase font-bold text-slate-400">Interested In</label><div class="font-medium text-blue-600">${l.InterestedCourse || '-'}</div></div>
            <div class="col-span-2 border-t border-slate-100 pt-2 mt-2"></div>
            <div class="col-span-2"><label class="text-[10px] uppercase font-bold text-slate-400">Current Institute</label><div class="font-medium text-slate-800">${l.InstituteName || '-'}</div></div>
            <div class="col-span-2"><label class="text-[10px] uppercase font-bold text-slate-400">Address</label><div>${l.Address || '-'}</div></div>
            <div><label class="text-[10px] uppercase font-bold text-slate-400">Source</label><div>${l.DataSource || '-'}</div></div>
        </div>` : `
        <div class="grid grid-cols-2 gap-4 text-sm">
            <div class="col-span-2"><label class="text-[10px] uppercase font-bold text-slate-400">Type</label><div>${l.OtherType}</div></div>
            ${l.OtherType === 'Route' ? `
                <div><label class="text-[10px] uppercase font-bold text-slate-400">Route</label><div>${l.RouteFrom || '-'}</div></div>
                <div><label class="text-[10px] uppercase font-bold text-slate-400">Village</label><div>${l.Village || '-'}</div></div>
                <div><label class="text-[10px] uppercase font-bold text-slate-400">Sarpanch</label><div>${l.SarpanchName || '-'}</div></div>
                <div><label class="text-[10px] uppercase font-bold text-slate-400">Sarpanch Phone</label><div>${l.SarpanchPhone || '-'}</div></div>
                ${schoolsHTML}
            ` : `
                <div class="col-span-2"><label class="text-[10px] uppercase font-bold text-slate-400">Institute</label><div>${l.InstituteType || '-'}</div></div>
                <div class="col-span-2"><label class="text-[10px] uppercase font-bold text-slate-400">Location</label><div>${l.City || '-'}</div></div>
            `}
        </div>`;

    const closeAction = targetId.includes('modal') ? 'Utils.modal.close()' : `document.getElementById('lead-detail-drawer').querySelector('#drawer-content').classList.add('hidden'); document.getElementById('drawer-placeholder').classList.remove('hidden');`;

    const html = `
        <div class="flex flex-col h-full">
            <div class="p-5 bg-slate-50 border-b border-slate-200 flex-shrink-0">
                <div class="flex justify-between items-start mb-4">
                    <div><h2 class="text-lg font-bold text-slate-900">${l.Name}</h2><div class="text-xs text-slate-500">${l.LeadType} • ${new Date(l.CreatedAt).toLocaleDateString()}</div></div>
                    <button onclick="${closeAction}" class="text-slate-400 hover:text-slate-600"><i data-lucide="x" class="w-5 h-5"></i></button>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <select onchange="LeadsController.quickUpdate('${l.LeadID}','Status',this.value)" class="text-xs border border-slate-300 rounded bg-white px-2 py-2 font-bold w-full">
                        ${['New Added', 'Follow Call Done', 'Campus Visited', 'Admission Done'].map(s => `<option ${l.Status === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                    <select onchange="LeadsController.quickUpdate('${l.LeadID}','LeadAura',this.value)" class="text-xs border border-slate-300 rounded bg-white px-2 py-2 font-bold w-full">
                        ${['Hot', 'Mild', 'Cold', 'Dead'].map(s => `<option ${l.LeadAura === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
                <div class="flex bg-slate-200 p-1 rounded-lg mt-3">
                    <button onclick="LeadsController.switchTab('details', '${targetId}')" class="tab-btn-details flex-1 py-1.5 text-xs font-bold rounded-md bg-white shadow text-slate-700 transition">Details</button>
                    <button onclick="LeadsController.switchTab('timeline', '${targetId}')" class="tab-btn-timeline flex-1 py-1.5 text-xs font-bold rounded-md text-slate-500 hover:bg-white/50 transition">Timeline</button>
                </div>
            </div>
            <div class="flex-1 overflow-y-auto p-5 custom-scroll bg-white">
                <div id="tab-details-${targetId}">
                    <div class="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-4">${detailsHTML}</div>
                    <div class="bg-slate-50 border border-slate-100 rounded-xl p-4"><span class="text-[10px] uppercase font-bold text-slate-400 block mb-1">Remark</span><p class="text-sm text-slate-600 italic">"${l.Remark || 'No remarks'}"</p></div>
                </div>
                <div id="tab-timeline-${targetId}" class="hidden">
                    <div class="space-y-0 relative border-l-2 border-slate-100 ml-2 pb-6">
                        ${(l.Timeline || []).slice().reverse().map(t => `<div class="relative pl-6 pb-6 last:pb-0"><div class="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-300"></div><div class="text-xs font-bold text-slate-700 uppercase">${t.type}</div><div class="text-sm text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 mt-1">${t.note}</div><div class="text-[10px] text-slate-400 mt-1">${new Date(t.ts).toLocaleString()}</div></div>`).join('')}
                    </div>
                    <button onclick="LeadsController.addNote('${l.LeadID}')" class="w-full mt-4 py-2 border-2 border-dashed border-slate-200 text-slate-500 font-bold text-xs rounded-xl hover:border-blue-400 hover:text-blue-600 transition">+ Add Note</button>
                </div>
            </div>
        </div>`;

    if (targetId === 'lead-modal-content') { document.getElementById('lead-modal-content').innerHTML = html; }
    else { document.getElementById('drawer-content').innerHTML = html; }
    createIcons({ icons });
  },

  openMobileDrawer: (id) => {
    Utils.modal.open(`<div id="lead-modal-content" class="h-[85vh] bg-white rounded-t-3xl flex flex-col overflow-hidden"></div>`);
    setTimeout(() => LeadsController.renderDrawerContent(id, 'lead-modal-content'), 50);
  },

  switchTab: (tab, targetId) => {
    const root = targetId === 'lead-modal-content' ? document.getElementById('lead-modal-content') : document.getElementById('lead-detail-drawer');
    if (tab === 'details') {
      root.querySelector(`[id^="tab-details"]`).classList.remove('hidden');
      root.querySelector(`[id^="tab-timeline"]`).classList.add('hidden');
      root.querySelector(`.tab-btn-details`).classList.add('bg-white', 'shadow', 'text-slate-700');
      root.querySelector(`.tab-btn-details`).classList.remove('text-slate-500');
      root.querySelector(`.tab-btn-timeline`).classList.remove('bg-white', 'shadow', 'text-slate-700');
      root.querySelector(`.tab-btn-timeline`).classList.add('text-slate-500');
    } else {
      root.querySelector(`[id^="tab-details"]`).classList.add('hidden');
      root.querySelector(`[id^="tab-timeline"]`).classList.remove('hidden');
      root.querySelector(`.tab-btn-timeline`).classList.add('bg-white', 'shadow', 'text-slate-700');
      root.querySelector(`.tab-btn-timeline`).classList.remove('text-slate-500');
      root.querySelector(`.tab-btn-details`).classList.remove('bg-white', 'shadow', 'text-slate-700');
      root.querySelector(`.tab-btn-details`).classList.add('text-slate-500');
    }
  },

  // --- FULLY UPGRADED IMPORT/EXPORT ---

  openExportModal: () => {
    const html = `
        <div class="p-6">
            <h3 class="text-xl font-bold mb-2">Advanced Export</h3>
            <p class="text-xs text-slate-500 mb-6">Select fields to include in your CSV report.</p>
            
            <form id="form-export" class="space-y-4">
                <div class="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <input type="checkbox" id="select-all-cols" onchange="document.querySelectorAll('input[name=cols]').forEach(c => c.checked = this.checked)" checked>
                    <label for="select-all-cols" class="text-xs font-bold uppercase text-blue-600 cursor-pointer">Select All Columns</label>
                </div>
                
                <div class="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm max-h-64 overflow-y-auto custom-scroll pr-2">
                    <div class="col-span-full text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2">Student Data</div>
                    <label class="flex items-center gap-2"><input type="checkbox" name="cols" value="Name" checked> Name</label>
                    <label class="flex items-center gap-2"><input type="checkbox" name="cols" value="Phone" checked> Phone</label>
                    <label class="flex items-center gap-2"><input type="checkbox" name="cols" value="FatherName" checked> Father's Name</label>
                    <label class="flex items-center gap-2"><input type="checkbox" name="cols" value="DOB" checked> DOB</label>
                    <label class="flex items-center gap-2"><input type="checkbox" name="cols" value="Category"> Category</label>
                    <label class="flex items-center gap-2"><input type="checkbox" name="cols" value="Address"> Address</label>
                    <label class="flex items-center gap-2"><input type="checkbox" name="cols" value="Class"> Class</label>
                    <label class="flex items-center gap-2"><input type="checkbox" name="cols" value="Specialization"> Stream</label>
                    <label class="flex items-center gap-2"><input type="checkbox" name="cols" value="InterestedCourse"> Course</label>
                    <label class="flex items-center gap-2"><input type="checkbox" name="cols" value="InstituteName"> Institute</label>
                    
                    <div class="col-span-full text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2">Route Data</div>
                    <label class="flex items-center gap-2"><input type="checkbox" name="cols" value="RouteFrom"> Route</label>
                    <label class="flex items-center gap-2"><input type="checkbox" name="cols" value="Village"> Village</label>
                    <label class="flex items-center gap-2"><input type="checkbox" name="cols" value="SarpanchName"> Sarpanch</label>
                    <label class="flex items-center gap-2"><input type="checkbox" name="cols" value="SarpanchPhone"> Sarpanch Phone</label>
                    <label class="flex items-center gap-2"><input type="checkbox" name="cols" value="SchoolsFormatted" checked> Schools List</label>
                    
                    <div class="col-span-full text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2">System Data</div>
                    <label class="flex items-center gap-2"><input type="checkbox" name="cols" value="Status" checked> Status</label>
                    <label class="flex items-center gap-2"><input type="checkbox" name="cols" value="LeadAura" checked> Aura</label>
                    <label class="flex items-center gap-2"><input type="checkbox" name="cols" value="DataSource"> Source</label>
                    <label class="flex items-center gap-2"><input type="checkbox" name="cols" value="EnteredByName" checked> Executive</label>
                    <label class="flex items-center gap-2"><input type="checkbox" name="cols" value="TeamName"> Team</label>
                    <label class="flex items-center gap-2"><input type="checkbox" name="cols" value="Remark"> Remark</label>
                    <label class="flex items-center gap-2"><input type="checkbox" name="cols" value="CreatedAt"> Date Added</label>
                </div>
                
                <div class="flex gap-2 pt-4 border-t border-slate-100">
                    <button type="button" class="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 text-sm hover:bg-slate-50" onclick="Utils.modal.close()">Cancel</button>
                    <button type="submit" class="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-600/20">Export CSV</button>
                </div>
            </form>
        </div>`;
    Utils.modal.open(html);

    setTimeout(() => {
      document.getElementById('form-export').onsubmit = (e) => {
        e.preventDefault();
        const checkboxes = document.querySelectorAll('input[name="cols"]:checked');
        const columns = Array.from(checkboxes).map(c => c.value);
        LeadsController.downloadCSV(columns);
        Utils.modal.close();
      };
    }, 50);
  },

  downloadCSV: (columns) => {
    const headers = columns.map(c => {
      // Pretty Headers
      if (c === 'EnteredByName') return 'Executive Name';
      if (c === 'SchoolsFormatted') return 'Schools Details';
      if (c === 'InterestedCourse') return 'Course';
      return c;
    }).join(',');

    const rows = state.leads.map(l => {
      // Lookup
      const creator = state.usersMap[l.EnteredBy] || { Name: 'Unknown', TeamID: '' };
      const team = state.allTeams.find(t => t.id === creator.TeamID) || { Name: 'Unassigned' };

      // Inject
      l.EnteredByName = creator.Name;
      l.TeamName = team.Name;

      // Format Schools
      if (l.Schools && Array.isArray(l.Schools)) {
        l.SchoolsFormatted = l.Schools.map(s => `${s.Name} [${s.Person} - ${s.Phone || ''}]`).join('; ');
      } else {
        l.SchoolsFormatted = '';
      }

      return columns.map(c => {
        let val = l[c] || '';
        if (typeof val === 'string') val = val.replace(/"/g, '""').replace(/\n/g, ' ');
        return `"${val}"`;
      }).join(',');
    });

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `leads_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
  },

  openImportModal: () => {
    const html = `<div class="p-6"><h3 class="text-lg font-bold mb-4">Import Leads</h3><div class="p-4 border-2 border-dashed border-slate-300 rounded-xl text-center"><input type="file" id="import-file" accept=".csv" class="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"></div><div class="flex gap-2 mt-4"><button onclick="LeadsController.downloadSampleCSV()" class="flex-1 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600">Download Template</button><button onclick="LeadsController.processImport()" class="flex-1 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold">Upload & Process</button></div></div>`;
    Utils.modal.open(html);
  },

  downloadSampleCSV: () => {
    const headers = "Name,Phone,LeadType,Status,LeadAura,DataSource,FatherName,DOB,Category,Address,InstituteName,Class,Specialization,InterestedCourse,RouteFrom,Village,SarpanchName,SarpanchPhone,Remark";
    const row1 = "Rahul Sharma,9876543210,Student,New Added,Hot,Walk-in,Suresh Sharma,2005-01-01,General,Delhi,DPS School,12th,Science,B.Tech,,,,,Interested in CS";
    const row2 = "Amit Singh,9988776655,Other,Campus Visited,Mild,Referral,,,,,,,,North Zone,Rampur,Vikram Singh,9123456789,Good potential";
    const csv = `${headers}\n${row1}\n${row2}`;
    const link = document.createElement("a");
    link.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
    link.download = "lead_import_template.csv";
    link.click();
  },

  processImport: async () => {
    const fileInput = document.getElementById('import-file');
    if (!fileInput.files.length) return Utils.toast('Select file', 'error');
    const file = fileInput.files[0];
    const text = await file.text();
    const lines = text.split('\n').slice(1).filter(l => l.trim());

    const leads = lines.map(line => {
      // Basic CSV parser (Note: Production apps should use a library like PapaParse for robust quote handling)
      const cols = line.split(',');
      return {
        Name: cols[0], Phone: cols[1], LeadType: cols[2], Status: cols[3], LeadAura: cols[4], DataSource: cols[5],
        FatherName: cols[6], DOB: cols[7], Category: cols[8], Address: cols[9], InstituteName: cols[10],
        Class: cols[11], Specialization: cols[12], InterestedCourse: cols[13],
        RouteFrom: cols[14], Village: cols[15], SarpanchName: cols[16], SarpanchPhone: cols[17], Remark: cols[18]
      };
    });

    try {
      await API.importLeads(leads, App.state.user);
      Utils.toast(`Imported ${leads.length} leads`);
      Utils.modal.close();
      LeadsController.resetAndLoad();
    } catch (e) { Utils.toast('Import failed', 'error'); }
  },

  // --- FORMS ---
  openOtherModal: () => {
    const s = state.settings || {};
    const schoolOptions = (s.SchoolNames || []).map(sc => `<option value="${sc}">${sc}</option>`).join('');

    const html = `
        <div class="p-6 bg-slate-50 h-full flex flex-col">
            <div class="flex justify-between items-center mb-6 flex-shrink-0">
                <div><h3 class="text-xl font-bold text-slate-900">Add Field Visit</h3><p class="text-xs text-slate-500">Log route or institute details.</p></div>
                <button onclick="Utils.modal.close()" class="p-2 hover:bg-slate-200 rounded-full text-slate-500"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>

            <form id="form-lead" class="space-y-5 flex-1 overflow-y-auto pr-2 custom-scroll">
                <div class="bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex">
                    <button type="button" id="type-route" class="flex-1 py-2 text-sm font-bold rounded-lg bg-slate-900 text-white shadow transition" onclick="LeadsController.toggleOtherType('Route')">Route Visit</button>
                    <button type="button" id="type-inst" class="flex-1 py-2 text-sm font-bold rounded-lg text-slate-500 hover:bg-slate-50 transition" onclick="LeadsController.toggleOtherType('Institute')">Institute Partner</button>
                </div>
                <input type="hidden" name="OtherType" id="input-other-type" value="Route">

                <div class="space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div id="contact-fields" class="col-span-2 grid grid-cols-2 gap-4 hidden">
                             <div><label class="label-xs">Contact Name</label><input name="Name" class="input-std font-bold" placeholder="Name"></div>
                             <div><label class="label-xs">Phone</label><input name="Phone" class="input-std font-bold" placeholder="Phone"></div>
                        </div>
                    </div>

                    <div id="sec-route" class="space-y-4 p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                        <div class="flex items-center gap-2 mb-2"><div class="p-1.5 bg-blue-50 text-blue-600 rounded"><i data-lucide="map" class="w-4 h-4"></i></div><span class="text-xs font-bold text-slate-900 uppercase">Route Details</span></div>
                        <select name="RouteFrom" class="input-std"><option value="">Select Assigned Route</option>${(s.Routes || []).map(x => `<option>${x}</option>`).join('')}</select>
                        <div class="grid grid-cols-2 gap-4">
                            <input name="Village" placeholder="Village Name" class="input-std" oninput="LeadsController.autoFillName(this.value)">
                            <input name="SarpanchName" placeholder="Sarpanch Name" class="input-std">
                        </div>
                        <input name="SarpanchPhone" placeholder="Sarpanch Phone" class="input-std">
                    </div>

                    <div id="sec-inst" class="hidden space-y-4 p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                        <select name="InstituteType" class="input-std"><option value="">Institution Type</option>${(s.InstituteType || []).map(x => `<option>${x}</option>`).join('')}</select>
                        <input name="City" placeholder="City / Location" class="input-std">
                    </div>

                    <div><label class="label-xs">Notes</label><textarea name="Remark" placeholder="Observations..." class="input-std h-16 resize-none"></textarea></div>
                </div>

                <div id="schools-wrapper" class="pt-4 border-t border-slate-200">
                    <div class="flex justify-between items-center mb-3">
                        <label class="text-xs font-bold text-slate-500 uppercase tracking-wide">Schools Visited</label>
                        <button type="button" onclick="LeadsController.addSchoolRow()" class="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1"><i data-lucide="plus" class="w-3 h-3"></i> Add School</button>
                    </div>
                    <div id="schools-container" class="space-y-3 empty:hidden"></div>
                    <div id="schools-empty" class="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl"><p class="text-xs text-slate-400">No schools added yet.</p></div>
                </div>

                <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold shadow-lg mt-2 sticky bottom-0 z-10">Save Lead</button>
            </form>
        </div>`;

    Utils.modal.open(html);
    createIcons({ icons });

    window.LeadsController.toggleOtherType = (type) => {
      document.getElementById('input-other-type').value = type;
      const isRoute = type === 'Route';
      document.getElementById('sec-route').classList.toggle('hidden', !isRoute);
      document.getElementById('schools-wrapper').classList.toggle('hidden', !isRoute);
      document.getElementById('sec-inst').classList.toggle('hidden', isRoute);
      document.getElementById('contact-fields').classList.toggle('hidden', isRoute);

      document.getElementById('type-route').className = isRoute ? "flex-1 py-2 text-sm font-bold rounded-lg bg-slate-900 text-white shadow transition" : "flex-1 py-2 text-sm font-bold rounded-lg text-slate-500 hover:bg-slate-50 transition";
      document.getElementById('type-inst').className = !isRoute ? "flex-1 py-2 text-sm font-bold rounded-lg bg-slate-900 text-white shadow transition" : "flex-1 py-2 text-sm font-bold rounded-lg text-slate-500 hover:bg-slate-50 transition";
    };

    window.LeadsController.addSchoolRow = () => {
      document.getElementById('schools-empty').classList.add('hidden');
      const container = document.getElementById('schools-container');
      const div = document.createElement('div');
      div.className = 'grid grid-cols-12 gap-2 p-3 bg-white border border-slate-200 rounded-xl shadow-sm relative animate-float-up group mt-2';
      div.innerHTML = `
            <div class="col-span-12">
                <label class="label-xs">School Name</label>
                <select name="S_Name[]" class="input-std text-xs py-1 px-2 w-full font-bold text-slate-700">
                    <option value="">Select School</option>
                    ${schoolOptions}
                </select>
            </div>
            <div class="col-span-5"><input name="S_Person[]" placeholder="Contact Person" class="input-std text-xs py-1 px-2"></div>
            <div class="col-span-4"><input name="S_Phone[]" placeholder="Phone" class="input-std text-xs py-1 px-2"></div>
            <div class="col-span-3"><select name="S_Role[]" class="input-std text-xs py-1 px-2"><option>Principal</option><option>Teacher</option><option>Admin</option></select></div>
            <div class="col-span-12"><input name="S_Remark[]" placeholder="School specific remark..." class="input-std text-xs py-1 px-2 w-full border-dashed"></div>
            
            <button type="button" onclick="this.closest('.grid').remove(); if(document.getElementById('schools-container').children.length === 0) document.getElementById('schools-empty').classList.remove('hidden');" 
                class="absolute -top-2 -right-2 bg-white text-red-500 border border-slate-200 rounded-full p-1 shadow-md hover:bg-red-50 z-10">
                <i data-lucide="x" class="w-4 h-4"></i>
            </button>`;
      container.appendChild(div);
      createIcons({ icons });
    };

    window.LeadsController.autoFillName = (val) => {
      // Optional: Auto-set Name based on Village if Route
    };

    setTimeout(() => {
      window.LeadsController.toggleOtherType('Route');
      document.getElementById('form-lead').onsubmit = (e) => LeadsController.saveLead(e, 'Other');
    }, 50);
  },

  openStudentModal: () => {
    const s = state.settings || {};
    const html = `<div class="p-5 bg-slate-50 h-full flex flex-col"><div class="flex justify-between items-center mb-4 flex-shrink-0"><h3 class="text-lg font-bold text-slate-900">Add Student</h3><button onclick="Utils.modal.close()" class="text-slate-400"><i data-lucide="x" class="w-5 h-5"></i></button></div><form id="form-lead" class="space-y-3 flex-1 overflow-y-auto pr-2 custom-scroll"><input name="Name" placeholder="Student Name *" class="input-std" required><div class="grid grid-cols-2 gap-3"><input name="Phone" placeholder="Phone *" class="input-std" required><input name="DOB" placeholder="DOB" type="date" class="input-std"></div><input name="FatherName" placeholder="Father Name" class="input-std"><input name="Address" placeholder="Full Address" class="input-std"><div class="grid grid-cols-2 gap-3"><select name="Category" class="input-std"><option value="">Category</option>${(s.Category || []).map(x => `<option>${x}</option>`).join('')}</select><select name="DataSource" class="input-std"><option value="">Source</option>${(s.DataSource || []).map(x => `<option>${x}</option>`).join('')}</select></div><div class="p-3 bg-white rounded-lg border border-slate-200 space-y-2"><p class="text-[10px] font-bold text-slate-400 uppercase">Academic</p><div class="grid grid-cols-2 gap-3"><select name="Class" class="input-std"><option value="">Class</option>${(s.Class || []).map(x => `<option>${x}</option>`).join('')}</select><select name="Specialization" class="input-std"><option value="">Stream</option>${(s.Specialization || []).map(x => `<option>${x}</option>`).join('')}</select></div><select name="InterestedCourse" class="input-std"><option value="">Interested Course</option>${(s.Courses || []).map(x => `<option>${x}</option>`).join('')}</select></div><div class="grid grid-cols-2 gap-3"><select name="LeadAura" class="input-std font-bold"><option value="Hot">🔥 Hot</option><option value="Mild" selected>🙂 Mild</option><option value="Cold">🧊 Cold</option></select><select name="Status" class="input-std"><option>New Added</option><option>Follow Call Done</option></select></div><textarea name="Remark" placeholder="Remarks" class="input-std h-16"></textarea><div class="pt-3 border-t border-slate-200"><label class="text-xs font-bold text-slate-500 block mb-1">Current School / Institute</label><div class="grid grid-cols-1 gap-2"><select name="InstituteType" class="input-std"><option value="">Type</option>${(s.InstituteType || []).map(x => `<option>${x}</option>`).join('')}</select><input name="InstituteName" placeholder="Enter School Name" class="input-std font-bold bg-white"></div></div><button type="submit" class="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg mt-4 mb-2 sticky bottom-0">Save Student</button></form></div>`;
    Utils.modal.open(html);
    createIcons({ icons });
    setTimeout(() => document.getElementById('form-lead').onsubmit = (e) => LeadsController.saveLead(e, 'Student'), 50);
  },

  saveLead: async (e, type) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.innerText = 'Saving...';
    try {
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd.entries());
      data.LeadType = type;
      data.Timeline = [{ ts: new Date().toISOString(), type: 'create', note: 'Lead created', actor: App.state.user.Name }];
      data.EnteredBy = App.state.user.UserID;
      data.TeamID = App.state.user.TeamID || 'Unassigned';

      if (type === 'Other' && data.OtherType === 'Route') {
        if (!data.Name) data.Name = `${data.Village || 'Route'} Visit`;
        if (!data.Phone && data.SarpanchPhone) data.Phone = data.SarpanchPhone;

        const names = fd.getAll('S_Name[]');
        const pers = fd.getAll('S_Person[]');
        const phones = fd.getAll('S_Phone[]');
        const roles = fd.getAll('S_Role[]');
        const remarks = fd.getAll('S_Remark[]');

        data.Schools = names.map((n, i) => ({
          Name: n, Person: pers[i], Phone: phones[i], Role: roles[i], Remark: remarks[i]
        })).filter(s => s.Name);

        delete data['S_Name[]']; delete data['S_Person[]']; delete data['S_Phone[]']; delete data['S_Role[]']; delete data['S_Remark[]'];
      }

      await API.addLead(data, App.state.user);
      Utils.toast('Lead Saved Successfully');
      Utils.modal.close();
      LeadsController.resetAndLoad();
    } catch (err) {
      Utils.toast(err.message, 'error');
      btn.disabled = false; btn.innerText = 'Save Lead';
    }
  },

  quickUpdate: async (id, f, v) => {
    const l = state.leads.find(x => x.LeadID === id);
    const tl = [...(l.Timeline || []), { ts: new Date().toISOString(), type: 'status', note: `${f} updated to ${v}`, actor: App.state.user.Name }];
    await API.updateLead(id, { [f]: v, Timeline: tl });
    l[f] = v; l.Timeline = tl;
    Utils.toast('Updated');
    LeadsController.render();
    if (document.getElementById('lead-detail-drawer')) LeadsController.renderDrawerContent(id, 'lead-detail-drawer');
  },

  addNote: async (id) => {
    const note = prompt("Note:"); if (note) {
      const l = state.leads.find(x => x.LeadID === id);
      const tl = [...(l.Timeline || []), { ts: new Date().toISOString(), type: 'note', note, actor: App.state.user.Name }];
      await API.updateLead(id, { Timeline: tl });
      l.Timeline = tl;
      Utils.toast('Note Added');
      const target = window.innerWidth < 1024 ? 'lead-modal-content' : 'drawer-content';
      LeadsController.renderDrawerContent(id, target);
      setTimeout(() => LeadsController.switchTab('timeline', window.innerWidth < 1024 ? 'lead-modal-content' : 'lead-detail-drawer'), 50);
    }
  }
};
window.LeadsController = LeadsController;