import { API } from '../api.js';
import { App } from '../app.js';
import { Utils } from '../utils.js';
import { createIcons, icons } from "https://unpkg.com/lucide@latest/dist/esm/lucide.js";

export const DashboardController = {
  data: null,

  init: async () => {
    if (!document.getElementById('chart-main')) return;

    try {
      const currentUser = App.state.user;
      document.getElementById('dashboard-subtitle').innerText = `Welcome back, ${currentUser.Name}. Here's your briefing.`;

      // Fetch Data
      const data = await API.getAdvancedStats(currentUser);
      DashboardController.data = data;

      // Render All
      DashboardController.renderMetrics(data);
      DashboardController.renderCharts(data);
      DashboardController.renderTable(data.leaderboard);

      // Bind Events
      document.getElementById('metric-dynamic-card')?.addEventListener('click', DashboardController.showLiveFeed);
      document.getElementById('btn-download-report')?.addEventListener('click', DashboardController.downloadReport);

    } catch (e) { console.error(e); }

    createIcons({ icons });
  },

  renderMetrics: (data) => {
    document.getElementById('metric-total').innerText = data.total;
    document.getElementById('metric-conversion').innerText = Math.round((data.converted / (data.total || 1)) * 100) + '%';
    document.getElementById('metric-hot').innerText = data.hot;
    document.getElementById('metric-today').innerText = data.todayCount;

    if (data.todayCount > 0) {
      document.getElementById('live-status-text').innerText = `${data.todayCount} Leads Today`;
      document.getElementById('live-status-text').className = "text-xs font-bold text-green-600";
    }
  },

  renderTable: (rows) => {
    const tbody = document.getElementById('stats-table-body');
    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400 text-sm">No performance data available.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.slice(0, 10).map(r => {
      // Performance Bar Logic
      const width = Math.min(100, (r.total / (rows[0].total || 1)) * 100);
      const color = r.rate > 20 ? 'bg-green-500' : r.rate > 10 ? 'bg-blue-500' : 'bg-slate-400';

      return `
            <tr class="hover:bg-slate-50 border-b border-slate-50 transition last:border-0">
                <td class="p-4 pl-6 font-bold text-slate-700">${r.name}</td>
                <td class="p-4 text-xs text-slate-500 uppercase">${r.role}</td>
                <td class="p-4 text-center font-mono text-slate-600">${r.total}</td>
                <td class="p-4 text-center font-mono text-green-600 font-bold">${r.converted}</td>
                <td class="p-4 text-center font-bold text-slate-800">${r.rate}%</td>
                <td class="p-4 pr-6">
                    <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div class="h-full rounded-full ${color}" style="width: ${width}%"></div>
                    </div>
                </td>
            </tr>`;
    }).join('');
  },

  renderCharts: (data) => {
    const opts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };

    // 1. Main Growth Chart (Line)
    new Chart(document.getElementById('chart-main'), {
      type: 'line',
      data: {
        labels: Object.keys(data.growth),
        datasets: [{
          label: 'Leads',
          data: Object.values(data.growth),
          borderColor: '#2563eb',
          backgroundColor: (ctx) => {
            const grad = ctx.chart.ctx.createLinearGradient(0, 0, 0, 300);
            grad.addColorStop(0, 'rgba(37,99,235,0.2)');
            grad.addColorStop(1, 'rgba(37,99,235,0)');
            return grad;
          },
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: { ...opts, scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } } }
    });

    // 2. Pie Chart (Aura)
    new Chart(document.getElementById('chart-pie'), {
      type: 'doughnut',
      data: {
        labels: ['Hot', 'Mild', 'Cold'],
        datasets: [{
          data: [data.byAura.Hot, data.byAura.Mild, data.byAura.Cold],
          backgroundColor: ['#22c55e', '#eab308', '#94a3b8'],
          borderWidth: 0
        }]
      },
      options: { ...opts, cutout: '75%', plugins: { legend: { position: 'bottom' } } }
    });

    // 3. Routes (Bar)
    const sortedRoutes = Object.entries(data.byRoute).sort((a, b) => b[1] - a[1]).slice(0, 5);
    new Chart(document.getElementById('chart-routes'), {
      type: 'bar',
      data: {
        labels: sortedRoutes.map(x => x[0]),
        datasets: [{
          label: 'Leads',
          data: sortedRoutes.map(x => x[1]),
          backgroundColor: '#1e293b',
          borderRadius: 6,
          barThickness: 20
        }]
      },
      options: opts
    });

    // 4. Courses (Horizontal Bar)
    const sortedCourses = Object.entries(data.byCourse).sort((a, b) => b[1] - a[1]).slice(0, 5);
    new Chart(document.getElementById('chart-courses'), {
      type: 'bar',
      indexAxis: 'y',
      data: {
        labels: sortedCourses.map(x => x[0]),
        datasets: [{
          label: 'Demand',
          data: sortedCourses.map(x => x[1]),
          backgroundColor: '#3b82f6',
          borderRadius: 4,
          barThickness: 15
        }]
      },
      options: opts
    });
  },

  showLiveFeed: () => {
    const feed = DashboardController.data.feed;
    const modalHtml = document.getElementById('tpl-active-modal').innerHTML;
    Utils.modal.open(modalHtml);

    const listEl = document.getElementById('active-feed-list');
    if (feed.length === 0) {
      listEl.innerHTML = `<div class="text-center text-slate-400 text-sm py-4">No activity today.</div>`;
    } else {
      listEl.innerHTML = feed.map(f => `
              <div class="flex gap-3 items-start p-2 border-b border-slate-100 last:border-0">
                  <div class="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">${f.user.charAt(0)}</div>
                  <div>
                      <div class="text-sm text-slate-800 font-bold">${f.user} <span class="font-normal text-slate-500">added lead</span></div>
                      <div class="text-xs text-slate-500">${f.target}</div>
                      <div class="text-[10px] text-slate-400 mt-0.5">${new Date(f.time).toLocaleTimeString()}</div>
                  </div>
              </div>
          `).join('');
    }
    document.querySelector('#modal-content .btn-close-modal').onclick = Utils.modal.close;
  },

  downloadReport: () => {
    if (!window.jspdf) return Utils.toast('PDF lib loading...', 'error');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(`Performance Report - ${new Date().toLocaleDateString()}`, 14, 20);
    doc.autoTable({ html: '#stats-table', startY: 30 });
    doc.save('Performance_Report.pdf');
  }
};
window.DashboardController = DashboardController;