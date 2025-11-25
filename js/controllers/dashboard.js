import { API } from '../api.js';
import { App } from '../app.js';

export const DashboardController = {
  init: async () => {
    const m = await API.getMetrics(App.state.user);
    document.getElementById('metric-total-leads').innerHTML = `<div class="text-3xl font-bold">${m.totalLeads || 0}</div><div class="text-sm text-slate-500">Total</div>`;
    document.getElementById('metric-conversions').innerHTML = `<div class="text-3xl font-bold">${m.converted || 0}</div><div class="text-sm text-slate-500">Converted</div>`;

    // Simple Funnel
    const el = document.getElementById('funnel-chart');
    el.innerHTML = Object.keys(m.byStatus || {}).map(k => `
        <div class="flex justify-between text-sm mb-1"><span>${k}</span><span>${m.byStatus[k]}</span></div>
        <div class="w-full bg-slate-100 h-2 rounded overflow-hidden"><div class="bg-brand-600 h-full" style="width:${(m.byStatus[k] / m.totalLeads) * 100}%"></div></div>
    `).join('');
  }
};