import { db } from './config.js';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const API = {
  // --- READ ---
  getLeads: async (user) => {
    let q = query(collection(db, "leads"), orderBy("Timestamp", "desc"));
    if (user.Role === 'user') {
      q = query(collection(db, "leads"), where("EnteredBy", "==", user.UserID), orderBy("Timestamp", "desc"));
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), LeadID: d.id }));
  },

  getUsers: async () => {
    const snap = await getDocs(collection(db, "users"));
    return snap.docs.map(d => ({ ...d.data(), UserID: d.id }));
  },

  getTeams: async () => {
    const snap = await getDocs(collection(db, "teams"));
    return snap.docs.map(d => ({ ...d.data(), TeamID: d.id }));
  },

  getSettings: async () => {
    const snap = await getDocs(collection(db, "settings"));
    const s = {};
    snap.forEach(d => {
      const i = d.data();
      if (!s[i.Category]) s[i.Category] = [];
      s[i.Category].push({ value: i.Value, id: d.id });
    });
    return s;
  },

  // --- WRITE ---
  addLead: async (data, user) => {
    data.EnteredBy = user.UserID;
    data.TeamID = user.TeamID || "Unassigned";
    data.Timestamp = new Date().toISOString();
    data.Status = data.Status || "New";
    await addDoc(collection(db, "leads"), data);
    return { success: true };
  },

  updateLead: async (id, data) => {
    await updateDoc(doc(db, "leads", id), data);
    return { success: true };
  },

  addUser: async (data) => {
    data.CreatedAt = new Date().toISOString();
    await addDoc(collection(db, "users"), data);
    return { success: true };
  },

  addTeam: async (data) => {
    await addDoc(collection(db, "teams"), data);
    return { success: true };
  },

  addSetting: async (data) => {
    await addDoc(collection(db, "settings"), data);
    return { success: true };
  },

  deleteSetting: async (cat, val) => {
    const q = query(collection(db, "settings"), where("Category", "==", cat), where("Value", "==", val));
    const snap = await getDocs(q);
    snap.forEach(async (d) => await deleteDoc(d.ref));
  }
};

// Add these to your existing API object (merge carefully).

/*
  Added helper API functions:
  - getSettings()
  - setSettings(obj)
  - updateLead(leadId, data)
  - getLeadById(leadId)
  - getUsers()
  - resetPassword(uid)
  - importLeads(rows, user)
  - exportLeads(payload, user)
  - getMetrics(user)
*/

API.getSettings = async function () {
  try {
    if (window.firebase && firebase.firestore) {
      const doc = await firebase.firestore().collection('settings').doc('meta').get();
      if (doc.exists) return doc.data() || {};
      return {};
    } else if (API._httpBase) {
      const resp = await fetch(API._httpBase + '/settings');
      return resp.ok ? await resp.json() : {};
    } else return {};
  } catch (e) {
    console.error('getSettings', e); return {};
  }
};

