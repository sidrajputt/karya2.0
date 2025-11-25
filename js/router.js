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

    try {
      const res = await fetch(`pages/${page}.html`);
      if (!res.ok) throw new Error("404");
      const html = await res.text();
      container.innerHTML = `<div id="view-${page}" class="view-section animate-float-up">${html}</div>`;
    } catch (e) { console.error(e); return; }

    const isPublic = ['landing', 'login'].includes(page);
    if (isPublic) {
      // Public Page: Hide sidebar and mobile navs everywhere
      sidebar.classList.add('hidden');
      sidebar.classList.remove('md:flex');

      main.classList.remove('md:pl-64', 'pt-16');
      mobs.forEach(id => document.getElementById(id).classList.add('hidden'));
    } else {
      // Private Page (Dashboard/Leads): 
      // Sidebar: Hidden on Mobile (base), Flex on Desktop (md:flex)
      // FIX: Do NOT remove 'hidden'. The 'md:flex' class overrides it on desktop.
      sidebar.classList.add('hidden');
      sidebar.classList.add('md:flex');

      // Main Content: Add padding for sidebar (desktop) and header (mobile)
      main.classList.add('md:pl-64', 'pt-16');

      // Mobile Navs: Show on mobile (remove 'hidden'), they hide themselves on desktop via CSS (md:hidden)
      mobs.forEach(id => document.getElementById(id).classList.remove('hidden'));

      // Update active state in sidebar
      document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('text-white', 'bg-white/10'); el.classList.add('text-slate-400');
      });
      const d = document.getElementById(`nav-d-${page}`);
      const m = document.getElementById(`nav-m-${page}`);
      if (d) { d.classList.remove('text-slate-400'); d.classList.add('text-white', 'bg-white/10'); }
      if (m) { m.classList.remove('text-slate-400'); m.classList.add('text-brand-600'); }
    }

    // Init Controller
    if (page === 'login') LoginController.init();
    if (page === 'dashboard') DashboardController.init();
    if (page === 'leads') LeadsController.init();
    if (page === 'admin') AdminController.init();
    if (page === 'landing') {
      document.querySelectorAll('.btn-to-login').forEach(b => b.onclick = () => Router.navigate('login'));
    }

    createIcons({ icons });
    window.scrollTo(0, 0);
  }
};