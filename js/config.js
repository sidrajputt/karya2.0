const firebaseConfig = {
  apiKey: "AIzaSyCckUpRFl9WT5IxhBiH1TYyaOEfx_OkknU",
  authDomain: "karyacrm-a41ae.firebaseapp.com",
  projectId: "karyacrm-a41ae",
  storageBucket: "karyacrm-a41ae.firebasestorage.app",
  messagingSenderId: "383160041638",
  appId: "1:383160041638:web:f40a77f5c3076f00a87467",
  measurementId: "G-9HB5FNYGP4"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, initializeFirestore, persistentLocalCache } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, { localCache: persistentLocalCache() });

export { auth, db };
