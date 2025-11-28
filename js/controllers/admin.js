import { API } from '../api.js';
import { Utils } from '../utils.js';
import { createIcons, icons } from "https://unpkg.com/lucide@latest/dist/esm/lucide.js";

window.Utils = Utils;

const state = {
   settings: {},
   // Generic keys (Routes & Schools handled separately now)
   keys: [
      { key: 'DataSource', label: 'Lead Sources' },
      { key: 'Category', label: 'Student Categories' },
      { key: 'Class', label: 'Classes / Grades' },
      { key: 'Specialization', label: 'Streams' },
      { key: 'Courses', label: 'Interested Courses' },
      { key: 'InstituteType', label: 'Institute Types' }
   ]
};

export const AdminController = {
   init: async () => {
      await AdminController.loadSettings();

      // Backup Bindings
      document.getElementById('btn-backup')?.addEventListener('click', AdminController.exportBackup);
      document.getElementById('file-restore')?.addEventListener('change', AdminController.importBackup);
   },

   loadSettings: async () => {
      try {
         state.settings = await API.getSettings();
         // Ensure RouteData exists
         if (!state.settings.RouteData) state.settings.RouteData = {};

         AdminController.renderGeneric();
         AdminController.renderRoutes();
      } catch (e) { console.error(e); }
   },

   // --- 1. GENERIC DROPDOWNS ---
   renderGeneric: () => {
      const container = document.getElementById('settings-container');
      if (!container) return;
      container.innerHTML = '';
      const tpl = document.getElementById('tpl-setting-card');

      state.keys.forEach(conf => {
         const card = tpl.content.cloneNode(true);
         const items = state.settings[conf.key] || [];

         card.querySelector('.title-slot').innerText = conf.label;
         card.querySelector('.count-slot').innerText = items.length;

         const list = card.querySelector('.list-slot');
         list.innerHTML = items.map((item, idx) => `
                <div class="group flex justify-between items-center p-2 hover:bg-slate-50 rounded-lg text-sm text-slate-700 border border-transparent hover:border-slate-100 transition">
                    <span class="truncate font-medium pl-1 select-none">${item}</span>
                    <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button onclick="AdminController.editItem('${conf.key}', ${idx})" class="p-1 text-slate-400 hover:text-blue-600 rounded"><i data-lucide="pencil" class="w-3 h-3"></i></button>
                        <button onclick="AdminController.deleteItem('${conf.key}', ${idx})" class="p-1 text-slate-400 hover:text-red-600 rounded"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
                    </div>
                </div>`).join('');

         card.querySelector('.add-form').onsubmit = (e) => {
            e.preventDefault();
            const val = e.target.querySelector('input').value.trim();
            if (val) AdminController.addItem(conf.key, val);
         };
         container.appendChild(card);
      });
      createIcons({ icons });
   },

   // --- 2. ROUTE & SCHOOL MANAGER ---
   renderRoutes: () => {
      const container = document.getElementById('route-manager-container');
      if (!container) return;
      container.innerHTML = '';

      const routeData = state.settings.RouteData || {};
      const routes = Object.keys(routeData);

      if (routes.length === 0) {
         container.innerHTML = '<div class="col-span-full text-center py-10 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">No routes defined. Add one to start linking schools.</div>';
         return;
      }

      routes.forEach(route => {
         const schools = routeData[route] || [];
         const div = document.createElement('div');
         div.className = 'bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col h-80';
         div.innerHTML = `
                <div class="flex justify-between items-center mb-3 pb-2 border-b border-slate-200">
                    <h4 class="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <i data-lucide="map" class="w-4 h-4 text-blue-500"></i> ${route}
                    </h4>
                    <div class="flex gap-1">
                        <button onclick="AdminController.renameRoute('${route}')" class="p-1.5 text-slate-400 hover:text-blue-600 rounded"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                        <button onclick="AdminController.deleteRoute('${route}')" class="p-1.5 text-slate-400 hover:text-red-600 rounded"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                    </div>
                </div>
                
                <div class="flex-1 overflow-y-auto custom-scroll space-y-1 mb-3">
                    ${schools.map((s, idx) => `
                        <div class="group flex justify-between items-center p-1.5 bg-white rounded border border-slate-100 text-xs hover:border-blue-200">
                            <span class="font-medium text-slate-700">${s}</span>
                            <button onclick="AdminController.removeSchool('${route}', ${idx})" class="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100"><i data-lucide="x" class="w-3 h-3"></i></button>
                        </div>
                    `).join('') || '<span class="text-xs text-slate-400 italic">No schools added</span>'}
                </div>

                <form onsubmit="event.preventDefault(); AdminController.addSchool(this, '${route}')" class="flex gap-2">
                    <input name="school" class="flex-1 input-std text-xs py-2 px-3 bg-white" placeholder="Add School..." required>
                    <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg"><i data-lucide="plus" class="w-3.5 h-3.5"></i></button>
                </form>
            `;
         container.appendChild(div);
      });
      createIcons({ icons });
   },

   // --- ROUTE LOGIC ---
   addRoute: async () => {
      const name = prompt("Enter new Route Name:");
      if (name && !state.settings.RouteData[name]) {
         state.settings.RouteData[name] = [];
         await AdminController.saveAll();
      }
   },

   deleteRoute: async (route) => {
      if (confirm(`Delete Route "${route}" and all its linked schools?`)) {
         delete state.settings.RouteData[route];
         await AdminController.saveAll();
      }
   },

   renameRoute: async (oldName) => {
      const newName = prompt("Rename Route to:", oldName);
      if (newName && newName !== oldName) {
         state.settings.RouteData[newName] = state.settings.RouteData[oldName];
         delete state.settings.RouteData[oldName];
         await AdminController.saveAll();
      }
   },

   addSchool: async (form, route) => {
      const val = form.school.value.trim();
      if (val) {
         state.settings.RouteData[route].push(val);
         form.reset();
         await AdminController.saveAll();
      }
   },

   removeSchool: async (route, idx) => {
      state.settings.RouteData[route].splice(idx, 1);
      await AdminController.saveAll();
   },

   // --- GENERIC LOGIC ---
   addItem: async (key, value) => {
      if (!state.settings[key]) state.settings[key] = [];
      if (state.settings[key].includes(value)) return Utils.toast('Exists', 'error');
      state.settings[key].push(value);
      await AdminController.saveAll();
   },

   editItem: async (key, idx) => {
      const old = state.settings[key][idx];
      const val = prompt("Rename:", old);
      if (val && val !== old) {
         state.settings[key][idx] = val;
         await AdminController.saveAll();
      }
   },

   deleteItem: async (key, idx) => {
      if (confirm("Delete option?")) {
         state.settings[key].splice(idx, 1);
         await AdminController.saveAll();
      }
   },

   saveAll: async () => {
      // Sync flattening for legacy support if needed (Schools/Routes lists)
      state.settings.Routes = Object.keys(state.settings.RouteData || {});
      state.settings.SchoolNames = Object.values(state.settings.RouteData || {}).flat();

      try {
         await API.setSettings(state.settings);
         AdminController.loadSettings(); // Refresh UI
         Utils.toast('Settings Updated');
      } catch (e) { Utils.toast('Save failed', 'error'); }
   },

   // --- BACKUP LOGIC ---
   exportBackup: async () => {
      Utils.toast('Generating Full Backup...');
      try {
         const data = await API.createBackup();
         const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
         const url = URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url;
         a.download = `karya_backup_${new Date().toISOString().split('T')[0]}.json`;
         document.body.appendChild(a);
         a.click();
         Utils.toast('Backup Downloaded');
      } catch (e) { console.error(e); Utils.toast('Backup failed', 'error'); }
   },

   importBackup: async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (!confirm("WARNING: This will OVERWRITE existing data with the backup file. Continue?")) {
         e.target.value = '';
         return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
         try {
            const data = JSON.parse(event.target.result);
            Utils.toast('Restoring Database...');
            await API.restoreBackup(data);
            Utils.toast('System Restored Successfully!', 'success');
            setTimeout(() => location.reload(), 1000);
         } catch (err) {
            Utils.toast('Invalid Backup File', 'error');
            console.error(err);
         }
      };
      reader.readAsText(file);
   }
};
window.AdminController = AdminController;