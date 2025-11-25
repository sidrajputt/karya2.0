/**
 * KARYA CRM - FIREBASE EDITION (Final V5)
 * Direct Firestore Connection | Offline Native | Real-time Auth
 */

const firebaseConfig = {
    apiKey: "AIzaSyCckUpRFl9WT5IxhBiH1TYyaOEfx_OkknU",
    authDomain: "karyacrm-a41ae.firebaseapp.com",
    projectId: "karyacrm-a41ae",
    storageBucket: "karyacrm-a41ae.firebasestorage.app",
    messagingSenderId: "383160041638",
    appId: "1:383160041638:web:f40a77f5c3076f00a87467",
    measurementId: "G-9HB5FNYGP4"
}

// --- 1. FIREBASE SDK IMPORTS ---
import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
    query, where, orderBy, enableIndexedDbPersistence, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- 2. INITIALIZE FIREBASE ---
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

// Enable Offline Persistence (Replaces our old manual queue!)
enableIndexedDbPersistence(db).catch((err) => {
    console.log("Offline persistence disabled:", err.code);
});

// --- 3. APP CONTROLLER ---
window.App = {
    state: { user: null, token: null },

    init: () => {
        // Real-time Auth Listener
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Fetch User Details from Firestore
                const userSnap = await getDoc(doc(db, "users", user.uid));
                if (userSnap.exists()) {
                    App.state.user = { ...userSnap.data(), UserID: user.uid };
                    App.state.token = user.accessToken;
                    App.renderNav();
                    App.router.navigate('dashboard');
                } else {
                    // User exists in Auth but not in DB (Rare edge case)
                    console.error("No user profile found");
                    auth.signOut();
                }
            } else {
                App.router.navigate('landing');
            }
        });
    },

    renderNav: () => {
        const role = App.state.user?.Role || 'user';
        let links = [{ id: 'dashboard', icon: 'layout-dashboard', label: 'Dashboard' }, { id: 'leads', icon: 'users', label: 'Leads' }];
        if (role !== 'user') links.push({ id: 'admin', icon: 'settings', label: 'Manage' });

        // Sidebar
        document.getElementById('nav-sidebar').innerHTML = `
      <div class="p-6 border-b border-slate-800 flex items-center gap-3">
        <div class="w-8 h-8 bg-brand-600 rounded flex items-center justify-center font-bold">K</div>
        <span class="font-bold text-xl">Karya</span>
      </div>
      <nav class="flex-1 p-4 space-y-1">
        ${links.map(l => `<button onclick="App.router.navigate('${l.id}')" id="nav-d-${l.id}" class="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all nav-item"><i data-lucide="${l.icon}" class="w-5 h-5"></i> ${l.label}</button>`).join('')}
      </nav>
      <div class="p-4 border-t border-slate-800">
         <div class="mb-4 px-4"><div class="text-white text-sm font-medium">${App.state.user?.Name}</div><div class="text-slate-500 text-xs capitalize">${role}</div></div>
         <button onclick="App.auth.logout()" class="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg"><i data-lucide="log-out" class="w-5 h-5"></i> Logout</button>
      </div>`;

        // Mobile Nav
        document.getElementById('nav-mobile-bottom').innerHTML = links.map(l => `<button onclick="App.router.navigate('${l.id}')" id="nav-m-${l.id}" class="flex flex-col items-center justify-center w-full h-full text-slate-400 nav-item"><i data-lucide="${l.icon}" class="w-6 h-6 mb-1"></i><span class="text-[10px]">${l.label}</span></button>`).join('');
        document.getElementById('nav-mobile-header').innerHTML = `<div class="flex items-center gap-2"><div class="w-8 h-8 bg-brand-600 rounded flex items-center justify-center text-white font-bold text-sm">K</div><span class="font-bold text-lg text-slate-800">Karya</span></div><button onclick="App.auth.logout()" class="text-slate-500"><i data-lucide="log-out" class="w-5 h-5"></i></button>`;
        lucide.createIcons();
    },

    router: {
        navigate: (viewId) => {
            document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
            document.getElementById(`view-${viewId}`).classList.remove('hidden');

            const isPublic = ['landing', 'login'].includes(viewId);
            const sb = document.getElementById('nav-sidebar'), main = document.getElementById('main-content'), mobs = ['nav-mobile-bottom', 'nav-mobile-header'];

            if (isPublic) {
                sb.classList.add('hidden'); sb.classList.remove('md:flex'); main.classList.remove('md:pl-64', 'pt-16');
                mobs.forEach(id => document.getElementById(id).classList.add('hidden'));
            } else {
                sb.classList.add('hidden'); sb.classList.add('md:flex'); main.classList.add('md:pl-64', 'pt-16');
                mobs.forEach(id => document.getElementById(id).classList.remove('hidden'));

                // Active State
                document.querySelectorAll('.nav-item').forEach(el => { el.classList.remove('text-brand-600', 'bg-white/10', 'text-white'); el.classList.add('text-slate-400'); });
                const d = document.getElementById(`nav-d-${viewId}`), m = document.getElementById(`nav-m-${viewId}`);
                if (d) d.classList.add('bg-white/10', 'text-white'); if (m) m.classList.add('text-brand-600');

                // Loaders
                if (viewId === 'dashboard') loadDashboard();
                if (viewId === 'leads') loadLeads();
                if (viewId === 'admin') loadAdmin();
            }
            lucide.createIcons(); window.scrollTo(0, 0);
        }
    },

    auth: {
        login: async (e, p) => { await signInWithEmailAndPassword(auth, e, p); },
        logout: () => signOut(auth)
    }
};

