// js/controllers/leads.js
import { API } from '../api.js';
import { App } from '../app.js';
import { Utils } from '../utils.js';
import { createIcons, icons } from "https://unpkg.com/lucide@latest/dist/esm/lucide.js";

const state = {
  allData: [],
  filteredData: [],
  page: 1,
  limit: 20,
  filters: { search: "", status: "", type: "", origin: "" },
  originOptions: []
};

export const LeadsController = {

  init: async () => {
    try {
      await LeadsController.loadSettings();
      await LeadsController.load();

      // bind UI
      document.getElementById('lead-search')?.addEventListener('input', (e) => LeadsController.handleSearch(e.target.value));
      document.getElementById('btn-toggle-filters')?.addEventListener('click', LeadsController.toggleFilters);
      document.getElementById('btn-apply-filters')?.addEventListener('click', LeadsController.applyFilters);
      document.getElementById('btn-clear-filters')?.addEventListener('click', LeadsController.clearFilters);
      document.getElementById('btn-prev')?.addEventListener('click', () => LeadsController.changePage(-1));
      document.getElementById('btn-next')?.addEventListener('click', () => LeadsController.changePage(1));
      document.getElementById('btn-add-student')?.addEventListener('click', () => LeadsController.openModal('Student'));
      document.getElementById('btn-add-other')?.addEventListener('click', () => LeadsController.openModal('Other'));
      document.getElementById('per-page')?.addEventListener('change', (e) => {
        state.limit = parseInt(e.target.value, 10) || 20; state.page = 1; LeadsController.renderList();
      });

      document.getElementById('btn-export-csv')?.addEventListener('click', () => LeadsController.exportCSV());

      document.getElementById('detail-add-note')?.addEventListener('click', () => LeadsController.promptAddNote());
      document.getElementById('detail-change-status')?.addEventListener('click', () => LeadsController.promptChangeStatus());

      LeadsController.populateFilterDropdowns();
    } catch (err) {
      console.error('LeadsController.init error', err);
    }
  },

  // load admin-configured dropdowns (OriginType etc)
  loadSettings: async () => {
    try {
      const settings = await API.getSettings();
      const origins = settings?.OriginType || settings?.Origin || [];
      state.originOptions = Array.isArray(origins) ? origins.map(i => (i.value || i)) : ['School', 'Institute', 'Coaching Centre', 'Club'];
      // populate filter-origin
      const fo = document.getElementById('filter-origin');
      if (fo) {
        fo.innerHTML = `<option value="">Any Origin</option>` + state.originOptions.map(o => `<option value="${o}">${o}</option>`).join('');
      }
    } catch (e) {
      console.warn('Failed to load settings', e);
      state.originOptions = ['School', 'Institute', 'Coaching Centre', 'Club'];
    }
  },

  // load leads using API; API handles backend role filters optionally, but we apply client-side rules also
  load: async () => {
    const container = document.getElementById('leads-list-container');
    if (container) container.innerHTML = `<div class="text-center py-10 text-slate-400">Fetching data...</div>`;
    try {
      const leads = await API.getLeads(App.state.user);
      state.allData = Array.isArray(leads) ? leads : [];
      LeadsController.applyFilters();
    } catch (e) {
      if (container) container.innerHTML = `<div class="text-red-500 text-center py-10">Error loading leads</div>`;
      console.error('API.getLeads error', e);
    }
  },

  handleSearch: (val) => {
    state.filters.search = (val || '').toLowerCase();
    LeadsController.applyFilters();
  },

  toggleFilters: () => {
    const el = document.getElementById('filter-panel');
    if (el) el.classList.toggle('hidden');
  },

  populateFilterDropdowns: () => {
    const statusEl = document.getElementById('filter-status');
    const statuses = ['', 'New', 'Contacted', 'In Follow-up', 'Interested', 'Application Submitted', 'Converted', 'Not Interested', 'Lost'];
    if (statusEl) statusEl.innerHTML = statuses.map(s => `<option value="${s}">${s || 'All Statuses'}</option>`).join('');
  },

  applyFilters: () => {
    state.filters.status = document.getElementById('filter-status')?.value || "";
    state.filters.type = document.getElementById('filter-type')?.value || "";
    state.filters.origin = document.getElementById('filter-origin')?.value || "";

    const s = state.filters.search;
    const role = App.state.user?.Role || App.state.user?.role || 'Employee';
    const uid = App.state.user?.UserID || App.state.user?.UserId || App.state.user?.id || App.state.user?.uid || null;

    // Filter + role-aware visibility
    state.filteredData = state.allData.filter(l => {
      // role visibility: super admin sees all, supervisor sees own team & assigned, employee sees only assigned
      if (role === 'Employee') {
        if (String(l.AssignedTo || l.assignedTo || '') !== String(uid)) return false;
      } else if (role === 'Supervisor') {
        // supervisor sees leads where SupervisorId==uid OR AssignedTo==uid OR AssignedTo is in team
        if (l.SupervisorId && String(l.SupervisorId) === String(uid)) { /* allowed */ }
        else if (String(l.AssignedTo || l.assignedTo || '') === String(uid)) { /* allowed */ }
        else if (l.Team && Array.isArray(l.Team) && l.Team.includes(uid)) { /* allowed */ }
        else {
          // default: include all for supervisor if you want; currently we restrict
          // change behavior by removing this block if supervisor should see all.
          return false;
        }
      }

      // search
      const name = (l.Name || l.Title || '').toString().toLowerCase();
      const phone = (l.Phone || l.Mobile || '').toString();
      const route = (l.Route || l.VillageCity || '').toString().toLowerCase();
      const matchSearch = !s || name.includes(s) || phone.includes(s) || route.includes(s);

      const matchStatus = !state.filters.status || String(l.Status || '') === state.filters.status;
      const matchType = !state.filters.type || String(l.LeadType || '') === state.filters.type;
      const matchOrigin = !state.filters.origin || String(l.OriginType || l.Source || '') === state.filters.origin;

      return matchSearch && matchStatus && matchType && matchOrigin;
    });

    state.page = 1;
    LeadsController.renderList();
  },

  clearFilters: () => {
    state.filters = { search: "", status: "", type: "", origin: "" };
    document.getElementById('filter-status').value = "";
    document.getElementById('filter-type').value = "";
    document.getElementById('filter-origin').value = "";
    document.getElementById('lead-search').value = "";
    LeadsController.applyFilters();
  },

  renderList: () => {
    const container = document.getElementById('leads-list-container');
    const pagination = document.getElementById('pagination-controls');
    if (!container) return;

    const total = state.filteredData.length;
    if (total === 0) {
      container.innerHTML = `<div class="text-center py-16 text-slate-400">No leads found.</div>`;
      if (pagination) pagination.classList.add('hidden');
      return;
    }

    const start = (state.page - 1) * state.limit;
    const end = Math.min(start + state.limit, total);
    const pageData = state.filteredData.slice(start, end);

    container.innerHTML = pageData.map(l => {
      const leadType = l.LeadType || (l.Type || 'General');
      const status = l.Status || 'New';
      const routeOrCity = l.Route || l.VillageCity || '-';
      const phone = l.Phone || l.Mobile || '-';
      const id = l.LeadID || l.LeadId || l.id || l._id || '';

      return `
      <div class="bg-white p-4 rounded-lg border shadow-sm mb-3">
        <div class="flex justify-between items-start mb-2">
          <div>
            <span class="text-xs uppercase font-bold bg-slate-100 px-2 py-0.5 rounded">${leadType}</span>
            <h3 class="font-bold text-lg">${l.Name || l.Title || 'No Name'}</h3>
          </div>
          <span class="text-xs font-bold px-2 py-1 rounded bg-slate-100">${status}</span>
        </div>
        <div class="text-sm text-slate-500 mb-3 flex gap-4">
           <span><i data-lucide="map-pin" class="w-4 h-4 inline"></i> ${routeOrCity}</span>
           <span><i data-lucide="phone" class="w-4 h-4 inline"></i> ${phone}</span>
        </div>
        <div class="flex gap-2">
           <a href="tel:${phone}" class="flex-1 py-2 bg-green-50 border border-green-100 text-green-700 rounded text-center">Call</a>
           <a href="https://wa.me/${String(phone).replace(/\D/g, '')}" target="_blank" class="flex-1 py-2 bg-green-600 text-white rounded text-center">WhatsApp</a>
           <button class="view-btn flex-1 py-2 border rounded" data-id="${id}">View</button>
        </div>
      </div>
      `;
    }).join('');

    // pagination update
    if (pagination) pagination.classList.remove('hidden');
    const pageCount = Math.max(1, Math.ceil(total / state.limit));
    document.getElementById('page-info').innerText = `Page ${state.page} of ${pageCount}`;
    document.getElementById('btn-prev').disabled = state.page === 1;
    document.getElementById('btn-next').disabled = state.page >= pageCount;

    // attach handlers
    container.querySelectorAll('.view-btn').forEach(b => {
      b.addEventListener('click', (ev) => {
        const id = ev.currentTarget.dataset.id;
        if (id) LeadsController.openLeadDetail(id);
      });
    });

    try { createIcons({ icons }); } catch (e) { }
  },

  changePage: (delta) => {
    state.page = Math.max(1, state.page + delta);
    LeadsController.renderList();
    document.getElementById('leads-list-container')?.scrollIntoView({ behavior: 'smooth' });
  },

  openModal: (type) => {
    // inject template into modal-content and open with Utils.modal
    const tplId = type === 'Student' ? 'tpl-student' : 'tpl-other';
    const tpl = document.getElementById(tplId);
    if (!tpl) { Utils.toast('Template not found: ' + tplId, 'error'); return; }
    const content = document.getElementById('modal-content');
    content.innerHTML = tpl.innerHTML;

    // populate form dropdowns incl origin
    LeadsController.populateFormDropdowns(type);

    Utils.modal.open();
    const form = document.getElementById('form-lead');
    if (form) form.onsubmit = (e) => LeadsController.handleSave(e, type);
  },

  populateFormDropdowns: (type) => {
    API.getSettings().then(settings => {
      const fill = (sel, cat) => {
        const els = Array.from(document.querySelectorAll(sel));
        const items = settings[cat] || [];
        const opts = `<option value="">Select</option>` + items.map(i => `<option value="${i.value || i}">${i.value || i}</option>`).join('');
        els.forEach(el => el.innerHTML = opts);
      };

      fill('.dd-school', 'School');
      fill('.dd-class', 'Class');
      fill('.dd-course', 'Course');
      fill('.dd-source', 'DataSource');

      // origin
      const origins = settings['OriginType'] || settings['Origin'] || [];
      const originOpts = `<option value="">Select origin</option>` + (origins.length ? origins.map(i => `<option value="${i.value || i}">${i.value || i}</option>`).join('') : ['School', 'Institute', 'Coaching Centre', 'Club'].map(o => `<option value="${o}">${o}</option>`).join(''));
      const originEls = Array.from(document.querySelectorAll('.dd-origin, select[name="OriginType"], #m_originType'));
      originEls.forEach(el => el.innerHTML = originOpts);
    }).catch(err => {
      console.warn('populateFormDropdowns', err);
    });
  },

  handleSave: async (e, type) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]') || e.target.querySelector('button');
    if (btn) { btn.disabled = true; btn.innerText = 'Saving...'; }
    try {
      const formData = Object.fromEntries(new FormData(e.target).entries());
      const payload = {
        Name: formData.Name || formData.name || '',
        Phone: formData.Phone || formData.phone || formData.mobile || '',
        LeadType: type === 'Student' ? 'Student' : (formData.LeadType || type || 'Other'),
        Status: formData.Status || 'New',
        OriginType: formData.OriginType || formData.origin || '',
        Route: formData.Route || '',
        School: formData.School || formData.SchoolName || '',
        Class: formData.Class || formData.class || '',
        Notes: formData.Notes || ''
      };

      // simple validation
      if (!payload.Name || !payload.Phone) throw new Error('Name and Phone required');
      await API.addLead(payload, App.state.user);
      Utils.toast('Lead added');
      Utils.modal.close();
      await LeadsController.load();
    } catch (err) {
      Utils.toast(err.message || 'Could not save', 'error');
      console.error('handleSave', err);
    } finally {
      if (btn) { btn.disabled = false; btn.innerText = 'Save'; }
    }
  },

  openLeadDetail: async (leadId) => {
    try {
      const l = state.allData.find(x => String(x.LeadID || x.LeadId || x.id || x._id || '') === String(leadId));
      if (!l) {
        // optional: fetch single lead from API
        const single = await API.getLeadById(leadId);
        if (single) { state.allData.push(single); }
      }
      const lead = state.allData.find(x => String(x.LeadID || x.LeadId || x.id || x._id || '') === String(leadId));
      if (!lead) return;

      // populate compact panel
      document.getElementById('detail-name').innerText = lead.Name || lead.Title || 'No name';
      document.getElementById('detail-meta').innerText = `${lead.LeadType || '-'} • ${lead.Status || '-'} • ${lead.OriginType || lead.Source || '-'}`;

      const timelineEl = document.getElementById('detail-timeline');
      timelineEl.innerHTML = '';
      const events = Array.isArray(lead.Timeline) ? lead.Timeline : (Array.isArray(lead.Notes) ? lead.Notes : []);
      if (!events.length && (lead.NotesText || lead.NotesPlain)) {
        timelineEl.innerHTML = `<div class="text-sm text-slate-500">${lead.NotesText || lead.NotesPlain}</div>`;
      } else if (!events.length) {
        timelineEl.innerHTML = `<div class="text-sm text-slate-500">No timeline yet</div>`;
      } else {
        timelineEl.innerHTML = events.slice().reverse().map(ev => {
          if (typeof ev === 'string') return `<div class="p-2 border rounded">${ev}</div>`;
          const when = ev.ts ? new Date(ev.ts).toLocaleString() : '';
          return `<div class="p-2 border rounded">
                    <div class="text-xs font-semibold">${ev.type || 'Note'} ${ev.actor ? ' • ' + ev.actor : ''}</div>
                    <div class="text-sm">${ev.note || ev.text || ''}</div>
                    <div class="text-xs text-slate-400">${when}</div>
                  </div>`;
        }).join('');
      }

      document.getElementById('lead-detail-compact').classList.remove('hidden');
      document.getElementById('detail-stats')?.classList.remove('hidden');

      // set stats
      document.getElementById('detail-created').innerText = lead.CreatedAt ? new Date(lead.CreatedAt).toLocaleString() : '-';
      const last = Array.isArray(lead.Timeline) && lead.Timeline.length ? lead.Timeline[lead.Timeline.length - 1] : null;
      document.getElementById('detail-last-activity').innerText = last ? new Date(last.ts).toLocaleString() : '-';
      const followups = (lead.Timeline || []).filter(it => it.type === 'followup').length;
      document.getElementById('detail-followups').innerText = String(followups);

      // store current lead id on panel
      document.getElementById('lead-detail-compact').dataset.leadId = lead.LeadID || lead.LeadId || lead.id || lead._id || '';
    } catch (err) {
      console.error('openLeadDetail', err);
    }
  },

  promptAddNote: async () => {
    try {
      const panel = document.getElementById('lead-detail-compact');
      if (!panel || !panel.dataset.leadId) return Utils.toast('Select a lead first', 'error');
      const leadId = panel.dataset.leadId;
      const txt = prompt('Add note / follow-up text:');
      if (!txt) return;
      const lead = state.allData.find(l => String(l.LeadID || l.LeadId || l.id || '') === String(leadId));
      const timeline = Array.isArray(lead.Timeline) ? [...lead.Timeline] : [];
      const ev = { ts: new Date().toISOString(), actor: App.state.user?.Name || App.state.user?.UserID || '', type: 'note', note: txt };
      timeline.push(ev);
      await API.updateLead(leadId, { Timeline: timeline });
      lead.Timeline = timeline;
      LeadsController.openLeadDetail(leadId);
      Utils.toast('Note saved');
    } catch (err) {
      Utils.toast('Save failed', 'error');
      console.error(err);
    }
  },

  promptChangeStatus: async () => {
    try {
      const panel = document.getElementById('lead-detail-compact');
      if (!panel || !panel.dataset.leadId) return Utils.toast('Select a lead first', 'error');
      const leadId = panel.dataset.leadId;
      const ns = prompt('New status (New / Contacted / In Follow-up / Interested / Application Submitted / Converted / Not Interested / Lost):');
      if (!ns) return;
      const lead = state.allData.find(l => String(l.LeadID || l.LeadId || l.id || '') === String(leadId));
      const timeline = Array.isArray(lead.Timeline) ? [...lead.Timeline] : [];
      const ev = { ts: new Date().toISOString(), actor: App.state.user?.Name || App.state.user?.UserID || '', type: 'status', note: `Status -> ${ns}` };
      timeline.push(ev);
      await API.updateLead(leadId, { Status: ns, Timeline: timeline });
      lead.Status = ns;
      lead.Timeline = timeline;
      LeadsController.openLeadDetail(leadId);
      LeadsController.applyFilters();
      Utils.toast('Status updated');
    } catch (err) {
      Utils.toast('Update failed', 'error');
      console.error(err);
    }
  },

  // simple CSV export using current filters
  exportCSV: async () => {
    try {
      const keys = prompt('Comma-separated fields for CSV (example: Name,Phone,LeadType,OriginType,Status,School,CreatedAt):', 'Name,Phone,LeadType,OriginType,Status,School,CreatedAt');
      if (!keys) return;
      const cols = keys.split(',').map(s => s.trim()).filter(Boolean);
      const rows = state.filteredData; // using filtered list; could call API for server-side export
      const csv = [cols.join(',')].concat(rows.map(r => cols.map(c => {
        const v = r[c] ?? r[c.replace(/\s+/g, '')] ?? '';
        if (v === null || v === undefined) return '';
        return `"${String(v).replace(/"/g, '""')}"`;
      }).join(',')).join('\n'));
      const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `leads_export_${Date.now()}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      Utils.toast('Export failed', 'error');
      console.error('exportCSV', err);
    }
  }
};

window.LeadsController = LeadsController;
