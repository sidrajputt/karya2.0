import { Router } from './router.js';
import { createIcons, icons } from "https://unpkg.com/lucide@latest/dist/esm/lucide.js";

export const App = {
  state: { user: null },

  init: () => {
    // 1. Session Check
    const storedUser = localStorage.getItem('karya_user');

    if (storedUser) {
      try {
        App.state.user = JSON.parse(storedUser);
        App.loadApp();
      } catch (e) {
        App.logout();
      }
    } else {
      Router.navigate('landing');
      App.hideLoader();
    }

    // 2. Bind Global Logout
    window.logout = () => App.logout();
    window.navigate = (p) => Router.navigate(p);
  },

  logout: () => {
    localStorage.removeItem('karya_user');
    App.state.user = null;
    window.location.href = "index.html"; // Hard reload ensures clean state
  },

  hideLoader: () => {
    const loader = document.getElementById('global-loader');
    const app = document.getElementById('app-container');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 500);
    }
    if (app) app.style.opacity = '1';
  },

  loadApp: () => {
    App.renderNav();
    App.hideLoader();
    const hash = window.location.hash.replace('#', '');
    if (!hash || hash === 'login' || hash === 'landing') {
      Router.navigate('dashboard');
    } else {
      Router.navigate(hash);
    }
  },

  renderNav: () => {
    const u = App.state.user;
    if (!u) return;

    const rawRole = (u.Role || 'Employee').toLowerCase().replace(' ', '');
    let links = [];

    if (rawRole.includes('admin')) {
      links = [
        { id: 'dashboard', icon: 'Layout-Dashboard', label: 'Command' },
        { id: 'leads', icon: 'Layers', label: 'Leads' },
        { id: 'users', icon: 'Users', label: 'Users' },
        { id: 'teams', icon: 'Briefcase', label: 'Teams' },
        { id: 'admin', icon: 'Settings', label: 'Admin' }
      ];
    }
    else if (rawRole === 'supervisor') {
      links = [
        { id: 'dashboard', icon: 'Layout-Dashboard', label: 'Stats' },
        { id: 'leads', icon: 'Layers', label: 'Leads' },
        { id: 'users', icon: 'Users', label: 'Team' }
      ];
    }
    else {
      links = [
        { id: 'dashboard', icon: 'Layout-Dashboard', label: 'Stats' },
        { id: 'leads', icon: 'Layers', label: 'Leads' }
      ];
    }

    const sidebar = document.getElementById('nav-sidebar');
    if (sidebar) {
      sidebar.className = "hidden md:flex fixed inset-y-0 left-0 w-64 bg-[#0f172a] text-white z-50 flex-col transition-transform shadow-2xl border-r border-slate-800";
      sidebar.innerHTML = `
        <div class="h-20 flex items-center px-6 bg-white border-b border-slate-200 shadow-sm z-10">
            <img src="assets/logo.png" class="h-8 w-auto object-contain" alt="Karya" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
            <div class="hidden w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-xl">K</div>
        </div>
        <nav class="flex-1 px-3 py-6 space-y-1 overflow-y-auto custom-scroll-dark">
            <div class="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Menu</div>
            ${links.map(l => `
                <button onclick="window.navigate('${l.id}')" id="nav-d-${l.id}" class="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-400 rounded-xl transition-all duration-200 hover:bg-white/10 hover:text-white group nav-item">
                    <i data-lucide="${l.icon}" class="w-5 h-5 group-hover:text-blue-400 transition-colors"></i> 
                    ${l.label}
                </button>
            `).join('')}
        </nav>
        <div class="p-4 border-t border-slate-800 bg-[#020617]">
            <div class="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800 transition cursor-pointer">
                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-lg border-2 border-slate-900">
                    ${u.Name.charAt(0)}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-bold text-white truncate">${u.Name}</div>
                    <div class="text-xs text-slate-500 truncate capitalize">${u.Role}</div>
                </div>
                <button onclick="window.logout()" class="text-slate-500 hover:text-red-400 transition p-1.5 rounded-lg hover:bg-slate-800"><i data-lucide="log-out" class="w-5 h-5"></i></button>
            </div>
        </div>`;
    }

    const mobHeader = document.getElementById('nav-mobile-header');
    if (mobHeader) {
      mobHeader.innerHTML = `
            <div class="flex items-center gap-3">
                <img src="assets/logo.png" class="h-8 w-auto object-contain" alt="Karya">
            </div>
            <button onclick="window.logout()" class="p-2 bg-slate-100 rounded-full text-slate-600 hover:text-red-600 transition"><i data-lucide="log-out" class="w-5 h-5"></i></button>
        `;
    }

    const bottomNav = document.getElementById('nav-mobile-bottom');
    if (bottomNav) {
      const mobileLinks = links.slice(0, 4);
      if (rawRole.includes('admin') && links.length > 4) mobileLinks[3] = { id: 'admin', icon: 'Settings', label: 'Admin' };
      bottomNav.innerHTML = mobileLinks.map(l => `
            <button onclick="window.navigate('${l.id}')" id="nav-m-${l.id}" class="flex flex-col items-center justify-center w-full h-full text-slate-400 hover:text-blue-600 transition nav-item">
                <i data-lucide="${l.icon}" class="w-6 h-6 mb-1"></i>
                <span class="text-[10px] font-bold truncate w-full text-center">${l.label}</span>
            </button>
        `).join('');
    }
    setTimeout(() => createIcons({ icons }), 50);
  }
};

document.addEventListener('DOMContentLoaded', App.init);