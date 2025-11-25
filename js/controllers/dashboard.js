// js/controllers/dashboard.js
import { API } from '../api.js';
import { App } from '../app.js';
import { Utils } from '../utils.js';

export const DashboardController = {
  init: async () => {
    try {
      const metrics = await API.getMetrics(App.state.user);
      document.getElementById('metric-total-leads').innerHTML = `<div class="text-3xl font-bold">${metrics.totalLeads || 0}</div><div class="text-sm text-slate-500">Total Leads</div>`;
      document.getElementById('metric-conversions').innerHTML = `<div class="text-3xl font-bold">${metrics.converted || 0}</div><div class="text-sm text-slate-500">Converted</div>`;
      document.getElementById('metric-followups').innerHTML = `<div class="text-3xl font-bold">${metrics.followupsDue || 0}</div><div class="text-sm text-slate-500">Follow-ups due</div>`;

      // funnel
      const funnelEl = document.getElementById('funnel-chart');
      funnelEl.innerHTML = '';
      const funnelHtml = ['New', 'Contacted', 'In Follow-up', 'Interested', 'Converted', 'Lost'].map(s => {
        return `<div class="mb-2"><div class="text-sm font-semibold">${s}</div><div class="text-xs text-slate-500">${metrics.byStatus?.[s] || 0} leads</div></div>`;
      }).join('');
      funnelEl.innerHTML = funnelHtml;

      const teamEl = document.getElementById('team-performance');
      teamEl.innerHTML = '';
      if (metrics.team && metrics.team.length) {
        teamEl.innerHTML = metrics.team.map(t => `<div class="mb-2"><div class="font-semibold">${t.name}</div><div class="text-sm text-slate-500">Leads: ${t.leads} • Converted: ${t.converted}</div></div>`).join('');
      } else {
        teamEl.innerHTML = `<div class="text-sm text-slate-500">No team data</div>`;
      }
    } catch (err) {
      console.error('dashboard init', err);
    }
  }
};

window.DashboardController = DashboardController;
