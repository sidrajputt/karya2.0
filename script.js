/**
 * KARYA CRM - MASTER CLIENT SCRIPT
 * Consolidates all logic: Auth, Router, API, Offline Sync, and UI Controllers.
 */

// ⚠️ CRITICAL: PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL HERE
const API_URL = "https://script.google.com/macros/s/AKfycbycZu1jgJkLIbkRpbEst2oGEcFP3cwNHG6GIhgxE4G9HQ4sJSccF2HgK4-TRQa4jqqhWQ/exec";

// ============================================================
// 1. APP CONTROLLER (State, Auth, Router)
// ============================================================
const App = {
    state: { user: null, token: null, deferredPrompt: null },

    init: async () => {
        // PWA Install Listener
        window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); App.state.deferredPrompt = e; });

        // Check Session
        const t = localStorage.getItem('karya_token');
        const u = localStorage.getItem('karya_user');

        if (t && u) {
            App.state.token = t;
            App.state.user = JSON.parse(u);
            App.renderNav();
            App.router.navigate('dashboard');
            API.sync();
        } else {
            App.router.navigate('landing');
        }
    },

    renderNav: () => {
        const role = App.state.user?.Role || 'user';
        let links = [{ id: 'dashboard', icon: 'layout-dashboard', label: 'Dashboard' }, { id: 'leads', icon: 'users', label: 'Leads' }];
        if (role !== 'user') links.push({ id: 'admin', icon: 'settings', label: 'Manage' });

        // Sidebar
        const sb = document.getElementById('nav-sidebar');
        sb.innerHTML = `
      <div class="p-6 border-b border-slate-800 flex items-center gap-3">
        <div class="w-8 h-8 bg-brand-600 rounded flex items-center justify-center font-bold">K</div>
        <span class="font-bold text-xl">Karya</span>
      </div>
      <nav class="flex-1 p-4 space-y-1">
        ${links.map(l => `<button onclick="App.router.navigate('${l.id}')" id="nav-d-${l.id}" class="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all nav-item"><i data-lucide="${l.icon}" class="w-5 h-5"></i> ${l.label}</button>`).join('')}
      </nav>
      <div class="px-4 pb-2">
        <button onclick="App.installPWA()" class="w-full flex items-center gap-3 px-4 py-2 text-sm text-blue-400 hover:bg-blue-500/10 rounded-lg border border-dashed border-slate-700">
          <i data-lucide="download" class="w-4 h-4"></i> Install
        </button>
      </div>
      <div class="p-4 border-t border-slate-800">
         <div class="mb-4 px-4">
           <div class="text-white text-sm font-medium">${App.state.user?.Name}</div>
           <div class="text-slate-500 text-xs capitalize">${role}</div>
         </div>
         <button onclick="App.auth.logout()" class="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg"><i data-lucide="log-out" class="w-5 h-5"></i> Logout</button>
      </div>`;

        // Mobile Navs
        document.getElementById('nav-mobile-bottom').innerHTML = links.map(l => `<button onclick="App.router.navigate('${l.id}')" id="nav-m-${l.id}" class="flex flex-col items-center justify-center w-full h-full text-slate-400 nav-item"><i data-lucide="${l.icon}" class="w-6 h-6 mb-1"></i><span class="text-[10px]">${l.label}</span></button>`).join('');
        document.getElementById('nav-mobile-header').innerHTML = `<div class="flex items-center gap-2"><div class="w-8 h-8 bg-brand-600 rounded flex items-center justify-center text-white font-bold text-sm">K</div><span class="font-bold text-lg text-slate-800">Karya</span></div><div class="flex gap-2"><button onclick="App.installPWA()" class="text-blue-600 mr-2"><i data-lucide="download" class="w-5 h-5"></i></button><button onclick="App.auth.logout()" class="text-slate-500"><i data-lucide="log-out" class="w-5 h-5"></i></button></div>`;
        lucide.createIcons();
    },

    installPWA: async () => {
        if (App.state.deferredPrompt) {
            App.state.deferredPrompt.prompt();
            App.state.deferredPrompt = null;
        } else {
            document.getElementById('modal-install').classList.remove('hidden');
        }
    },

    router: {
        navigate: (viewId) => {
            // Hide all views
            document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
            const t = document.getElementById(`view-${viewId}`);
            if (t) t.classList.remove('hidden');

            const isPublic = ['landing', 'login'].includes(viewId);
            const sb = document.getElementById('nav-sidebar'), main = document.getElementById('main-content'), mobs = ['nav-mobile-bottom', 'nav-mobile-header'];

            if (isPublic) {
                sb.classList.add('hidden'); sb.classList.remove('md:flex');
                main.classList.remove('md:pl-64', 'pt-16');
                mobs.forEach(id => document.getElementById(id).classList.add('hidden'));
            } else {
                sb.classList.remove('hidden'); sb.classList.add('md:flex');
                main.classList.add('md:pl-64', 'pt-16');
                mobs.forEach(id => document.getElementById(id).classList.remove('hidden'));

                // Active State
                document.querySelectorAll('.nav-item').forEach(el => { el.classList.remove('text-brand-600', 'bg-white/10', 'text-white'); el.classList.add('text-slate-400'); });
                const d = document.getElementById(`nav-d-${viewId}`), m = document.getElementById(`nav-m-${viewId}`);
                if (d) d.classList.add('bg-white/10', 'text-white'); if (m) m.classList.add('text-brand-600');

                // Trigger Module Loaders
                if (viewId === 'dashboard') loadDashboard();
                if (viewId === 'leads') loadLeads();
                if (viewId === 'admin') loadAdmin();
            }
            lucide.createIcons(); window.scrollTo(0, 0);
        }
    },

    auth: {
        login: async (e, p) => {
            const res = await API.post('auth/login', { email: e, password: p });
            localStorage.setItem('karya_token', res.token); localStorage.setItem('karya_user', JSON.stringify(res.user));
            App.state.token = res.token; App.state.user = res.user;
            // Cache settings
            const s = await API.post('settings/get', { token: res.token }); localStorage.setItem('karya_settings', JSON.stringify(s));
            App.renderNav(); App.router.navigate('dashboard');
        },
        logout: () => { localStorage.clear(); location.reload(); }
    }
};

