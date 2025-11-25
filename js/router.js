import { createIcons, icons } from "https://unpkg.com/lucide@latest/dist/esm/lucide.js";
import { LoginController } from './controllers/login.js';
import { DashboardController } from './controllers/dashboard.js';
import { LeadsController } from './controllers/leads.js';
import { AdminController } from './controllers/admin.js';

export const Router = {
  navigate: async (page) => {
    const container = document.getElementById('main-content');
    const sidebar = document.getElementById('nav-sidebar');
    const main = document.getElementById('main-content');
    const mobs = ['nav-mobile-header', 'nav-mobile-bottom'];

    // 1. Load HTML
    try {
      const res = await fetch(`pages/${page}.html`);
      const html = await res.text();
      container.innerHTML = `<div id="view-${page}" class="view-section animate-float-up">${html}</div>`;
    } catch (e) {
      console.error("Page Load Error", e);
      return;
    }

    // 2. Layout Logic
    const isPublic = ['landing', 'login'].includes(page);
    if (isPublic) {
      sidebar.classList.add('hidden'); sidebar.classList.remove('md:flex');
      main.classList.remove('md:pl-64', 'pt-16');
      mobs.forEach(id => document.getElementById(id).classList.add('hidden'));
    } else {
      sidebar.classList.remove('hidden'); sidebar.classList.add('md:flex');
      main.classList.add('md:pl-64', 'pt-16');
      mobs.forEach(id => document.getElementById(id).classList.remove('hidden'));

      // Active Menu
      document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('text-white', 'bg-white/10'); el.classList.add('text-slate-400');
      });
      const d = document.getElementById(`nav-d-${page}`);
      const m = document.getElementById(`nav-m-${page}`);
      if (d) { d.classList.remove('text-slate-400'); d.classList.add('text-white', 'bg-white/10'); }
      if (m) { m.classList.remove('text-slate-400'); m.classList.add('text-brand-600'); }
    }

    // 3. Init Controller
    if (page === 'login') LoginController.init();
    if (page === 'dashboard') DashboardController.init();
    if (page === 'leads') LeadsController.init();
    if (page === 'admin') AdminController.init();

    // 4. Global Bindings for Landing
    if (page === 'landing') {
      document.getElementById('btn-landing-login')?.addEventListener('click', () => Router.navigate('login'));
      document.getElementById('btn-landing-cta')?.addEventListener('click', () => Router.navigate('login'));
    }

    createIcons({ icons });
    window.scrollTo(0, 0);
  }
};
