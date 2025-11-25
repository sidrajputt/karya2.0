import { auth, db } from './config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { Router } from './router.js';
import { API } from './api.js';
import { createIcons, icons } from "https://unpkg.com/lucide@latest/dist/esm/lucide.js";

export const App = {
  state: { user: null },

  init: () => {
    // Global Logout
    window.logout = () => signOut(auth);
    window.navigate = (p) => Router.navigate(p);

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const snap = await getDoc(doc(db, "users", user.uid));
          if(snap.exists()) {
             App.state.user = { ...snap.data(), UserID: user.uid };
             
             // Pre-cache settings
             const s = await API.getSettings();
             localStorage.setItem('karya_settings', JSON.stringify(s));

             App.renderNav();
             Router.navigate('dashboard');
          } else {
             console.error("Profile not found");
             // Temp fix for admin if missing
             if(user.email === 'admin@karya.com') {
                App.state.user = { Name:"Admin", Role:"admin", UserID: user.uid };
                App.renderNav();
                Router.navigate('dashboard');
             } else {
                signOut(auth);
             }
          }
        } catch(e) { console.error(e); }
      } else {
        Router.navigate('landing');
      }
    });
  },

  renderNav: () => {
    const u = App.state.user;
    const role = u?.Role || 'user';
    let links = [{id:'dashboard',icon:'LayoutDashboard',label:'Dashboard'},{id:'leads',icon:'Users',label:'Leads'}];
    if(role !== 'user') links.push({id:'admin',icon:'Settings',label:'Admin'});

    // Sidebar
    document.getElementById('nav-sidebar').innerHTML = `
      <div class="p-6 border-b border-slate-800 flex items-center gap-3"><div class="w-8 h-8 bg-brand-600 rounded flex items-center justify-center font-bold">K</div><span class="font-bold text-xl">Karya</span></div>
      <nav class="flex-1 p-4 space-y-1">${links.map(l=>`<button onclick="window.navigate('${l.id}')" id="nav-d-${l.id}" class="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition nav-item"><i data-lucide="${l.icon}" class="w-5 h-5"></i> ${l.label}</button>`).join('')}</nav>
      <div class="p-4 border-t border-slate-800"><div class="mb-4 px-4"><div class="text-white font-medium truncate">${u.Name}</div><div class="text-slate-500 text-xs capitalize">${role}</div></div><button onclick="window.logout()" class="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg"><i data-lucide="LogOut" class="w-4 h-4"></i> Logout</button></div>`;
    
    // Mobile Header & Bottom
    document.getElementById('nav-mobile-header').innerHTML = `<div class="flex items-center gap-2"><div class="w-8 h-8 bg-brand-600 rounded flex items-center justify-center text-white font-bold text-sm">K</div><span class="font-bold text-lg text-slate-800">Karya</span></div><button onclick="window.logout()" class="text-slate-500"><i data-lucide="LogOut" class="w-5 h-5"></i></button>`;
    document.getElementById('nav-mobile-bottom').innerHTML = links.map(l=>`<button onclick="window.navigate('${l.id}')" id="nav-m-${l.id}" class="flex flex-col items-center justify-center w-full h-full text-slate-400 nav-item"><i data-lucide="${l.icon}" class="w-6 h-6 mb-1"></i><span class="text-[10px]">${l.label}</span></button>`).join('');
    
    createIcons({ icons });
  }
};

document.addEventListener('DOMContentLoaded', App.init);
