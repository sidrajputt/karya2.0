import { db } from './config.js';
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  query, where, orderBy, getDoc, setDoc, limit, startAfter, writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const API = {
  async _handle(promise) {
    try { return await promise; }
    catch (e) { console.error("API Error:", e); throw e; }
  },

  // --- SECURITY ---
  async _hash(string) {
    if (!string) return null;
    const msgBuffer = new TextEncoder().encode(string);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  // ==========================
  // 1. AUTHENTICATION
  // ==========================
  async login(identifier, password) {
    const hashedPassword = await API._hash(password);
    let q;
    if (identifier.includes('@')) {
      q = query(collection(db, "users"), where("Email", "==", identifier), where("Password", "==", hashedPassword));
    } else {
      q = query(collection(db, "users"), where("Phone", "==", identifier), where("Password", "==", hashedPassword));
    }

    const snap = await getDocs(q);
    if (snap.empty) throw new Error("Invalid credentials.");

    const userDoc = snap.docs[0];
    const userData = userDoc.data();

    if (userData.Status === 'Inactive') throw new Error("Account is inactive. Contact Admin.");

    return { id: userDoc.id, ...userData };
  },

  // ==========================
  // 2. USER MANAGEMENT (Fixed Filtering)
  // ==========================
  async getUsers(requestingUser) {
    // If no user passed, return all (fallback)
    if (!requestingUser) {
      const snap = await getDocs(collection(db, "users"));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    const role = (requestingUser.Role || '').toLowerCase();

    if (role === 'superadmin') {
      // Admin sees all
      const snap = await getDocs(collection(db, "users"));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    else if (role === 'supervisor') {
      // 1. Get Teams managed by this Supervisor
      const teamQ = query(collection(db, "teams"), where("SupervisorID", "==", requestingUser.UserID));
      const teamSnap = await getDocs(teamQ);
      const myTeamIds = teamSnap.docs.map(t => t.id);

      if (myTeamIds.length === 0) {
        // No teams? See only self.
        return [{ id: requestingUser.UserID, ...requestingUser }];
      }

      // 2. Get Users in those teams
      // Firestore 'in' supports max 10. If > 10 teams, we fetch all and filter in memory for safety.
      if (myTeamIds.length > 10) {
        const snap = await getDocs(collection(db, "users"));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(u => myTeamIds.includes(u.TeamID) || u.id === requestingUser.UserID);
      }

      const userQ = query(collection(db, "users"), where("TeamID", "in", myTeamIds));
      const userSnap = await getDocs(userQ);
      const users = userSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Add self if not in list
      if (!users.find(u => u.id === requestingUser.UserID)) {
        users.push({ id: requestingUser.UserID, ...requestingUser });
      }
      return users;
    }
    else {
      // Executive: Sees only self
      return [{ id: requestingUser.UserID, ...requestingUser }];
    }
  },

  async checkEmailExists(email) {
    const q = query(collection(db, "users"), where("Email", "==", email));
    const snap = await getDocs(q);
    return !snap.empty;
  },

  async addUser(data) {
    const exists = await API.checkEmailExists(data.Email);
    if (exists) throw new Error("Email already exists.");

    if (data.Password) data.Password = await API._hash(data.Password);

    data.CreatedAt = new Date().toISOString();
    data.Status = 'Active';
    return this._handle(addDoc(collection(db, "users"), data));
  },

  async updateUser(id, data) {
    if (data.Password) {
      data.Password = await API._hash(data.Password);
    }
    return this._handle(updateDoc(doc(db, "users", id), data));
  },

  async deleteUser(id) {
    return this._handle(deleteDoc(doc(db, "users", id)));
  },

  async deleteUserSafe(userId, targetTransferId) {
    const batch = writeBatch(db);
    let count = 0;

    const leadsQ = query(collection(db, "leads"), where("EnteredBy", "==", userId));
    const leadsSnap = await getDocs(leadsQ);
    leadsSnap.forEach(doc => {
      batch.update(doc.ref, { EnteredBy: targetTransferId });
      count++;
    });

    const teamsQ = query(collection(db, "teams"), where("SupervisorID", "==", userId));
    const teamsSnap = await getDocs(teamsQ);
    teamsSnap.forEach(doc => {
      batch.update(doc.ref, { SupervisorID: targetTransferId });
      count++;
    });

    const userRef = doc(db, "users", userId);
    batch.delete(userRef);

    await batch.commit();
    return count;
  },

  async getUserStats(userId) {
    const q = query(collection(db, "leads"), where("EnteredBy", "==", userId));
    const snap = await getDocs(q);
    const leads = snap.docs.map(d => d.data());

    const byStatus = {};
    leads.forEach(l => {
      const s = l.Status || 'New';
      byStatus[s] = (byStatus[s] || 0) + 1;
    });

    return {
      total: leads.length,
      converted: leads.filter(l => l.Status === 'Admission Done').length,
      hot: leads.filter(l => l.LeadAura === 'Hot').length,
      byStatus: byStatus
    };
  },

  async getUserLeads(userId) {
    const q = query(collection(db, "leads"), where("EnteredBy", "==", userId));
    const snap = await getDocs(q);
    let leads = snap.docs.map(d => ({ id: d.id, ...d.data(), CreatedAt: d.data().CreatedAt || '' }));
    leads.sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));
    return leads.slice(0, 50);
  },

  // ==========================
  // 3. TEAMS (Fixed Filtering)
  // ==========================
  async getTeams(requestingUser) {
    // Fallback for no user
    if (!requestingUser) {
      const snap = await getDocs(collection(db, "teams"));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    const role = (requestingUser.Role || '').toLowerCase();
    let q;

    if (role === 'superadmin') {
      q = query(collection(db, "teams"));
    }
    else if (role === 'supervisor') {
      // Supervisor: Only MY teams
      q = query(collection(db, "teams"), where("SupervisorID", "==", requestingUser.UserID));
    }
    else {
      // Executive: Only assigned team
      if (requestingUser.TeamID) {
        // Note: We cannot query by document ID easily in 'where' without documentId().
        // Easiest is to fetch all and filter by ID in memory for single item.
        const snap = await getDocs(collection(db, "teams"));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(t => t.id === requestingUser.TeamID);
      } else {
        return [];
      }
    }

    const snap = await this._handle(getDocs(q));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async addTeam(data) {
    data.CreatedAt = new Date().toISOString();
    return this._handle(addDoc(collection(db, "teams"), data));
  },

  async updateTeam(id, data) {
    return this._handle(updateDoc(doc(db, "teams", id), data));
  },

  async deleteTeam(id) {
    const batch = writeBatch(db);
    const q = query(collection(db, "users"), where("TeamID", "==", id));
    const snap = await getDocs(q);
    snap.forEach(doc => {
      batch.update(doc.ref, { TeamID: "Unassigned" });
    });
    batch.delete(doc(db, "teams", id));
    return batch.commit();
  },

  async getTeamStats(teamId) {
    const q = query(collection(db, "leads"), where("TeamID", "==", teamId));
    const snap = await getDocs(q);
    const leads = snap.docs.map(d => d.data());

    const total = leads.length;
    const converted = leads.filter(l => l.Status === 'Admission Done').length;
    const hot = leads.filter(l => l.LeadAura === 'Hot').length;

    const growth = {};
    leads.forEach(l => {
      const d = new Date(l.CreatedAt).toLocaleDateString('en-US', { weekday: 'short' });
      growth[d] = (growth[d] || 0) + 1;
    });

    return { total, converted, hot, growth };
  },

  // ==========================
  // 4. LEADS (Robust)
  // ==========================
  async getLeads(user, lastDocStub, pageSize, filters = {}) {
    try {
      const snap = await getDocs(collection(db, "leads"));
      let all = snap.docs.map(d => ({ ...d.data(), LeadID: d.id, CreatedAt: d.data().CreatedAt || new Date().toISOString() }));
      all.sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));

      const role = (user.Role || '').toLowerCase();
      if (role === 'executive') {
        all = all.filter(l => l.EnteredBy === user.UserID);
      } else if (role === 'supervisor') {
        const teamQ = query(collection(db, "teams"), where("SupervisorID", "==", user.UserID));
        const teams = await getDocs(teamQ);
        const myTeamIds = teams.docs.map(t => t.id);
        all = all.filter(l => myTeamIds.includes(l.TeamID) || l.EnteredBy === user.UserID);
      }

      if (filters.search) {
        const s = filters.search.toLowerCase();
        all = all.filter(l => (l.Name && l.Name.toLowerCase().includes(s)) || (l.Phone && l.Phone.includes(s)));
      }
      if (filters.type) all = all.filter(l => l.LeadType === filters.type);
      if (filters.status) all = all.filter(l => l.Status === filters.status);
      if (filters.aura) all = all.filter(l => l.LeadAura === filters.aura);
      if (filters.course) all = all.filter(l => l.InterestedCourse === filters.course);
      if (filters.route) all = all.filter(l => l.RouteFrom === filters.route);
      if (filters.team) all = all.filter(l => l.TeamID === filters.team);
      if (filters.executive) all = all.filter(l => l.EnteredBy === filters.executive);

      let startIndex = 0;
      if (lastDocStub && lastDocStub.id) {
        const idx = all.findIndex(l => l.LeadID === lastDocStub.id);
        if (idx !== -1) startIndex = idx + 1;
      }
      const sliced = all.slice(startIndex, startIndex + pageSize);
      const newLastDoc = sliced.length > 0 ? { id: sliced[sliced.length - 1].LeadID } : null;

      return { data: sliced, lastDoc: newLastDoc };
    } catch (e) { return { data: [], lastDoc: null }; }
  },

  async addLead(data, user) {
    data.EnteredBy = user.UserID;
    data.TeamID = user.TeamID || "Unassigned";
    data.CreatedAt = new Date().toISOString();
    data.Status = data.Status || "New Added";
    data.LeadAura = data.LeadAura || "Mild";
    return this._handle(addDoc(collection(db, "leads"), data));
  },

  async updateLead(id, data) {
    data.UpdatedAt = new Date().toISOString();
    return this._handle(setDoc(doc(db, "leads", id), data, { merge: true }));
  },

  async importLeads(rows, user) {
    const batch = writeBatch(db);
    rows.forEach(r => {
      const ref = doc(collection(db, 'leads'));
      batch.set(ref, { ...r, EnteredBy: user.UserID, TeamID: user.TeamID || 'Unassigned', CreatedAt: new Date().toISOString() });
    });
    return batch.commit();
  },

  // ==========================
  // 5. DASHBOARD
  // ==========================
  async getDashboardStats(user) {
    // Fetch data with permissions applied manually
    const [leadsSnap, usersSnap] = await Promise.all([getDocs(collection(db, "leads")), getDocs(collection(db, "users"))]);
    let leads = leadsSnap.docs.map(d => ({ ...d.data(), CreatedAt: d.data().CreatedAt || new Date().toISOString() }));

    // Role Filter for Stats
    const role = (user.Role || '').toLowerCase();
    if (role === 'executive') {
      leads = leads.filter(l => l.EnteredBy === user.UserID);
    } else if (role === 'supervisor') {
      const teamQ = query(collection(db, "teams"), where("SupervisorID", "==", user.UserID));
      const teams = await getDocs(teamQ);
      const myTeamIds = teams.docs.map(t => t.id);
      leads = leads.filter(l => myTeamIds.includes(l.TeamID) || l.EnteredBy === user.UserID);
    }

    const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const userMap = {}; users.forEach(u => userMap[u.id] = u);

    const now = new Date();
    const total = leads.length;
    const converted = leads.filter(l => l.Status === 'Admission Done').length;
    const hot = leads.filter(l => l.LeadAura === 'Hot').length;
    const todayLeads = leads.filter(l => (now - new Date(l.CreatedAt)) < 86400000);

    const activeSet = new Set();
    todayLeads.forEach(l => activeSet.add(l.EnteredBy));
    const activeUsersList = Array.from(activeSet).map(uid => ({
      name: userMap[uid]?.Name || 'Unknown',
      role: userMap[uid]?.Role || '-',
      lastAction: new Date().toISOString()
    }));

    const growth = {};
    leads.forEach(l => {
      const d = new Date(l.CreatedAt).toLocaleDateString('en-US', { weekday: 'short' });
      growth[d] = (growth[d] || 0) + 1;
    });

    const feed = leads.sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt)).slice(0, 10).map(l => ({
      user: userMap[l.EnteredBy]?.Name || 'System',
      action: 'added lead',
      target: l.Name,
      time: l.CreatedAt
    }));

    const reportData = users.map(u => {
      const userLeads = leads.filter(l => l.EnteredBy === u.id);
      const conv = userLeads.filter(l => l.Status === 'Admission Done').length;
      return { name: u.Name, total: userLeads.length, converted: conv, rate: userLeads.length ? Math.round((conv / userLeads.length) * 100) + '%' : '0%' };
    }).filter(r => r.total > 0);

    return { total, converted, hot, todayCount: todayLeads.length, activeUsersList, growth, byAura: {}, bySource: {}, feed, reportData };
  },

  // ==========================
  // 6. UTILS
  // ==========================
  async getSettings() {
    const d = await this._handle(getDoc(doc(db, 'settings', 'meta')));
    return d.exists() ? d.data() : {};
  },
  async setSettings(obj) {
    return this._handle(setDoc(doc(db, 'settings', 'meta'), obj, { merge: true }));
  },
  async checkUsage(k, v) {
    const q = query(collection(db, 'leads'), where(k, '==', v));
    return (await getDocs(q)).size;
  },
  async batchUpdateLeads(k, o, n) {
    const q = query(collection(db, 'leads'), where(k, '==', o));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach(doc => batch.update(doc.ref, { [k]: n }));
    await batch.commit();
    return snap.size;
  },

  // ==========================
  // 6. ADMIN & BACKUP (New)
  // ==========================

  async getSettings() {
    const d = await this._handle(getDoc(doc(db, 'settings', 'meta')));
    return d.exists() ? d.data() : {};
  },

  async setSettings(obj) {
    return this._handle(setDoc(doc(db, 'settings', 'meta'), obj, { merge: true }));
  },

  async checkUsage(k, v) {
     const q = query(collection(db, 'leads'), where(k, '==', v));
     return (await getDocs(q)).size;
  },

  async batchUpdateLeads(k, o, n) {
     const q = query(collection(db, 'leads'), where(k, '==', o));
     const snap = await getDocs(q);
     const batch = writeBatch(db);
     snap.forEach(doc => batch.update(doc.ref, { [k]: n }));
     await batch.commit();
     return snap.size;
  },

  // --- SYSTEM BACKUP ---
  async createBackup() {
      const backup = { timestamp: new Date().toISOString(), version: '2.0' };
      const collections = ['users', 'teams', 'leads', 'settings'];
      
      for (const col of collections) {
          const snap = await getDocs(collection(db, col));
          backup[col] = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
      }
      return backup;
  },

  async restoreBackup(data) {
      const batch = writeBatch(db);
      let count = 0;
      const LIMIT = 450; // Firestore batch limit

      // Loop through collections
      for (const col of ['users', 'teams', 'leads', 'settings']) {
          if (!data[col]) continue;
          
          for (const item of data[col]) {
              const ref = doc(db, col, item._id);
              const payload = { ...item };
              delete payload._id; // Remove backup ID key
              
              batch.set(ref, payload);
              count++;

              if (count >= LIMIT) {
                  await batch.commit();
                  count = 0;
              }
          }
      }
      if (count > 0) await batch.commit();
      return true;
  }
};