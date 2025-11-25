// js/controllers/admin.js
import { API } from '../api.js';
import { App } from '../app.js';
import { Utils } from '../utils.js';

export const AdminController = {
   init: async () => {
      await AdminController.loadOrigins();
      await AdminController.loadUsers();

      document.getElementById('origin-add')?.addEventListener('click', () => AdminController.addOrigin());
      document.getElementById('refresh-users')?.addEventListener('click', () => AdminController.loadUsers());
      document.getElementById('btn-import')?.addEventListener('click', () => AdminController.importCSV());
      document.getElementById('btn-export-all')?.addEventListener('click', () => AdminController.exportAllLeads());

      const importFile = document.getElementById('import-file');
      if (importFile) importFile.addEventListener('change', (ev) => AdminController.selectedFile = ev.target.files[0]);
   },

   loadOrigins: async () => {
      try {
         const s = await API.getSettings();
         const arr = s?.OriginType || [];
         const list = document.getElementById('origin-list');
         list.innerHTML = '';
         arr.forEach((it, idx) => {
            const v = it.value || it;
            const div = document.createElement('div');
            div.className = 'flex gap-2 items-center';
            div.innerHTML = `<div class="flex-1">${v}</div>
                         <button data-idx="${idx}" class="btn-origin-delete px-2 py-1 border rounded text-sm">Delete</button>`;
            list.appendChild(div);
         });
         // bind delete
         Array.from(list.querySelectorAll('.btn-origin-delete')).forEach(b => {
            b.addEventListener('click', (e) => {
               const idx = parseInt(e.currentTarget.dataset.idx, 10);
               AdminController.deleteOrigin(idx);
            });
         });
      } catch (err) {
         console.error('loadOrigins', err);
      }
   },

   addOrigin: async () => {
      const val = document.getElementById('origin-new').value.trim();
      if (!val) return;
      try {
         const s = await API.getSettings();
         const arr = s?.OriginType || [];
         arr.push({ value: val });
         await API.setSettings({ OriginType: arr });
         Utils.toast('Added');
         document.getElementById('origin-new').value = '';
         AdminController.loadOrigins();
      } catch (err) {
         Utils.toast('Failed to add', 'error');
         console.error(err);
      }
   },

   deleteOrigin: async (idx) => {
      try {
         const s = await API.getSettings();
         const arr = s?.OriginType || [];
         arr.splice(idx, 1);
         await API.setSettings({ OriginType: arr });
         Utils.toast('Deleted');
         AdminController.loadOrigins();
      } catch (err) {
         Utils.toast('Delete failed', 'error');
      }
   },

   loadUsers: async () => {
      try {
         const users = await API.getUsers(); // expects array of user objects
         const el = document.getElementById('users-list');
         el.innerHTML = '';
         users.forEach(u => {
            const div = document.createElement('div');
            div.className = 'flex justify-between items-center';
            div.innerHTML = `<div>
                          <div class="font-semibold">${u.Name || u.name || u.UserID}</div>
                          <div class="text-sm text-slate-500">${u.Role || u.role || ''} • ${u.Email || ''}</div>
                         </div>
                         <div class="flex gap-2">
                           <button data-uid="${u.UserID || u.id || u.uid}" class="btn-reset px-2 py-1 border rounded text-sm">Reset Pw</button>
                         </div>`;
            el.appendChild(div);
         });
         Array.from(el.querySelectorAll('.btn-reset')).forEach(b => {
            b.addEventListener('click', (e) => {
               const uid = e.currentTarget.dataset.uid;
               if (!confirm('Reset password for user?')) return;
               AdminController.resetPw(uid);
            });
         });
      } catch (err) {
         console.error('loadUsers', err);
      }
   },

   resetPw: async (uid) => {
      try {
         await API.resetPassword(uid);
         Utils.toast('Password reset; new password sent to user (or shown).');
      } catch (err) {
         Utils.toast('Reset failed', 'error');
      }
   },

   importCSV: async () => {
      try {
         const file = AdminController.selectedFile;
         if (!file) return Utils.toast('Select CSV first', 'error');
         const text = await file.text();
         // very simple CSV parse: first line headers
         const lines = text.split(/\r?\n/).filter(Boolean);
         const headers = lines.shift().split(',').map(h => h.trim());
         // convert rows -> objects
         const rows = lines.map(line => {
            const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
            const obj = {};
            cols.forEach((c, i) => obj[headers[i]] = cols[i]);
            return obj;
         });
         // call API.importLeads
         await API.importLeads(rows, App.state.user);
         Utils.toast('Import queued/complete');
         AdminController.selectedFile = null;
         document.getElementById('import-file').value = '';
      } catch (err) {
         Utils.toast('Import failed', 'error');
         console.error(err);
      }
   },

   exportAllLeads: async () => {
      try {
         // Ask admin which fields
         const cols = prompt('CSV fields (comma separated)', 'Name,Phone,LeadType,OriginType,Status,School,CreatedAt');
         if (!cols) return;
         await API.exportLeads({ filters: {}, fields: cols.split(',').map(s => s.trim()) }, App.state.user);
         Utils.toast('Export initiated; file will download.');
      } catch (err) {
         Utils.toast('Export failed', 'error');
         console.error(err);
      }
   }
};

window.AdminController = AdminController;
