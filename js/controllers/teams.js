import { API } from '../api.js';
import { App } from '../app.js';
import { Utils } from '../utils.js';
import { createIcons, icons } from "https://unpkg.com/lucide@latest/dist/esm/lucide.js";

window.Utils = Utils;

const state = {
    teams: [],
    users: [], // All users
    activeTeamId: null
};

export const TeamsController = {
    init: async () => {
        await TeamsController.loadData();
        TeamsController.bindEvents();
    },

    bindEvents: () => {
        document.getElementById('btn-create-team')?.addEventListener('click', () => TeamsController.openEditModal());
        document.getElementById('team-search')?.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = state.teams.filter(t => t.Name.toLowerCase().includes(term));
            TeamsController.renderGrid(filtered);
        });
    },

    loadData: async () => {
        try {
            const [t, u] = await Promise.all([API.getTeams(), API.getUsers()]);
            state.teams = t;
            state.users = u;
            TeamsController.renderGrid(state.teams);
        } catch (e) { console.error(e); }
    },

    renderGrid: (teams) => {
        const container = document.getElementById('teams-grid');
        if (!container) return;

        if (teams.length === 0) {
            container.innerHTML = `<div class="col-span-full text-center py-20 text-slate-400 flex flex-col items-center"><i data-lucide="frown" class="w-8 h-8 mb-2"></i> No teams found</div>`;
            createIcons({ icons });
            return;
        }

        container.innerHTML = teams.map(t => {
            const supervisor = state.users.find(u => u.id === t.SupervisorID);
            const members = state.users.filter(u => u.TeamID === t.id);

            return `
            <div class="group bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-400 transition cursor-pointer relative overflow-hidden" onclick="TeamsController.openDrawer('${t.id}')">
                <div class="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition"></div>
                
                <div class="flex justify-between items-start mb-4">
                    <div class="p-3 bg-slate-50 text-slate-600 rounded-xl border border-slate-100 shadow-sm group-hover:bg-blue-50 group-hover:text-blue-600 transition">
                        <i data-lucide="users" class="w-6 h-6"></i>
                    </div>
                    <button onclick="event.stopPropagation(); TeamsController.openEditModal('${t.id}')" class="p-2 text-slate-300 hover:text-blue-600 hover:bg-slate-50 rounded-full transition">
                        <i data-lucide="settings-2" class="w-4 h-4"></i>
                    </button>
                </div>

                <h3 class="text-lg font-bold text-slate-900 mb-1">${t.Name}</h3>
                <div class="text-sm text-slate-500 mb-6 flex items-center gap-2">
                    <i data-lucide="shield" class="w-3 h-3 text-blue-400"></i>
                    ${supervisor ? supervisor.Name : '<span class="text-red-400">No Supervisor</span>'}
                </div>

                <div class="flex items-center justify-between pt-4 border-t border-slate-100">
                    <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">${members.length} Members</span>
                    <div class="flex -space-x-2">
                        ${members.slice(0, 4).map(m => `<div class="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-sm" title="${m.Name}">${m.Name.charAt(0)}</div>`).join('')}
                        ${members.length > 4 ? `<div class="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-500">+${members.length - 4}</div>` : ''}
                    </div>
                </div>
            </div>`;
        }).join('');
        createIcons({ icons });
    },

    // --- DRAWER LOGIC ---
    // --- DRAWER LOGIC ---
    openDrawer: async (id) => {
        state.activeTeamId = id;
        const t = state.teams.find(x => x.id === id);
        if (!t) return;

        // Desktop Drawer vs Mobile Modal
        const isMobile = window.innerWidth < 1024;
        if (isMobile) Utils.modal.open(`<div id="team-mobile-content" class="h-[85vh] bg-white rounded-t-3xl flex flex-col overflow-hidden"></div>`);

        const targetId = isMobile ? 'team-mobile-content' : 'drawer-content';
        const container = document.getElementById(targetId);

        // UI State
        if (!isMobile) {
            document.getElementById('team-detail-drawer').classList.remove('hidden');
            document.getElementById('drawer-placeholder').classList.add('hidden');
            document.getElementById('drawer-content').classList.remove('hidden');
            document.getElementById('drawer-content').classList.add('flex');
        }

        // Load Stats
        const stats = await API.getTeamStats(id);
        const members = state.users.filter(u => u.TeamID === id);
        const supervisor = state.users.find(u => u.id === t.SupervisorID);

        const closeAction = isMobile ? `Utils.modal.close()` : `document.getElementById('drawer-content').classList.add('hidden');document.getElementById('drawer-placeholder').classList.remove('hidden');`;

        // PERMISSION CHECK: Can Add/Remove Members?
        const currentUser = App.state.user;
        const canManage = currentUser.Role === 'SuperAdmin' || (currentUser.Role === 'Supervisor' && currentUser.UserID === t.SupervisorID);

        // Add Button HTML (Conditional)
        const addMemberBtn = canManage ?
            `<button onclick="TeamsController.openMemberPicker('${id}')" class="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition flex items-center gap-1"><i data-lucide="plus" class="w-3 h-3"></i> Add</button>`
            : '';

        // Delete Team Button (Admin Only)
        const deleteTeamBtn = currentUser.Role === 'SuperAdmin' ?
            `<div class="mt-8 pt-6 border-t border-slate-100">
                <button onclick="TeamsController.deleteTeam('${id}')" class="w-full py-3 border border-red-100 text-red-600 bg-red-50 rounded-xl text-sm font-bold hover:bg-red-100 transition flex items-center justify-center gap-2">
                    <i data-lucide="trash-2" class="w-4 h-4"></i> Delete Team (Safe)
                </button>
                <p class="text-center text-[10px] text-slate-400 mt-2">Members will be unassigned, not deleted.</p>
            </div>` : '';

        container.innerHTML = `
            <div class="p-6 bg-slate-900 text-white flex-shrink-0 relative overflow-hidden">
                <button onclick="${closeAction}" class="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full"><i data-lucide="x" class="w-5 h-5"></i></button>
                <h2 class="text-2xl font-bold mb-1 relative z-10">${t.Name}</h2>
                <p class="text-blue-200 text-sm mb-6 relative z-10">Managed by ${supervisor?.Name || 'Unassigned'}</p>
                
                <div class="grid grid-cols-3 gap-3 relative z-10">
                    <div class="bg-white/10 p-3 rounded-lg text-center backdrop-blur-md border border-white/5"><div class="text-xl font-bold">${stats.total}</div><div class="text-[10px] uppercase text-blue-200">Leads</div></div>
                    <div class="bg-white/10 p-3 rounded-lg text-center backdrop-blur-md border border-white/5"><div class="text-xl font-bold text-green-400">${stats.converted}</div><div class="text-[10px] uppercase text-blue-200">Wins</div></div>
                    <div class="bg-white/10 p-3 rounded-lg text-center backdrop-blur-md border border-white/5"><div class="text-xl font-bold text-yellow-400">${stats.hot}</div><div class="text-[10px] uppercase text-blue-200">Hot</div></div>
                </div>
                <div class="absolute -right-10 -top-20 w-60 h-60 bg-blue-600/20 rounded-full blur-3xl"></div>
            </div>

            <div class="flex-1 overflow-y-auto p-6 bg-white custom-scroll">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Members (${members.length})</h3>
                    ${addMemberBtn}
                </div>
                
                <div class="space-y-2">
                    ${members.map(m => `
                        <div class="flex justify-between items-center p-3 border border-slate-100 rounded-xl hover:border-blue-200 transition group">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xs border border-slate-200">${m.Name.charAt(0)}</div>
                                <div><div class="text-sm font-bold text-slate-700">${m.Name}</div><div class="text-[10px] text-slate-400">${m.Email}</div></div>
                            </div>
                            ${canManage ? `<button onclick="TeamsController.removeMember('${m.id}')" class="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition opacity-0 group-hover:opacity-100"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}
                        </div>
                    `).join('')}
                    ${members.length === 0 ? '<div class="text-center py-6 text-slate-400 text-sm italic">No members assigned</div>' : ''}
                </div>

                ${deleteTeamBtn}
            </div>
        `;
        createIcons({ icons });
    },

    // --- MEMBERSHIP ---
    openMemberPicker: (teamId) => {
        const unassigned = state.users.filter(u => !u.TeamID || u.TeamID === 'Unassigned');
        const html = document.getElementById('tpl-member-modal').innerHTML;
        Utils.modal.open(html);

        const list = document.getElementById('member-list');
        const renderList = (arr) => {
            list.innerHTML = arr.map(u => `
                <div class="flex justify-between items-center p-3 border rounded-lg hover:bg-slate-50 cursor-pointer" onclick="TeamsController.addMember('${u.id}', '${teamId}')">
                    <div class="font-bold text-sm">${u.Name} <span class="text-slate-400 font-normal text-xs ml-1">(${u.Role})</span></div>
                    <div class="text-blue-600 text-xs font-bold">+ Add</div>
                </div>
            `).join('') || '<div class="p-4 text-center text-slate-400">No available members</div>';
        };
        renderList(unassigned);

        // Search
        document.getElementById('member-search').oninput = (e) => {
            const term = e.target.value.toLowerCase();
            renderList(unassigned.filter(u => u.Name.toLowerCase().includes(term)));
        };
        createIcons({ icons });
    },

    addMember: async (userId, teamId) => {
        try {
            await API.updateUser(userId, { TeamID: teamId });
            Utils.toast('Member Added');
            Utils.modal.close();
            await TeamsController.loadData(); // Reload state
            TeamsController.openDrawer(teamId); // Refresh drawer
        } catch (e) { Utils.toast('Error adding member', 'error'); }
    },

    removeMember: async (userId) => {
        if (!confirm("Remove this member from the team?")) return;
        try {
            await API.updateUser(userId, { TeamID: "Unassigned" });
            Utils.toast('Member Removed');
            await TeamsController.loadData();
            TeamsController.openDrawer(state.activeTeamId);
        } catch (e) { Utils.toast('Error removing member', 'error'); }
    },

    // --- CRUD ---
    openEditModal: (id = null) => {
        const isEdit = !!id;
        const team = isEdit ? state.teams.find(t => t.id === id) : {};
        const supervisors = state.users.filter(u => u.Role === 'Supervisor');

        const html = `
            <div class="p-6">
                <h3 class="text-xl font-bold mb-6">${isEdit ? 'Edit Team' : 'Create New Team'}</h3>
                <form id="form-team" class="space-y-4">
                    <div>
                        <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">Team Name</label>
                        <input name="Name" value="${team.Name || ''}" class="input-std" required>
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-500 uppercase mb-1 block">Supervisor</label>
                        <select name="SupervisorID" class="input-std">
                            <option value="">Select Supervisor</option>
                            ${supervisors.map(s => `<option value="${s.id}" ${team.SupervisorID === s.id ? 'selected' : ''}>${s.Name}</option>`).join('')}
                        </select>
                    </div>
                    <button type="submit" class="w-full bg-slate-900 text-white py-3 rounded-xl font-bold mt-2">${isEdit ? 'Update' : 'Create'}</button>
                </form>
            </div>`;

        Utils.modal.open(html);
        setTimeout(() => {
            document.getElementById('form-team').onsubmit = async (e) => {
                e.preventDefault();
                const data = Object.fromEntries(new FormData(e.target));
                try {
                    if (isEdit) await API.updateTeam(id, data);
                    else await API.addTeam(data);
                    Utils.toast('Saved');
                    Utils.modal.close();
                    TeamsController.loadData();
                } catch (err) { Utils.toast('Error saving', 'error'); }
            };
        }, 50);
    },

    deleteTeam: async (id) => {
        if (confirm("Delete this team? Members will be unassigned.")) {
            try {
                await API.deleteTeam(id);
                Utils.toast('Team Deleted');
                state.teams = state.teams.filter(t => t.id !== id);
                TeamsController.renderGrid(state.teams);
                // Close drawer logic
                const isMobile = window.innerWidth < 1024;
                if (isMobile) Utils.modal.close();
                else {
                    document.getElementById('drawer-content').classList.add('hidden');
                    document.getElementById('drawer-placeholder').classList.remove('hidden');
                }
            } catch (e) { Utils.toast('Delete failed', 'error'); }
        }
    }
};
window.TeamsController = TeamsController;