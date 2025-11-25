import { auth } from '../config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { Utils } from '../utils.js';

export const LoginController = {
  init: () => {
    const form = document.getElementById('login-form');
    if (form) form.onsubmit = async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button');
      btn.disabled = true; btn.innerText = "Signing in...";
      try {
        await signInWithEmailAndPassword(auth, e.target.email.value, e.target.password.value);
      } catch (err) {
        Utils.toast('Login Failed: ' + err.message, 'error');
        btn.disabled = false; btn.innerText = "Sign In";
      }
    };
  }
};