// ============================================================
// 2. API BRIDGE & OFFLINE SYNC
// ============================================================
const API = {
    post: async (route, data) => {
        if (!navigator.onLine && route === 'leads/add') {
            const q = JSON.parse(localStorage.getItem('karya_queue') || "[]");
            data._tempId = Date.now(); q.push(data);
            localStorage.setItem('karya_queue', JSON.stringify(q));
            document.getElementById('offline-banner').classList.remove('hidden');
            throw new Error("Queue");
        }
        const res = await fetch(API_URL, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ route, data }) });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        return json.data;
    },
    sync: async () => {
        if (!navigator.onLine) return;
        const q = JSON.parse(localStorage.getItem('karya_queue') || "[]");
        if (q.length === 0) return;
        const nq = []; UI.toast(`Syncing ${q.length} items...`);
        for (const i of q) { try { i.token = localStorage.getItem('karya_token'); await API.post('leads/add', i); } catch (e) { nq.push(i); } }
        localStorage.setItem('karya_queue', JSON.stringify(nq));
        if (nq.length === 0) { UI.toast("Sync Complete!"); document.getElementById('offline-banner').classList.add('hidden'); if (window.loadLeads) loadLeads(); }
    }
};

const UI = {
    toast: (msg) => {
        const e = document.createElement('div');
        e.className = "bg-slate-900 text-white px-4 py-3 rounded-lg shadow-xl text-sm font-medium animate-bounce";
        e.innerText = msg;
        document.getElementById('toast-container').appendChild(e);
        setTimeout(() => e.remove(), 3000);
    }
};

