import { db } from './config.js';
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  query, where, orderBy, getDoc, setDoc, limit, startAfter, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const API = {
  async _handle(promise) {
    try { return await promise; }
    catch (e) { console.error("API Error:", e); throw e; }
  },

  // --- LEADS ---
  async getLeads(user, lastVisible = null, pageSize = 20) {
    let constraints = [orderBy("CreatedAt", "desc")];

    // Role-Based Filtering
    if (user.Role === 'Employee') {
      constraints.push(where("AssignedTo", "==", user.UserID));
    }
    // Pagination
    if (lastVisible) constraints.push(startAfter(lastVisible));
    constraints.push(limit(pageSize));

    const q = query(collection(db, "leads"), ...constraints);
    const snap = await this._handle(getDocs(q));

    return {
      data: snap.docs.map(d => ({ ...d.data(), LeadID: d.id })),
      lastDoc: snap.docs[snap.docs.length - 1] || null
    };
  },

  async getLeadById(leadId) {
    const d = await this._handle(getDoc(doc(db, "leads", leadId)));
    return d.exists() ? { id: d.id, ...d.data() } : null;
  },

  async addLead(data, user) {
    data.EnteredBy = user.UserID;
    data.TeamID = user.TeamID || "Unassigned";
    data.CreatedAt = serverTimestamp();
    data.Status = data.Status || "New";
    return this._handle(addDoc(collection(db, "leads"), data));
  },

  async updateLead(id, data) {
    data.UpdatedAt = serverTimestamp();
    return this._handle(setDoc(doc(db, "leads", id), data, { merge: true }));
  },

  async importLeads(rows, user) {
    const batch = (await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js")).writeBatch(db);
    rows.forEach(r => {
      const ref = doc(collection(db, 'leads'));
      batch.set(ref, {
        Name: r.Name || r.name || 'Unknown',
        Phone: r.Phone || r.phone || '',
        LeadType: r.LeadType || 'Student',
        Status: 'New',
        OriginType: r.OriginType || 'Import',
        CreatedAt: serverTimestamp()
      });
    });
    return batch.commit();
  },

  // --- SETTINGS & USERS ---
  async getSettings() {
    const d = await this._handle(getDoc(doc(db, 'settings', 'meta')));
    return d.exists() ? d.data() : {};
  },

  async setSettings(obj) {
    return this._handle(setDoc(doc(db, 'settings', 'meta'), obj, { merge: true }));
  },

  async getUsers() {
    const snap = await this._handle(getDocs(collection(db, "users")));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async resetPassword(uid) {
    // Cloud function trigger placeholder
    console.log("Reset password trigger for", uid);
    return true;
  },

  // --- METRICS ---
  async getMetrics(user) {
    // Note: For large datasets, use Aggregation Queries. This is client-side for now.
    const snap = await getDocs(collection(db, "leads"));
    const all = snap.docs.map(d => d.data());
    const totalLeads = all.length;
    const converted = all.filter(x => x.Status === 'Converted').length;
    const byStatus = {};
    all.forEach(x => { byStatus[x.Status || 'New'] = (byStatus[x.Status || 'New'] || 0) + 1; });
    return { totalLeads, converted, byStatus };
  }
};