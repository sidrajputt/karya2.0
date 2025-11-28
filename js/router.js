import { createIcons, icons } from "https://unpkg.com/lucide@latest/dist/esm/lucide.js";
import { LoginController } from './controllers/login.js';
import { DashboardController } from './controllers/dashboard.js';
import { LeadsController } from './controllers/leads.js';
import { AdminController } from './controllers/admin.js';
import { UsersController } from './controllers/users.js';
import { TeamsController } from './controllers/teams.js'; // 1. Added Import

export const Router = {
  navigate: async (page) => {
    const container = document.getElementById('main-content');
    const sidebar = document.getElementById('nav-sidebar');
    const main = document.getElementById('main-content');
    const mobs = ['nav-mobile-header', 'nav-mobile-bottom'];

    // 2. REMOVED THE REDIRECT LOGIC
    // (Deleted: if (page === 'teams') fileToLoad = 'users';)

    try {
      const res = await fetch(`pages/${page}.html`); // Loads teams.html when page is 'teams'
      if (!res.ok) throw new Error("404");
      const html = await res.text();
      container.innerHTML = `<div id="view-${page}" class="view-section animate-float-up">${html}</div>`;
    } catch (e) { console.error(e); return; }

    const isPublic = ['landing', 'login'].includes(page);

    if (isPublic) {
      sidebar.classList.add('hidden');
      sidebar.classList.remove('md:flex');
      main.classList.remove('md:pl-64', 'pt-16', 'pb-20');
      mobs.forEach(id => document.getElementById(id)?.classList.add('hidden'));
    } else {
      sidebar.classList.remove('hidden');
      sidebar.classList.add('hidden', 'md:flex');
      main.classList.add('md:pl-64', 'pt-16', 'pb-20');
      mobs.forEach(id => document.getElementById(id)?.classList.remove('hidden'));

      document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('bg-white/5', 'text-white', 'text-blue-600');
        el.classList.add('text-slate-400');
      });

      const d = document.getElementById(`nav-d-${page}`);
      if (d) { d.classList.remove('text-slate-400'); d.classList.add('bg-white/5', 'text-white'); }

      const m = document.getElementById(`nav-m-${page}`);
      if (m) { m.classList.remove('text-slate-400'); m.classList.add('text-blue-600'); }
    }

    // 3. Init Correct Controller
    if (page === 'login') LoginController.init();
    if (page === 'dashboard') DashboardController.init();
    if (page === 'leads') LeadsController.init();
    if (page === 'users') UsersController.init();
    if (page === 'teams') TeamsController.init();
    if (page === 'admin') AdminController.init();

    createIcons({ icons });
    window.scrollTo(0, 0);
  }
};