// ============================================================
// 3. AUTH VIEW LOGIC
// ============================================================
async function handleLoginFormSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-login'), err = document.getElementById('login-error'), inputs = document.querySelectorAll('#login-form input');

    btn.disabled = true;
    btn.innerHTML = `<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Authenticating...`;
    btn.classList.add('opacity-80', 'cursor-not-allowed');
    inputs.forEach(i => { i.disabled = true; i.classList.add('bg-slate-100'); });
    err.classList.add('hidden');

    try {
        await App.auth.login(e.target.email.value, e.target.password.value);
    } catch (error) {
        err.textContent = error.message || "Invalid Credentials"; err.classList.remove('hidden');
        btn.disabled = false; btn.innerHTML = `Sign In <i data-lucide="arrow-right" class="w-4 h-4 ml-2"></i>`; btn.classList.remove('opacity-80', 'cursor-not-allowed');
        inputs.forEach(i => { i.disabled = false; i.classList.remove('bg-slate-100'); });
        document.getElementById('login-card').classList.add('animate-shake');
        setTimeout(() => document.getElementById('login-card').classList.remove('animate-shake'), 500);
        lucide.createIcons();
    }
}

// ============================================================
// 4. DASHBOARD VIEW LOGIC
// ============================================================
async function loadDashboard() {
    const loaders = document.querySelectorAll('.skel-loader'), contents = document.querySelectorAll('.real-content');
    loaders.forEach(el => el.classList.remove('hidden')); contents.forEach(el => el.classList.add('hidden'));
    try {
        const [stats, ranking] = await Promise.all([
            API.post('analytics/summary', { token: App.state.token }),
            API.post('analytics/leaderboard', { token: App.state.token })
        ]);
        if (stats.total === 0) {
            document.getElementById('dash-empty-state').classList.remove('hidden');
            document.getElementById('dash-main-content').classList.add('hidden');
            loaders.forEach(el => el.classList.add('hidden')); return;
        }
        document.getElementById('stat-total').innerText = stats.total;
        document.getElementById('stat-status').innerText = Object.keys(stats.byStatus).length;
        document.getElementById('stat-routes').innerText = Object.keys(stats.byRoute).length;

        // Render Charts
        renderChart('chart-route', 'bar', 'Leads', stats.byRoute);
        renderChart('chart-status', 'doughnut', 'Status', stats.byStatus);

        // Render Leaderboard
        document.getElementById('leaderboard-list').innerHTML = ranking.map((r, i) => `
      <div class="flex justify-between p-3 bg-slate-50 rounded border border-slate-100">
        <div class="flex gap-3"><div class="w-6 h-6 flex items-center justify-center rounded-full font-bold text-xs ${i === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100'}">#${i + 1}</div>
        <div><p class="text-sm font-bold">${r.name}</p><p class="text-[10px] text-slate-500">${r.team || '-'}</p></div></div>
        <div class="text-right"><p class="font-bold text-brand-600">${r.count}</p><p class="text-[10px]">Leads</p></div>
      </div>`).join('');

        loaders.forEach(el => el.classList.add('hidden')); contents.forEach(el => el.classList.remove('hidden'));
        document.getElementById('dash-empty-state').classList.add('hidden');
        document.getElementById('dash-main-content').classList.remove('hidden');
    } catch (e) { UI.toast("Analytics Error"); }
}

