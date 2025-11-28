import { API } from '../api.js';
import { App } from '../app.js';
import { Utils } from '../utils.js';
import { createIcons, icons } from "https://unpkg.com/lucide@latest/dist/esm/lucide.js";

window.Utils = Utils;

const state = {
    users: [],
    teams: [],
    filters: { search: '', role: '', team: '' }
};

export const UsersController = {
    init: async () => {
        await UsersController.loadData();
        UsersController.bindEvents();
    },

    bindEvents: () => {
        document.getElementById('btn-add-user')?.addEventListener('click', () => UsersController.openUserModal());

        document.getElementById('user-search')?.addEventListener('input', (e) => {
            state.filters.search = e.target.value.toLowerCase();
            UsersController.render();
        });

        ['filter-role', 'filter-team'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', (e) => {
                const key = id.replace('filter-', '');
                state.filters[key] = e.target.value;
                UsersController.render();
            });
        });
    },

    loadData: async () => {
        try {
            const currentUser = App.state.user;
            const [u, t] = await Promise.all([
                API.getUsers(currentUser),
                API.getTeams(currentUser)
            ]);
            state.users = u;
            state.teams = t;

            const teamSelect = document.getElementById('filter-team');
            if (teamSelect) teamSelect.innerHTML = '<option value="">All Teams</option>' + t.map(tm => `<option value="${tm.id}">${tm.Name}</option>`).join('');

            UsersController.render();
        } catch (e) { console.error(e); }
    },

    render: () => {
        const container = document.getElementById('users-list-container');
        if (!container) return;

        const filtered = state.users.filter(u => {
            const s = state.filters.search;
            const matchSearch = !s || (u.Name && u.Name.toLowerCase().includes(s)) || (u.Email && u.Email.toLowerCase().includes(s));
            const matchRole = !state.filters.role || u.Role === state.filters.role;
            const matchTeam = !state.filters.team || u.TeamID === state.filters.team;
            return matchSearch && matchRole && matchTeam;
        });

        document.getElementById('user-count').innerText = `${filtered.length} Active Members`;

        if (filtered.length === 0) {
            container.innerHTML = `<div class="p-10 text-center text-slate-400 text-sm">No users found matching criteria.</div>`;
            return;
        }

        container.innerHTML = filtered.map(u => UsersController.renderUserRow(u)).join('');
        createIcons({ icons });
    },

    renderUserRow: (u) => {
        const team = state.teams.find(t => t.id === u.TeamID);
        const teamName = team ? team.Name : (u.Role === 'Executive' ? 'Unassigned' : '-');
        const isActive = u.Status !== 'Inactive';

        // Permissions
        const currentUser = App.state.user;
        const isSuperAdmin = currentUser.Role === 'SuperAdmin';
        const canEdit = isSuperAdmin || (currentUser.Role === 'Supervisor' && u.Role === 'Executive');
        const canDelete = isSuperAdmin;
        const badgeColor = u.Role === 'SuperAdmin' ? 'bg-purple-100 text-purple-700' : u.Role === 'Supervisor' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700';

        // Actions HTML
        let actionsHtml = '';
        if (canEdit) actionsHtml += `<button onclick="UsersController.resetPassword('${u.id}')" class="p-2 bg-slate-100 text-slate-500 rounded hover:bg-yellow-100 hover:text-yellow-700 transition" title="Reset Password"><i data-lucide="key" class="w-4 h-4"></i></button>`;
        if (canEdit && isSuperAdmin) actionsHtml += `<button onclick="UsersController.openUserModal('${u.id}')" class="p-2 bg-slate-100 text-slate-500 rounded hover:bg-blue-100 hover:text-blue-600 transition" title="Edit"><i data-lucide="pencil" class="w-4 h-4"></i></button>`;
        if (canDelete) actionsHtml += `<button onclick="UsersController.promptDelete('${u.id}')" class="p-2 bg-slate-100 text-slate-500 rounded hover:bg-red-100 hover:text-red-600 transition" title="Delete"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`;

        // Status HTML
        const statusHtml = isSuperAdmin ?
            `<button onclick="UsersController.toggleStatus('${u.id}', '${u.Status}')" class="px-3 py-1 rounded-full text-[10px] font-bold border transition ${isActive ? 'bg-green-50 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-600' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-green-50 hover:text-green-600'}">${isActive ? 'ACTIVE' : 'INACTIVE'}</button>` :
            `<span class="px-3 py-1 rounded-full text-[10px] font-bold border ${isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-500 border-slate-200'}">${isActive ? 'ACTIVE' : 'INACTIVE'}</span>`;

        return `
        <div class="group p-4 md:px-6 md:py-3 hover:bg-slate-50 transition border-b border-slate-50 flex flex-col md:flex-row md:items-center gap-3 md:gap-0 cursor-pointer relative" onclick="UsersController.openProfile('${u.id}')">
            <div class="w-full md:w-1/3 flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-sm border border-slate-200 shadow-sm">${(u.Name || '?').charAt(0)}</div>
                <div><div class="font-bold text-slate-900 text-sm">${u.Name}</div><div class="text-xs text-slate-500">${u.Email}</div></div>
            </div>
            <div class="w-full md:w-1/6 flex md:block items-center justify-between"><span class="md:hidden text-xs font-bold text-slate-400">Role:</span><span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${badgeColor}">${u.Role}</span></div>
            <div class="w-full md:w-1/6 flex md:block items-center justify-between"><span class="md:hidden text-xs font-bold text-slate-400">Team:</span><span class="text-sm text-slate-600">${teamName}</span></div>
            <div class="w-full md:w-1/6 text-center flex md:block items-center justify-between" onclick="event.stopPropagation()"><span class="md:hidden text-xs font-bold text-slate-400">Access:</span>${statusHtml}</div>
            <div class="w-full md:w-1/6 flex justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition" onclick="event.stopPropagation()">
                ${actionsHtml}
            </div>
        </div>`;
    },

    // --- PROFILE DRAWER ---
    openProfile: async (id) => {
        const u = state.users.find(x => x.id === id);
        if (!u) return;

        const isMobile = window.innerWidth < 1024;
        const drawer = document.getElementById('user-detail-drawer');

        // Open UI
        if (isMobile) {
            Utils.modal.open(`<div id="user-modal-content" class="h-[85vh] bg-white rounded-t-3xl flex flex-col overflow-hidden"></div>`);
        } else {
            drawer.classList.remove('hidden');
            document.getElementById('drawer-placeholder').classList.add('hidden');
            document.getElementById('drawer-content').classList.remove('hidden');
            document.getElementById('drawer-content').classList.add('flex');
        }

        const targetId = isMobile ? 'user-modal-content' : 'drawer-content';
        const container = document.getElementById(targetId);
        container.innerHTML = '<div class="p-10 text-center text-slate-400">Loading Profile...</div>';

        // Fetch Data
        const [stats, leads] = await Promise.all([
            API.getUserStats(id).catch(() => ({ total: 0, converted: 0, hot: 0, byStatus: {} })),
            API.getUserLeads(id).catch(() => []) // Fetches top 20 recent
        ]);

        // FIX: Correct Close Action based on mode
        const closeAction = isMobile ? `Utils.modal.close()` : `document.getElementById('drawer-content').classList.add('hidden');document.getElementById('drawer-placeholder').classList.remove('hidden');`;

        // Admin Export Button
        const isSuperAdmin = App.state.user?.Role === 'SuperAdmin';
        const exportBtn = isSuperAdmin ? `
            <button onclick="UsersController.downloadUserLeads('${u.id}')" class="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-lg hover:bg-black transition flex items-center justify-center gap-2">
                <i data-lucide="download-cloud" class="w-4 h-4"></i> Export Leads (CSV)
            </button>` : '';

        // Status Breakdown
        const statusHTML = Object.entries(stats.byStatus || {}).map(([k, v]) => `
            <div class="flex justify-between text-xs py-1 border-b border-slate-100 last:border-0"><span class="text-slate-500">${k}</span><span class="font-bold text-slate-800">${v}</span></div>
        `).join('') || '<div class="text-xs text-slate-400">No data</div>';

        // Leads List
        const leadsHTML = leads.length ? leads.map(l => `
            <div class="flex justify-between items-center p-3 border border-slate-100 rounded-lg hover:bg-slate-50 transition mb-2">
                <div><div class="text-sm font-bold text-slate-800">${l.Name}</div><div class="text-[10px] text-slate-500">${l.LeadType} • ${new Date(l.CreatedAt).toLocaleDateString()}</div></div>
                <span class="text-[10px] font-bold px-2 py-1 rounded bg-slate-100 text-slate-600 border">${l.Status}</span>
            </div>`).join('') : '<div class="text-center py-4 text-slate-400 text-xs italic">No recent leads</div>';

        container.innerHTML = `
            <div class="p-6 bg-slate-900 text-white flex-shrink-0 relative overflow-hidden">
                <button onclick="${closeAction}" class="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full"><i data-lucide="x" class="w-5 h-5"></i></button>
                <div class="flex items-center gap-4 mb-6 relative z-10">
                    <div class="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-2xl font-bold border-4 border-slate-800 shadow-xl">${(u.Name || '?').charAt(0)}</div>
                    <div><h2 class="text-xl font-bold">${u.Name}</h2><div class="text-blue-200 text-xs uppercase font-bold tracking-wider">${u.Role}</div></div>
                </div>
                <div class="grid grid-cols-3 gap-4 relative z-10">
                    <div class="bg-white/10 rounded-lg p-3 text-center border border-white/5"><div class="text-2xl font-bold">${stats.total}</div><div class="text-[10px] uppercase text-blue-200">Leads</div></div>
                    <div class="bg-white/10 rounded-lg p-3 text-center border border-white/5"><div class="text-2xl font-bold text-green-400">${stats.converted}</div><div class="text-[10px] uppercase text-blue-200">Wins</div></div>
                    <div class="bg-white/10 rounded-lg p-3 text-center border border-white/5"><div class="text-2xl font-bold text-yellow-400">${stats.hot}</div><div class="text-[10px] uppercase text-blue-200">Hot</div></div>
                </div>
            </div>

            <div class="flex-1 overflow-y-auto p-6 bg-white custom-scroll">
                <div class="grid grid-cols-2 gap-4 mb-6">
                    <div class="p-3 border border-slate-100 rounded-xl bg-slate-50">
                        <h4 class="text-[10px] font-bold text-slate-400 uppercase mb-2">Status Breakdown</h4>
                        ${statusHTML}
                    </div>
                    <div class="p-3 border border-slate-100 rounded-xl bg-slate-50 space-y-2">
                        <h4 class="text-[10px] font-bold text-slate-400 uppercase mb-1">Contact</h4>
                        <div class="text-xs truncate"><i data-lucide="mail" class="w-3 h-3 inline mr-1 text-slate-400"></i> ${u.Email}</div>
                        <div class="text-xs truncate"><i data-lucide="phone" class="w-3 h-3 inline mr-1 text-slate-400"></i> ${u.Phone || '-'}</div>
                        <div class="text-xs truncate"><i data-lucide="shield" class="w-3 h-3 inline mr-1 text-slate-400"></i> ${state.teams.find(t => t.id === u.TeamID)?.Name || 'Unassigned'}</div>
                    </div>
                </div>
                
                <div class="flex gap-2 mb-6">
                    <a href="tel:${u.Phone}" class="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition flex items-center justify-center gap-2"><i data-lucide="phone" class="w-4 h-4"></i> Call</a>
                    <a href="https://wa.me/${String(u.Phone).replace(/\D/g, '')}" target="_blank" class="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition flex items-center justify-center gap-2"><i data-lucide="message-circle" class="w-4 h-4"></i> WhatsApp</a>
                    <button onclick="UsersController.downloadReport('${u.id}')" class="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition flex items-center justify-center gap-2"><i data-lucide="file-text" class="w-4 h-4"></i> Report</button>
                </div>

                ${isSuperAdmin ? `<div class="mb-6">${exportBtn}</div>` : ''}

                <h3 class="text-xs font-bold text-slate-900 uppercase mb-3">Recent Leads</h3>
                <div class="space-y-1">${leadsHTML}</div>
            </div>`;
        createIcons({ icons });
    },

    // --- DOWNLOAD FULL LEADS CSV (SuperAdmin) ---
    downloadUserLeads: async (id) => {
        Utils.toast('Fetching leads...');
        try {
            // 1. Fetch ALL leads for this user (no pagination limit)
            const res = await API.getLeads(App.state.user, null, 10000, { executive: id });
            const leads = res.data;

            if (leads.length === 0) return Utils.toast('No leads found', 'error');

            // 2. Define All Columns
            const allCols = ['LeadID', 'Name', 'Phone', 'LeadType', 'Status', 'LeadAura', 'DataSource', 'CreatedAt', 'FatherName', 'DOB', 'Category', 'Address', 'InstituteName', 'Class', 'Specialization', 'InterestedCourse', 'RouteFrom', 'Village', 'SarpanchName', 'SarpanchPhone', 'Remark', 'City'];

            // 3. Generate CSV
            const headers = allCols.join(',');
            const rows = leads.map(l => allCols.map(c => `"${(l[c] || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');

            const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows}`;
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `leads_${id}.csv`);
            document.body.appendChild(link);
            link.click();
            Utils.toast('Download Complete');

        } catch (e) {
            console.error(e);
            Utils.toast('Export failed', 'error');
        }
    },

    // --- EXISTING ACTIONS ---
    toggleStatus: async (id, status) => {
        if (id === App.state.user.UserID) return Utils.toast("Cannot deactivate yourself", "error");
        await API.updateUser(id, { Status: status === 'Inactive' ? 'Active' : 'Inactive' });
        UsersController.loadData();
    },

    promptDelete: (id) => {
        if (id === App.state.user.UserID) return Utils.toast("Cannot delete yourself", "error");
        const tpl = document.getElementById('tpl-confirm-modal');
        const div = document.createElement('div'); div.innerHTML = tpl.innerHTML;
        div.querySelector('#confirm-btn-action').onclick = () => UsersController.executeDelete(id);
        Utils.modal.open(div.innerHTML);
        createIcons({ icons });
    },

    executeDelete: async (id) => {
        const btn = document.querySelector('#modal-content button.bg-red-600');
        if (btn) { btn.innerText = "Transferring..."; btn.disabled = true; }
        try {
            const user = state.users.find(u => u.id === id);
            let targetId = App.state.user.UserID;
            if (user.Role === 'Executive' && user.TeamID) {
                const team = state.teams.find(t => t.id === user.TeamID);
                if (team && team.SupervisorID) targetId = team.SupervisorID;
            }
            await API.deleteUserSafe(id, targetId);
            state.users = state.users.filter(u => u.id !== id);
            UsersController.render();
            Utils.modal.close();
            Utils.toast('User deleted');
        } catch (e) { Utils.toast(e.message, 'error'); Utils.modal.close(); }
    },

    resetPassword: (id) => {
        const newPass = prompt("Enter new password:");
        if (newPass && newPass.length >= 6) {
            API.updateUser(id, { Password: newPass }).then(() => Utils.toast("Password updated")).catch(() => Utils.toast("Error"));
        } else if (newPass) Utils.toast("Too short", "error");
    },

    downloadReport: async (id) => {
        const u = state.users.find(x => x.id === id);
        if (!window.jspdf) return Utils.toast("PDF lib loading...", "error");
        Utils.toast('Generating PDF...');
        const stats = await API.getUserStats(id);
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 40, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20); doc.text("User Performance", 14, 20);
        doc.setFontSize(12); doc.text(`${u.Name} (${u.Role})`, 14, 30);

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(14); doc.text("Summary", 14, 55);
        doc.setFontSize(10);
        doc.text(`Total Leads: ${stats.total}`, 14, 65);
        doc.text(`Converted: ${stats.converted}`, 14, 72);

        doc.save(`Report_${u.Name}.pdf`);
        Utils.toast('PDF Downloaded');
    },

    openUserModal: (id = null) => {
        const isEdit = !!id;
        const user = isEdit ? state.users.find(u => u.id === id) : {};
        const currentUser = App.state.user;

        let roleOptions = '';
        if (currentUser.Role === 'SuperAdmin') {
            roleOptions = `<option value="Executive" ${user.Role === 'Executive' ? 'selected' : ''}>Executive</option><option value="Supervisor" ${user.Role === 'Supervisor' ? 'selected' : ''}>Supervisor</option><option value="SuperAdmin" ${user.Role === 'SuperAdmin' ? 'selected' : ''}>Super Admin</option>`;
        } else {
            roleOptions = `<option value="Executive" selected>Executive</option>`;
        }

        const html = `<div class="p-6"><h3 class="text-xl font-bold mb-6">${isEdit ? 'Edit' : 'Add'} Member</h3><form id="form-user" class="space-y-4"><input name="Name" value="${user.Name || ''}" class="input-std" placeholder="Name" required><input name="Email" value="${user.Email || ''}" class="input-std" placeholder="Email" required ${isEdit ? 'readonly' : ''}><input name="Phone" value="${user.Phone || ''}" class="input-std" placeholder="Phone">${!isEdit ? `<input name="Password" class="input-std" type="password" placeholder="Password" required>` : ''}<select name="Role" class="input-std" onchange="UsersController.toggleTeamSelect(this.value)">${roleOptions}</select><div id="team-select-container" class="${user.Role !== 'Executive' ? 'opacity-50 pointer-events-none' : ''}"><select name="TeamID" class="input-std"><option value="">Unassigned</option>${state.teams.map(t => `<option value="${t.id}" ${user.TeamID === t.id ? 'selected' : ''}>${t.Name}</option>`).join('')}</select></div><button type="submit" class="w-full bg-slate-900 text-white py-3 rounded-xl font-bold mt-2">${isEdit ? 'Update' : 'Create'}</button></form></div>`;
        Utils.modal.open(html);
        createIcons({ icons });
        window.UsersController.toggleTeamSelect = (role) => { const c = document.getElementById('team-select-container'); if (role === 'Executive') c.classList.remove('opacity-50', 'pointer-events-none'); else { c.classList.add('opacity-50', 'pointer-events-none'); c.querySelector('select').value = ""; } };
        setTimeout(() => {
            document.getElementById('form-user').onsubmit = async (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); try { if (isEdit) await API.updateUser(id, d); else await API.addUser(d); Utils.toast('Saved'); Utils.modal.close(); UsersController.loadData(); } catch (err) { Utils.toast(err.message, 'error'); } };
        }, 50);
    }
};
window.UsersController = UsersController;