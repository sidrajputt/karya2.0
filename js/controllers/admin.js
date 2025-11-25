import { API } from '../api.js';
import { App } from '../app.js';
import { Utils } from '../utils.js';

export const AdminController = {
   init: async () => {
      await AdminController.loadOrigins();
      await AdminController.loadUsers();

      document.getElementById('origin-add')?.addEventListener('click', AdminController.addOrigin);
      document.getElementById('btn-import')?.addEventListener('click', AdminController.importCSV);
      document.getElementById('import-file')?.addEventListener('change', (ev) => AdminController.selectedFile = ev.target.files[0]);
   },

   loadOrigins: async () => {
      const s = await API.getSettings();
      const arr = s?.OriginType || [];
      const list = document.getElementById('origin-list');
      list.innerHTML = arr.map((it, i) => `
        <div class="flex justify-between items-center p-2 border rounded mb-1">
            <span>${it.value || it}</span>
            <button class="text-red-500 text-sm" onclick="AdminController.delOrigin(${i})">Delete</button>
        </div>`).join('');
      // Note: Inline onclick needs global scope or re-bind. For safety, re-bind:
      // (Simplified for brevity, strictly you should use addEventListener)
   },

   addOrigin: async () => {
      const val = document.getElementById('origin-new').value.trim();
      if (!val) return;
      const s = await API.getSettings();
      const arr = s?.OriginType || [];
      arr.push({ value: val });
      await API.setSettings({ OriginType: arr });
      Utils.toast('Origin Added');
      AdminController.loadOrigins();
   },

   loadUsers: async () => {
      const users = await API.getUsers();
      document.getElementById('users-list').innerHTML = users.map(u => `
        <div class="p-3 border rounded mb-2 flex justify-between">
           <div><div class="font-bold">${u.Name}</div><div class="text-xs text-slate-500">${u.Role}</div></div>
           <button class="text-blue-600 text-xs" onclick="alert('Resetting ${u.Name}...')">Reset Pw</button>
        </div>
      `).join('');
   },

   importCSV: async () => {
      if (!AdminController.selectedFile) return Utils.toast('Select CSV', 'error');
      const text = await AdminController.selectedFile.text();
      const rows = text.split('\n').slice(1).map(r => {
         const c = r.split(',');
         return { Name: c[0], Phone: c[1], LeadType: c[2] };
      }).filter(x => x.Name);
      await API.importLeads(rows, App.state.user);
      Utils.toast('Import queued');
   }
};
window.AdminController = AdminController; // Expose for onclicks if needed