API.setSettings = async function (obj) {
  try {
    if (window.firebase && firebase.firestore) {
      await firebase.firestore().collection('settings').doc('meta').set(obj, { merge: true });
      return true;
    } else if (API._httpBase) {
      const resp = await fetch(API._httpBase + '/settings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj) });
      return resp.ok;
    } else return false;
  } catch (e) { console.error('setSettings', e); return false; }
};

API.updateLead = async function (leadId, data) {
  try {
    if (window.firebase && firebase.firestore) {
      await firebase.firestore().collection('leads').doc(leadId).set(data, { merge: true });
      return true;
    } else if (API._httpBase) {
      const resp = await fetch(API._httpBase + `/leads/${leadId}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
      return resp.ok;
    } else throw new Error('No backend available');
  } catch (e) { console.error('updateLead', e); throw e; }
};

API.getLeadById = async function (leadId) {
  try {
    if (window.firebase && firebase.firestore) {
      const doc = await firebase.firestore().collection('leads').doc(leadId).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } else if (API._httpBase) {
      const resp = await fetch(API._httpBase + `/leads/${leadId}`);
      return resp.ok ? await resp.json() : null;
    } else return null;
  } catch (e) { console.error('getLeadById', e); return null; }
};

API.getUsers = async function () {
  try {
    if (window.firebase && firebase.firestore) {
      const snap = await firebase.firestore().collection('users').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } else if (API._httpBase) {
      const resp = await fetch(API._httpBase + '/users'); return resp.ok ? await resp.json() : [];
    } else return [];
  } catch (e) { console.error('getUsers', e); return []; }
};

API.resetPassword = async function (uid) {
  try {
    if (window.firebase && firebase.functions) {
      // If you have a cloud function for resetting password, call it.
      // Else, simply set a random pw somewhere or email user.
      const fn = firebase.functions().httpsCallable('adminResetPassword');
      const res = await fn({ uid });
      return res.data;
    } else if (API._httpBase) {
      const resp = await fetch(API._httpBase + `/users/${uid}/reset`, { method: 'POST' });
      return resp.ok;
    } else {
      // fallback: return false
      console.warn('resetPassword: no backend');
      return false;
    }
  } catch (e) { console.error('resetPassword', e); throw e; }
};

API.importLeads = async function (rows, user) {
  try {
    if (window.firebase && firebase.firestore) {
      const batch = firebase.firestore().batch();
      rows.forEach(r => {
        const id = firebase.firestore().collection('leads').doc().id;
        const ref = firebase.firestore().collection('leads').doc(id);
        // map keys loosely
        const doc = {
          Name: r.Name || r.name || r['Full Name'] || '',
          Phone: r.Phone || r.phone || r.Mobile || '',
          LeadType: r.LeadType || r.Type || 'Student',
          Status: r.Status || 'New',
          OriginType: r.OriginType || r.Source || '',
          CreatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        batch.set(ref, doc);
      });
      await batch.commit();
      return true;
    } else if (API._httpBase) {
      const resp = await fetch(API._httpBase + '/import/leads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rows, user }) });
      return resp.ok;
    } else return false;
  } catch (e) { console.error('importLeads', e); throw e; }
};

API.exportLeads = async function (payload, user) {
  try {
    // payload: { filters, fields }
    // If you want server-side export (large data), implement HTTP endpoint that returns CSV.
    // Fallback: client-side CSV generation (leads loaded in client).
    if (window.firebase && firebase.firestore) {
      const query = firebase.firestore().collection('leads').orderBy('CreatedAt', 'desc').limit(5000);
      const snap = await query.get();
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // create CSV from fields
      const fields = payload.fields || Object.keys(rows[0] || {});
      const csvArr = [fields.join(',')].concat(rows.map(r => fields.map(f => `"${String(r[f] ?? '').replace(/"/g, '""')}"`).join(',')));
      const csv = csvArr.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `leads_export_${Date.now()}.csv`; a.click();
      URL.revokeObjectURL(url);
      return true;
    } else if (API._httpBase) {
      const resp = await fetch(API._httpBase + '/export/leads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ payload, user }) });
      if (resp.ok) {
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `leads_export_${Date.now()}.csv`; a.click();
        URL.revokeObjectURL(url);
        return true;
      } else return false;
    } else return false;
  } catch (e) { console.error('exportLeads', e); throw e; }
};

API.getMetrics = async function (user) {
  try {
    if (window.firebase && firebase.firestore) {
      const col = firebase.firestore().collection('leads');
      const snap = await col.get();
      const all = snap.docs.map(d => d.data());
      const totalLeads = all.length;
      const converted = all.filter(x => String(x.Status || '') === 'Converted').length;
      const followupsDue = all.filter(x => Array.isArray(x.Timeline) && x.Timeline.some(t => t.type === 'followup')).length;
      const byStatus = {};
      all.forEach(x => { const s = x.Status || 'New'; byStatus[s] = (byStatus[s] || 0) + 1; });
      // team performance: aggregate by AssignedTo
      const teamMap = {};
      all.forEach(x => { const a = x.AssignedTo || x.assignedTo || 'unassigned'; teamMap[a] = teamMap[a] || { leads: 0, converted: 0 }; teamMap[a].leads++; if (x.Status === 'Converted') teamMap[a].converted++; });
      const team = Object.keys(teamMap).map(k => ({ id: k, name: k, leads: teamMap[k].leads, converted: teamMap[k].converted }));
      return { totalLeads, converted, followupsDue, byStatus, team };
    } else if (API._httpBase) {
      const resp = await fetch(API._httpBase + '/metrics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user }) });
      if (resp.ok) return await resp.json();
      return {};
    } else return {};
  } catch (e) { console.error('getMetrics', e); return {}; }
};