function renderChart(id, type, label, data) {
    const ctx = document.getElementById(id); if (!ctx) return;
    if (window[id] instanceof Chart) window[id].destroy();
    window[id] = new Chart(ctx, { type, data: { labels: Object.keys(data), datasets: [{ label, data: Object.values(data), backgroundColor: type === 'bar' ? '#3b82f6' : ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'], borderRadius: 5 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: type !== 'bar', position: 'right' } }, scales: type === 'bar' ? { y: { beginAtZero: true, grid: { display: false } } } : {} } });
}

// ============================================================
// 5. LEADS VIEW LOGIC (V5)
// ============================================================
let leadsState = { allData: [], filteredData: [], page: 1, limit: 10, filters: { search: "", status: "", type: "", dateStart: "", dateEnd: "" } };
let schoolList = [];

async function loadLeads() {
    const c = document.getElementById('leads-list');
    const p = document.getElementById('pagination-controls');
    c.innerHTML = '<div class="text-center py-10 text-slate-400">Loading...</div>';
    p.classList.add('hidden');
    try {
        const l = await API.post('leads/list', { token: App.state.token });
        const q = JSON.parse(localStorage.getItem('karya_queue') || "[]");
        leadsState.allData = [...q, ...l].reverse();
        applyFilters();
    } catch (e) { c.innerHTML = `<div class="text-center text-red-500">Error</div>`; }
}

function applyFilters() {
    const s = leadsState.filters;
    leadsState.filteredData = leadsState.allData.filter(item => {
        const q = s.search.toLowerCase();
        const matchSearch = !q || (item.Name && item.Name.toLowerCase().includes(q)) || (item.Phone && item.Phone.includes(q)) || (item.Route && item.Route.toLowerCase().includes(q));
        const matchStatus = !s.status || item.Status === s.status;
        const matchType = !s.type || item.LeadType === s.type;
        return matchSearch && matchStatus && matchType;
    });
    leadsState.page = 1;
    renderPage();
}

function renderPage() {
    const c = document.getElementById('leads-list');
    const p = document.getElementById('pagination-controls');
    const total = leadsState.filteredData.length;

    if (total === 0) { c.innerHTML = '<div class="text-center py-10 text-slate-400">No leads match filters.</div>'; p.classList.add('hidden'); return; }

    const start = (leadsState.page - 1) * leadsState.limit;
    const pageData = leadsState.filteredData.slice(start, start + leadsState.limit);

    c.innerHTML = pageData.map(l => `
    <div class="bg-white rounded-xl p-4 border border-slate-100 mb-3 shadow-sm hover:shadow-md aura-${l.Aura || 'Cold'} relative group">
      ${l._tempId ? '<span class="absolute top-2 right-2 text-[10px] bg-slate-200 px-2 rounded font-bold">Offline</span>' : ''}
      <div class="flex justify-between mb-2">
         <div onclick="openEditLead('${l.LeadID}')" class="cursor-pointer">
           <span class="text-[10px] uppercase font-bold tracking-wider bg-blue-50 text-blue-600 px-2 py-0.5 rounded mb-1 inline-block">${l.LeadType || 'General'}</span>
           <h3 class="font-bold text-lg text-slate-800 flex items-center gap-2">${l.Name || l.ProspectName} <i data-lucide="edit-2" class="w-3 h-3 text-slate-400"></i></h3>
           <p class="text-xs text-slate-500 flex items-center gap-1"><i data-lucide="map-pin" class="w-3 h-3"></i> ${l.Route || l.VillageCity || '-'}</p>
         </div>
         <div class="text-right"><span class="text-[10px] font-bold px-2 py-1 rounded bg-slate-100">${l.Status}</span></div>
      </div>
      <div class="text-xs text-slate-500 mb-3">${l.LeadType === 'Student' ? `Class: ${l.Class} | ${l.InterestedCourse}` : `Contact: ${l.ContactPerson}`}</div>
      <div class="flex gap-2"><a href="tel:${l.Phone}" class="flex-1 py-2 bg-green-50 text-green-700 rounded text-center text-sm font-bold border border-green-100">Call</a><a href="https://wa.me/91${l.Phone}" target="_blank" class="flex-1 py-2 bg-green-500 text-white rounded text-center text-sm font-bold">WhatsApp</a></div>
    </div>`).join('');

    p.classList.remove('hidden');
    document.getElementById('page-info').innerText = `Page ${leadsState.page} of ${Math.ceil(total / leadsState.limit)}`;
    document.getElementById('btn-prev').disabled = leadsState.page === 1;
    document.getElementById('btn-next').disabled = start + leadsState.limit >= total;
    lucide.createIcons();
}

// Handlers
function handleSearch(v) { leadsState.filters.search = v; applyFilters(); }
function toggleFilterPanel() { document.getElementById('filter-panel').classList.toggle('hidden'); }
function applyAdvancedFilters() {
    leadsState.filters.status = document.getElementById('filter-status').value;
    leadsState.filters.type = document.getElementById('filter-type').value;
    leadsState.filters.dateStart = document.getElementById('filter-date-start').value;
    leadsState.filters.dateEnd = document.getElementById('filter-date-end').value;
    toggleFilterPanel(); applyFilters();
}
function clearFilters() {
    leadsState.filters = { search: "", status: "", type: "", dateStart: "", dateEnd: "" };
    document.getElementById('search-input').value = "";
    applyFilters();
}
function changePage(d) { leadsState.page += d; renderPage(); document.getElementById('leads-list').scrollIntoView(); }

// Modals
function openStudentModal() { populateDropdowns('student'); document.getElementById('modal-student').classList.remove('hidden'); }
function openOtherModal() { populateDropdowns('other'); schoolList = []; renderSchoolList(); toggleOtherMode('Route'); document.getElementById('modal-other').classList.remove('hidden'); }
function openEditLead(id) { if (!id || id.startsWith('TEMP')) return; const l = leadsState.allData.find(x => x.LeadID === id); document.getElementById('form-edit-lead').LeadID.value = l.LeadID; document.getElementById('modal-edit-lead').classList.remove('hidden'); }

// Save Logic
async function handleSaveStudent(e) { e.preventDefault(); const b = document.getElementById('btn-save-student'); b.disabled = true; b.innerText = "Saving..."; try { await API.post('leads/add', { ...Object.fromEntries(new FormData(e.target).entries()), LeadType: "Student", token: App.state.token }); UI.toast("Saved"); e.target.reset(); document.getElementById('modal-student').classList.add('hidden'); loadLeads(); } catch (e) { if (e.message.includes("Queue")) { e.target.reset(); document.getElementById('modal-student').classList.add('hidden'); loadLeads(); UI.toast("Offline Saved"); } else UI.toast(e.message); } finally { b.disabled = false; b.innerText = "Save"; } }

async function handleUpdateLead(e) { e.preventDefault(); const b = document.getElementById('btn-update-lead'); b.disabled = true; try { await API.post('leads/update', { ...Object.fromEntries(new FormData(e.target).entries()), token: App.state.token }); UI.toast("Updated"); document.getElementById('modal-edit-lead').classList.add('hidden'); loadLeads(); } catch (e) { UI.toast(e.message); } finally { b.disabled = false; } }

// Other Lead Helpers
function toggleOtherMode(m) { document.getElementById('other-mode').value = m; document.getElementById(m === 'Route' ? 'sec-route' : 'sec-direct').classList.remove('hidden'); document.getElementById(m === 'Route' ? 'sec-direct' : 'sec-route').classList.add('hidden'); }
function addSchoolToBuffer() { const n = document.getElementById('other-school-name').value; if (!n) return UI.toast("Name required"); schoolList.push({ Name: n, ContactPerson: document.getElementById('other-school-prospect').value, Phone: document.getElementById('other-school-contact').value, Notes: document.getElementById('other-school-remark').value }); document.getElementById('other-school-name').value = ""; renderSchoolList(); }
function renderSchoolList() { document.getElementById('school-buffer-list').innerHTML = schoolList.map((s, i) => `<div class="p-2 border mb-1 flex justify-between"><span>${s.Name}</span><button onclick="schoolList.splice(${i},1);renderSchoolList()">x</button></div>`).join(''); }
async function handleSaveOther(e) {
    e.preventDefault(); const b = document.getElementById('btn-save-other'); b.disabled = true; b.innerText = "Saving...";
    try {
        const f = Object.fromEntries(new FormData(e.target).entries()), m = document.getElementById('other-mode').value;
        const common = { token: App.state.token, LeadType: "Other", SubType: m, Route: f.Route, VillageCity: f.VillageCity, SarpanchName: f.SarpanchName, SarpanchContact: f.SarpanchContact, Latitude: f.Latitude, Longitude: f.Longitude };
        if (m === 'Route') { if (!schoolList.length) throw new Error("Add schools"); for (const s of schoolList) await API.post('leads/add', { ...common, ...s }); }
        else { await API.post('leads/add', { ...common, Name: f.DirectName, ContactPerson: f.DirectProspect, Phone: f.DirectContact, Notes: f.DirectRemark }); }
        UI.toast("Saved"); e.target.reset(); schoolList = []; document.getElementById('modal-other').classList.add('hidden'); loadLeads();
    } catch (e) { if (e.message.includes("Queue")) { e.target.reset(); document.getElementById('modal-other').classList.add('hidden'); loadLeads(); UI.toast("Offline Saved"); } else UI.toast(e.message); } finally { b.disabled = false; b.innerText = "Save"; }
}

// Common Helpers
function populateDropdowns(t) {
    const s = JSON.parse(localStorage.getItem('karya_settings') || "{}"), pop = (id, l) => { const el = document.getElementById(id); if (el && l) el.innerHTML = `<option value="">Select</option>` + l.map(x => `<option value="${x.value}">${x.value}</option>`).join('') };
    if (t === 'student') { pop('st-source', s.DataSource); pop('st-cat', s.Category); pop('st-class', s.Class); pop('st-spec', s.Specialization); pop('st-course', s.Course); }
    else { pop('ot-route', s.Route); }
}
function captureLocation(lat, lng, stat) { document.getElementById(stat).innerText = "..."; navigator.geolocation.getCurrentPosition(p => { document.getElementById(lat).value = p.coords.latitude; document.getElementById(lng).value = p.coords.longitude; document.getElementById(stat).innerText = "OK"; }); }

// ============================================================
// 6. ADMIN VIEW LOGIC
// ============================================================
let adminState = { activeTab: 'users', users: [], teams: [], supervisors: [], settings: {} };
async function loadAdmin() {
    document.getElementById('user-table-body').innerHTML = `<tr><td colspan="5" class="p-4"><div class="skeleton h-10 w-full"></div></td></tr>`;
    try {
        const [users, teams, settings] = await Promise.all([API.post('users/list', { token: App.state.token }), API.post('teams/list', { token: App.state.token }), API.post('settings/get', { token: App.state.token })]);
        adminState.users = users; adminState.teams = teams; adminState.settings = settings; adminState.supervisors = users.filter(u => u.Role === 'supervisor');
        renderUserTable(); renderTeamList(); renderSettingsUI();
    } catch (e) { UI.toast("Load Failed"); }
}
function switchTab(t) { document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('text-brand-600', 'border-brand-600')); document.getElementById(`btn-tab-${t}`).classList.add('text-brand-600', 'border-brand-600'); document.querySelectorAll('.tab-view').forEach(e => e.classList.add('hidden')); document.getElementById(`view-${t}`).classList.remove('hidden'); }
function renderUserTable(d = adminState.users) {
    const b = document.getElementById('user-table-body'); if (d.length === 0) { b.innerHTML = '<tr><td colspan="5" class="p-4 text-center">No users</td></tr>'; return; }
    b.innerHTML = d.map(u => `<tr class="border-b hover:bg-slate-50"><td class="p-3 font-medium">${u.Name}</td><td class="p-3 text-xs uppercase font-bold text-slate-500">${u.Role}</td><td class="p-3 text-sm">${u.Phone}</td><td class="p-3 text-xs">${(adminState.teams.find(t => t.TeamID === u.TeamID) || {}).Name || '-'}</td><td class="p-3 text-right"><button onclick="openUserModal('${u.UserID}')" class="text-slate-400 hover:text-brand-600"><i data-lucide="pencil" class="w-4 h-4"></i></button></td></tr>`).join(''); lucide.createIcons();
}
function openUserModal(id) { const m = document.getElementById('modal-user'), f = document.getElementById('form-user'), t = document.getElementById('in-user-team'); t.innerHTML = `<option value="">Select Team</option>` + adminState.teams.map(tm => `<option value="${tm.TeamID}">${tm.Name}</option>`).join(''); if (id) { const u = adminState.users.find(x => x.UserID === id); f.UserID.value = u.UserID; f.Name.value = u.Name; f.Email.value = u.Email; f.Phone.value = u.Phone; f.Role.value = u.Role; f.TeamID.value = u.TeamID || ""; document.getElementById('user-pwd-grp').classList.add('hidden'); } else { f.reset(); f.UserID.value = ""; document.getElementById('user-pwd-grp').classList.remove('hidden'); } m.classList.remove('hidden'); }
async function handleSaveUser(e) { e.preventDefault(); try { const ep = e.target.UserID.value ? 'users/update' : 'users/add'; await API.post(ep, { ...Object.fromEntries(new FormData(e.target).entries()), token: App.state.token }); UI.toast("Saved!"); document.getElementById('modal-user').classList.add('hidden'); loadAdmin(); } catch (err) { UI.toast(err.message); } }
function renderSettingsUI() { const c = document.getElementById('settings-grid'); let h = '';['Route', 'Course', 'Type'].forEach(k => { const l = adminState.settings[k] || []; h += `<div class="bg-white p-4 rounded border shadow-sm"><h4 class="font-bold mb-2">${k}s <span class="text-xs bg-slate-100 px-1 rounded">${l.length}</span></h4><div class="max-h-32 overflow-y-auto mb-2 space-y-1">${l.map(i => `<div class="flex justify-between text-sm p-1 bg-slate-50 rounded"><span>${i.value}</span><button onclick="delSet('${k}','${i.value}')" class="text-red-400 hover:text-red-600">x</button></div>`).join('')}</div><form onsubmit="addSet(event,'${k}')" class="flex gap-1"><input name="V" placeholder="Add" class="input-std py-1 text-sm"><button class="bg-slate-800 text-white px-2 rounded">+</button></form></div>`; }); c.innerHTML = h; }
async function addSet(e, c) { e.preventDefault(); const v = e.target.V.value; await API.post('settings/add', { token: App.state.token, Category: c, Value: v }); UI.toast("Added"); loadAdmin(); }
async function delSet(c, v) { if (confirm('Delete?')) await API.post('settings/delete', { token: App.state.token, Category: c, Value: v }); loadAdmin(); }
function renderTeamList() { document.getElementById('team-list').innerHTML = adminState.teams.map(t => `<div class="p-3 border rounded mb-2 flex justify-between"><div><div class="font-bold">${t.Name}</div><div class="text-xs text-slate-500">${t.TeamID}</div></div><div class="text-xs">Sup: ${(adminState.supervisors.find(s => s.UserID === t.SupervisorID) || {}).Name || '-'}</div></div>`).join(''); }
async function handleAddTeam(e) { e.preventDefault(); await API.post('teams/add', { ...Object.fromEntries(new FormData(e.target).entries()), token: App.state.token }); UI.toast("Team Created"); document.getElementById('modal-team').classList.add('hidden'); loadAdmin(); }
async function handleExport(e) { e.preventDefault(); const cols = Array.from(document.querySelectorAll('input[name="xc"]:checked')).map(x => x.value); if (!cols.length) return UI.toast("Select cols"); const d = await API.post('leads/export', { token: App.state.token, columns: cols }); const csv = [cols.join(','), ...d.map(r => cols.map(c => `"${r[c] || ''}"`).join(','))].join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'Data.csv'; a.click(); }

// Main Boot
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    App.init();
});
