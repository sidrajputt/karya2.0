import { API } from '../api.js';
import { App } from '../app.js';
import { Utils } from '../utils.js';

export const LoginController = {
  init: () => {
    const form = document.getElementById('login-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button');
        const identifier = e.target.identifier.value.trim(); // Changed from 'email'
        const pass = e.target.password.value.trim();

        if (!identifier || !pass) return Utils.toast("Please enter credentials", "error");

        btn.disabled = true;
        const originalText = btn.innerText;
        btn.innerText = "Verifying...";

        try {
          const user = await API.login(identifier, pass);
          localStorage.setItem('karya_user', JSON.stringify(user));
          App.state.user = user;
          App.loadApp();
        } catch (err) {
          console.error(err);
          Utils.toast(err.message, 'error');
          btn.disabled = false;
          btn.innerText = originalText;
        }
      };
    }
  }
};