// ============================================================
// 4. API BRIDGE (Mapping 'routes' to Firestore Calls)
// ============================================================
window.API = {
    // Mocking the old 'post' structure so we don't have to rewrite UI logic
    post: async (route, data) => {
        // Simulate Latency for UI feel
        // await new Promise(r => setTimeout(r, 300));

        switch (route) {
            case 'auth/login':
                // Handled by App.auth.login directly
                return { success: true };

            // --- READ OPS ---
            case 'leads/list':
                let q = query(collection(db, "leads"), orderBy("Timestamp", "desc"));
                // Security: If user, only show own leads
                if (App.state.user.Role === 'user') {
                    q = query(collection(db, "leads"), where("EnteredBy", "==", App.state.user.UserID), orderBy("Timestamp", "desc"));
                }
                // If Supervisor, fetch all (or filter by team logic client side for simplicity in v1)
                const snap = await getDocs(q);
                return snap.docs.map(d => ({ ...d.data(), LeadID: d.id }));

            case 'users/list':
                const uSnap = await getDocs(collection(db, "users"));
                return uSnap.docs.map(d => ({ ...d.data(), UserID: d.id }));

            case 'teams/list':
                const tSnap = await getDocs(collection(db, "teams"));
                return tSnap.docs.map(d => ({ ...d.data(), TeamID: d.id }));

            case 'settings/get':
                const sSnap = await getDocs(collection(db, "settings"));
                const settings = {};
                sSnap.forEach(d => {
                    const item = d.data();
                    if (!settings[item.Category]) settings[item.Category] = [];
                    settings[item.Category].push({ value: item.Value, id: d.id });
                });
                return settings;

            // --- ANALYTICS ---
            case 'analytics/summary':
            case 'analytics/leaderboard':
                // Calculate Client Side from leads list (Firestore Aggregations are complex for V1)
                const allLeads = await API.post('leads/list', {});
                if (route === 'analytics/summary') {
                    const s = { total: allLeads.length, byRoute: {}, byStatus: {} };
                    allLeads.forEach(l => {
                        s.byRoute[l.Route || "Other"] = (s.byRoute[l.Route || "Other"] || 0) + 1;
                        s.byStatus[l.Status || "New"] = (s.byStatus[l.Status || "New"] || 0) + 1;
                    });
                    return s;
                } else {
                    const allUsers = await API.post('users/list', {});
                    const counts = {};
                    allLeads.forEach(l => counts[l.EnteredBy] = (counts[l.EnteredBy] || 0) + 1);
                    return Object.keys(counts).map(uid => ({
                        name: (allUsers.find(u => u.UserID === uid) || {}).Name || "Unknown",
                        count: counts[uid]
                    })).sort((a, b) => b.count - a.count).slice(0, 10);
                }

            // --- WRITE OPS ---
            case 'leads/add':
                data.EnteredBy = App.state.user.UserID;
                data.Timestamp = new Date().toISOString();
                // Check Dupe
                const dupQ = query(collection(db, "leads"), where("Phone", "==", data.Phone));
                const dupSnap = await getDocs(dupQ);
                const isDup = !dupSnap.empty;

                data.IsDuplicate = isDup;
                await addDoc(collection(db, "leads"), data);
                return { isDuplicate: isDup };

            case 'leads/update':
                const leadRef = doc(db, "leads", data.LeadID);
                delete data.LeadID; // Don't save ID inside doc
                delete data.token;
                await updateDoc(leadRef, data);
                return { success: true };

            case 'users/add':
                // Create User Profile (But NOT Auth - see note below)
                // Note: In pure client SDK, you can't create another user without logging out.
                // For MVP: We just create the DB record. Admin manually creates Auth or we use a secondary app approach.
                // Here we simply create the DB record so they appear in the list.
                await addDoc(collection(db, "users"), {
                    Name: data.Name, Email: data.Email, Phone: data.Phone,
                    Role: data.Role, TeamID: data.TeamID, CreatedAt: new Date().toISOString()
                });
                // Alert: "User DB record created. Ask them to Sign Up or use Admin SDK for Auth."
                return { message: "User Profile Created" };

            case 'teams/add':
                await addDoc(collection(db, "teams"), { Name: data.Name, SupervisorID: data.SupervisorID });
                return { TeamID: "generated" };

            case 'settings/add':
                await addDoc(collection(db, "settings"), { Category: data.Category, Value: data.Value });
                return { success: true };

            case 'settings/delete':
                // Find doc by value then delete
                const delQ = query(collection(db, "settings"), where("Category", "==", data.Category), where("Value", "==", data.Value));
                const delSnap = await getDocs(delQ);
                delSnap.forEach(async (d) => await deleteDoc(d.ref));
                return { success: true };

            default:
                throw new Error("Route not found: " + route);
        }
    },

    // Empty Sync function (Firebase handles this natively!)
    sync: () => { console.log("Firebase Native Sync Active"); }
};

