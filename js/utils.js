export const Utils = {
  toast: (msg, type = 'info') => {
    const el = document.createElement('div');
    const bg = type === 'error' ? 'bg-red-600' : 'bg-slate-900';
    el.className = `${bg} text-white px-4 py-3 rounded-lg shadow-xl text-sm font-medium animate-bounce flex items-center gap-2`;
    el.innerHTML = `<span>${msg}</span>`;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => { el.remove(); }, 3000);
  },
  
  modal: {
    open: (contentHTML) => {
      const m = document.getElementById('modal-overlay');
      document.getElementById('modal-content').innerHTML = contentHTML;
      m.classList.remove('hidden');
      // Bind close button
      const closeBtn = m.querySelector('.btn-close-modal');
      if(closeBtn) closeBtn.onclick = Utils.modal.close;
    },
    close: () => {
      document.getElementById('modal-overlay').classList.add('hidden');
    }
  }
};
