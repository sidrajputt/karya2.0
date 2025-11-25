import { API } from '../api.js';
import { App } from '../app.js';
import { Utils } from '../utils.js';
import { createIcons, icons } from "https://unpkg.com/lucide@latest/dist/esm/lucide.js";

const state = {
  leads: [],
  lastDoc: null, // For pagination cursor
  loading: false
};

export const LeadsController = {
  init: async () => {
    LeadsController.bindEvents();
    LeadsController.load(); 
  },

  bindEvents: () => {
    document.getElementById('btn-add-student')?.addEventListener('click', () => LeadsController.openModal('Student'));
    document.getElementById('btn-add-other')?.addEventListener('click', () => LeadsController.openModal('Other'));
    document.getElementById('btn-next')?.addEventListener('click', () => LeadsController.load(true));
    document.getElementById('detail-add-note')?.addEventListener('click', LeadsController.modalAddNote);
    document.getElementById('detail-change-status')?.addEventListener('click', LeadsController.modalChangeStatus);
  },

  load: async (isNext = false) => {
    const container = document.getElementById('leads-list-container');
    if (state.loading) return;
    
    // Skeleton Loader
    if (!isNext) {
        container.innerHTML = Array(5).fill(`<div class="bg-white p-4 rounded-lg border mb-3"><div class="h-4 bg-slate-200 rounded w-1/3 skeleton mb-2"></div><div class="h-8 bg-slate-100 rounded skeleton"></div></div>`).join('');
    }
    
    state.loading = true;
    try {
      // Use lastDoc if next page
      const cursor = isNext ? state.lastDoc : null;
      const res = await API.getLeads(App.state.user, cursor, 20);
      
      state.lastDoc = res.lastDoc;
      if (!isNext) state.leads = [];
      state.leads = [...state.leads, ...res.data];
      
      LeadsController.render();
    } catch (e) {
      console.error(e);
      container.innerHTML = `<div class="p-4 text-center text-red-500">Failed to load leads.</div>`;
    }
    state.loading = false;
  },

  render: () => {
    const container = document.getElementById('leads-list-container');
    if (state.leads.length === 0) {
        container.innerHTML = `<div class="text-center py-10 text-slate-400">No leads found.</div>`;
        return;
    }

    container.innerHTML = state.leads.map(l => `
      <div class="bg-white p-4 rounded-lg border shadow-sm mb-3">
        <div class="flex justify-between items-start mb-2">
          <div>
            <span class="text-xs uppercase font-bold bg-slate-100 px-2 py-0.5 rounded">${l.LeadType || 'Gen'}</span>
            <h3 class="font-bold text-lg">${l.Name}</h3>
          </div>
          <span class="text-xs font-bold px-2 py-1 rounded bg-brand-50 text-brand-600 border border-brand-100">${l.Status}</span>
        </div>
        <div class="text-sm text-slate-500 mb-3 flex gap-4">
           <span><i data-lucide="phone" class="w-4 h-4 inline"></i> ${l.Phone}</span>
           <span><i data-lucide="map-pin" class="w-4 h-4 inline"></i> ${l.Route || '-'}</span>
        </div>
        <div class="flex gap-2">
           <a href="tel:${l.Phone}" class="flex-1 py-2 bg-green-50 text-green-700 rounded text-center border border-green-200 font-medium">Call</a>
           <button class="view-btn flex-1 py-2 border rounded font-medium" data-id="${l.LeadID}">View</button>
        </div>
      </div>
    `).join('');

    // Re-bind view buttons
    container.querySelectorAll('.view-btn').forEach(b => {
      b.addEventListener('click', (e) => LeadsController.openDetail(e.currentTarget.dataset.id));
    });
    
    // Pagination visibility
    const nextBtn = document.getElementById('btn-next');
    if(nextBtn) nextBtn.style.display = state.lastDoc ? 'block' : 'none';
    
    createIcons({ icons });
  },

  openDetail: (id) => {
    const l = state.leads.find(x => x.LeadID === id);
    if (!l) return;
    
    document.getElementById('detail-name').innerText = l.Name;
    document.getElementById('detail-meta').innerText = `${l.LeadType} • ${l.Status}`;
    document.getElementById('lead-detail-compact').dataset.leadId = id;
    document.getElementById('lead-detail-compact').classList.remove('hidden');
    
    // Timeline
    const tl = document.getElementById('detail-timeline');
    const events = l.Timeline || [];
    tl.innerHTML = events.length ? events.slice().reverse().map(e => `
        <div class="mb-2 p-2 bg-slate-50 rounded text-sm border">
            <div class="font-semibold text-xs flex justify-between"><span>${e.type.toUpperCase()}</span> <span>${new Date(e.ts).toLocaleDateString()}</span></div>
            <div class="text-slate-700">${e.note}</div>
        </div>
    `).join('') : '<div class="text-sm text-slate-400">No history</div>';
  },

  // MODAL UPGRADE: Replace Prompt
  modalChangeStatus: () => {
    const id = document.getElementById('lead-detail-compact').dataset.leadId;
    if(!id) return;
    const current = state.leads.find(l => l.LeadID === id)?.Status;
    
    const html = `
      <div class="p-6">
        <h3 class="text-lg font-bold mb-4">Update Status</h3>
        <select id="m-status" class="input-std mb-4">
           ${['New','Contacted','In Follow-up','Interested','Converted','Lost'].map(s => `<option value="${s}" ${s===current?'selected':''}>${s}</option>`).join('')}
        </select>
        <button id="btn-save-status" class="w-full bg-brand-600 text-white py-3 rounded-lg font-bold">Update</button>
      </div>
    `;
    Utils.modal.open(html);
    setTimeout(() => {
        document.getElementById('btn-save-status').onclick = async () => {
            const newStatus = document.getElementById('m-status').value;
            const timeline = state.leads.find(l=>l.LeadID===id).Timeline || [];
            timeline.push({ ts: new Date().toISOString(), type: 'status', note: `Changed to ${newStatus}`, actor: App.state.user.Name });
            
            await API.updateLead(id, { Status: newStatus, Timeline: timeline });
            Utils.toast('Status updated');
            Utils.modal.close();
            // Local update to avoid full reload
            const lead = state.leads.find(l=>l.LeadID===id);
            lead.Status = newStatus; lead.Timeline = timeline;
            LeadsController.render();
            LeadsController.openDetail(id);
        };
    }, 50);
  },

  modalAddNote: () => {
    const id = document.getElementById('lead-detail-compact').dataset.leadId;
    if(!id) return;
    const html = `
      <div class="p-6">
        <h3 class="text-lg font-bold mb-4">Add Note</h3>
        <textarea id="m-note" class="input-std mb-4 h-24" placeholder="Enter details..."></textarea>
        <button id="btn-save-note" class="w-full bg-brand-600 text-white py-3 rounded-lg font-bold">Save Note</button>
      </div>
    `;
    Utils.modal.open(html);
    setTimeout(() => {
        document.getElementById('btn-save-note').onclick = async () => {
            const note = document.getElementById('m-note').value;
            if(!note) return;
            const timeline = state.leads.find(l=>l.LeadID===id).Timeline || [];
            timeline.push({ ts: new Date().toISOString(), type: 'note', note: note, actor: App.state.user.Name });
            
            await API.updateLead(id, { Timeline: timeline });
            Utils.toast('Note added');
            Utils.modal.close();
            const lead = state.leads.find(l=>l.LeadID===id);
            lead.Timeline = timeline;
            LeadsController.openDetail(id);
        };
    }, 50);
  },
  
  openModal: async (type) => {
    const settings = await API.getSettings();
    const origins = settings.OriginType || ['School','Coaching'];
    
    const html = `
      <div class="p-6">
         <h2 class="text-xl font-bold mb-4">Add ${type}</h2>
         <form id="form-new-lead" class="space-y-3">
            <input name="Name" placeholder="Full Name" required class="input-std" />
            <input name="Phone" placeholder="Phone (10 digits)" pattern="\\d{10}" required class="input-std" />
            <select name="OriginType" class="input-std">
               <option value="">Select Origin</option>
               ${origins.map(o => `<option value="${o.value||o}">${o.value||o}</option>`).join('')}
            </select>
            ${type === 'Student' ? `<input name="School" placeholder="School Name" class="input-std" />` : ''}
            <input name="Route" placeholder="City / Route" class="input-std" />
            <button type="submit" class="w-full bg-brand-600 text-white py-3 rounded-lg font-bold mt-4">Save Lead</button>
         </form>
      </div>
    `;
    Utils.modal.open(html);
    
    setTimeout(() => {
        document.getElementById('form-new-lead').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const data = Object.fromEntries(fd.entries());
            data.LeadType = type;
            data.Timeline = [{ ts: new Date().toISOString(), type: 'create', note: 'Lead created', actor: App.state.user.Name }];
            
            try {
                await API.addLead(data, App.state.user);
                Utils.toast('Lead Created');
                Utils.modal.close();
                LeadsController.load(); // Reload to show new
            } catch(err) { Utils.toast(err.message, 'error'); }
        };
    }, 100);
  }
};