// --- UI HELPERS ---
const UI = { toast: (msg) => { const e = document.createElement('div'); e.className = "bg-slate-900 text-white px-4 py-3 rounded-lg shadow-xl text-sm font-medium animate-bounce"; e.innerText = msg; document.getElementById('toast-container').appendChild(e); setTimeout(() => e.remove(), 3000); } };

// --- VIEW LOGIC (Dashboard) ---
window.loadDashboard = async () => {
    const loaders = document.querySelectorAll('.skel-loader'), contents = document.querySelectorAll('.real-content');
    loaders.forEach(el => el.classList.remove('hidden')); contents.forEach(el => el.classList.add('hidden'));
    try {
        const [stats, ranking] = await Promise.all([API.post('analytics/summary'), API.post('analytics/leaderboard')]);
        if (stats.total === 0) { document.getElementById('dash-empty-state').classList.remove('hidden'); document.getElementById('dash-main-content').classList.add('hidden'); loaders.forEach(el => el.classList.add('hidden')); return; }
        document.getElementById('stat-total').innerText = stats.total; document.getElementById('stat-status').innerText = Object.keys(stats.byStatus).length; document.getElementById('stat-routes').innerText = Object.keys(stats.byRoute).length;
        new Chart(document.getElementById('chart-status'), { type: 'doughnut', data: { labels: Object.keys(stats.byStatus), datasets: [{ data: Object.values(stats.byStatus), backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'] }] }, options: { responsive: true, maintainAspectRatio: false } });
        new Chart(document.getElementById('chart-route'), { type: 'bar', data: { labels: Object.keys(stats.byRoute), datasets: [{ label: 'Leads', data: Object.values(stats.byRoute), backgroundColor: '#3b82f6', borderRadius: 5 }] }, options: { responsive: true, maintainAspectRatio: false } });
        document.getElementById('leaderboard-list').innerHTML = ranking.map((r, i) => `<div class="flex justify-between p-3 bg-slate-50 rounded border border-slate-100"><div class="flex gap-3"><div class="w-6 h-6 flex items-center justify-center rounded-full font-bold text-xs ${i === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100'}">#${i + 1}</div><div><p class="text-sm font-bold">${r.name}</p></div></div><div class="text-right"><p class="font-bold text-brand-600">${r.count}</p></div></div>`).join('');
        loaders.forEach(el => el.classList.add('hidden')); contents.forEach(el => el.classList.remove('hidden')); document.getElementById('dash-empty-state').classList.add('hidden'); document.getElementById('dash-main-content').classList.remove('hidden');
    } catch (e) { console.error(e); UI.toast("Analytics Error"); }
};

// --- VIEW LOGIC (Leads) ---
window.allLeadsData = [];
window.loadLeads = async () => {
    const c = document.getElementById('leads-list'); c.innerHTML = '<div class="text-center py-10 text-slate-400">Loading...</div>';
    try {
        const l = await API.post('leads/list');
        window.allLeadsData = l; // Store for search
        renderLeadList(l);
    } catch (e) { c.innerHTML = `<div class="text-center text-red-500">Error</div>`; }
};

window.renderLeadList = (leads) => {
    const c = document.getElementById('leads-list'); if (!leads.length) { c.innerHTML = '<div class="text-center text-slate-400">No leads</div>'; return; }
    c.innerHTML = leads.map(l => `<div class="bg-white rounded-xl p-4 border border-slate-100 mb-3 shadow-sm hover:shadow-md aura-${l.Aura || 'Cold'} group"><div class="flex justify-between mb-2"><div><span class="text-[10px] uppercase font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded mb-1 inline-block">${l.LeadType || 'General'}</span><h3 class="font-bold text-lg text-slate-800 cursor-pointer" onclick="openEditLead('${l.LeadID}')">${l.Name || l.ProspectName}</h3><p class="text-xs text-slate-500 flex items-center gap-1"><i data-lucide="map-pin" class="w-3 h-3"></i> ${l.Route || l.VillageCity || '-'}</p></div><div class="text-right"><span class="text-[10px] font-bold px-2 py-1 rounded bg-slate-100">${l.Status}</span></div></div><div class="text-xs text-slate-500 mb-3">${l.LeadType === 'Student' ? `Class: ${l.Class} | ${l.InterestedCourse}` : `Contact: ${l.ContactPerson}`}</div><div class="flex gap-2"><a href="tel:${l.Phone}" class="flex-1 py-2 bg-green-50 text-green-700 rounded text-center text-sm font-bold border border-green-100">Call</a><a href="https://wa.me/91${l.Phone}" target="_blank" class="flex-1 py-2 bg-green-500 text-white rounded text-center text-sm font-bold">WhatsApp</a></div></div>`).join(''); lucide.createIcons();
};

// --- VIEW LOGIC (Admin & Forms) ---
// (Re-attaching the UI handlers from previous version)
window.handleLoginFormSubmit = handleLoginFormSubmit; // From Auth Section
window.openStudentModal = () => { populateDropdowns('student'); document.getElementById('modal-student').classList.remove('hidden'); };
window.openOtherModal = () => { populateDropdowns('other'); window.schoolList = []; renderSchoolList(); toggleOtherMode('Route'); document.getElementById('modal-other').classList.remove('hidden'); };
window.handleSaveStudent = async (e) => { e.preventDefault(); try { await API.post('leads/add', { ...Object.fromEntries(new FormData(e.target).entries()), LeadType: "Student" }); UI.toast("Saved"); e.target.reset(); document.getElementById('modal-student').classList.add('hidden'); loadLeads(); } catch (err) { UI.toast(err.message); } };
window.openEditLead = (id) => { const l = window.allLeadsData.find(x => x.LeadID === id); document.getElementById('form-edit-lead').LeadID.value = l.LeadID; document.getElementById('modal-edit-lead').classList.remove('hidden'); };
window.handleUpdateLead = async (e) => { e.preventDefault(); await API.post('leads/update', { ...Object.fromEntries(new FormData(e.target).entries()) }); UI.toast("Updated"); document.getElementById('modal-edit-lead').classList.add('hidden'); loadLeads(); };
window.loadAdmin = async () => { const users = await API.post('users/list'); const tbody = document.getElementById('user-table-body'); tbody.innerHTML = users.map(u => `<tr class="border-b hover:bg-slate-50"><td class="p-3 font-medium">${u.Name}</td><td class="p-3 text-xs uppercase">${u.Role}</td><td class="p-3 text-sm">${u.Phone}</td></tr>`).join(''); };

// Helpers
window.populateDropdowns = (t) => { API.post('settings/get').then(s => { const pop = (id, l) => { const el = document.getElementById(id); if (el && l) el.innerHTML = `<option value="">Select</option>` + l.map(x => `<option value="${x.value}">${x.value}</option>`).join('') }; if (t === 'student') { pop('st-source', s.DataSource); pop('st-cat', s.Category); pop('st-class', s.Class); pop('st-spec', s.Specialization); pop('st-course', s.Course); } else { pop('ot-route', s.Route); } }); };
window.toggleOtherMode = (m) => { document.getElementById('other-mode').value = m; document.getElementById(m === 'Route' ? 'sec-route' : 'sec-direct').classList.remove('hidden'); document.getElementById(m === 'Route' ? 'sec-direct' : 'sec-route').classList.add('hidden'); };
window.captureLocation = (lat, lng, stat) => { document.getElementById(stat).innerText = "..."; navigator.geolocation.getCurrentPosition(p => { document.getElementById(lat).value = p.coords.latitude; document.getElementById(lng).value = p.coords.longitude; document.getElementById(stat).innerText = "OK"; }); };
window.schoolList = []; window.renderSchoolList = () => { document.getElementById('school-buffer-list').innerHTML = window.schoolList.map((s, i) => `<div class="p-2 border mb-1 flex justify-between"><span>${s.Name}</span><button onclick="schoolList.splice(${i},1);renderSchoolList()">x</button></div>`).join(''); }; window.addSchoolToBuffer = () => { const n = document.getElementById('other-school-name').value; if (!n) return; window.schoolList.push({ Name: n, ContactPerson: document.getElementById('other-school-prospect').value, Phone: document.getElementById('other-school-contact').value, Notes: document.getElementById('other-school-remark').value }); document.getElementById('other-school-name').value = ""; renderSchoolList(); };
window.handleSaveOther = async (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target).entries()), m = document.getElementById('other-mode').value; const c = { LeadType: "Other", SubType: m, Route: f.Route, VillageCity: f.VillageCity, SarpanchName: f.SarpanchName, SarpanchContact: f.SarpanchContact, Latitude: f.Latitude, Longitude: f.Longitude }; if (m === 'Route') { for (const s of window.schoolList) await API.post('leads/add', { ...c, ...s }); } else { await API.post('leads/add', { ...c, Name: f.DirectName, ContactPerson: f.DirectProspect, Phone: f.DirectContact, Notes: f.DirectRemark }); } UI.toast("Saved"); e.target.reset(); window.schoolList = []; document.getElementById('modal-other').classList.add('hidden'); loadLeads(); };

// Boot
document.addEventListener('DOMContentLoaded', () => { App.init(); });