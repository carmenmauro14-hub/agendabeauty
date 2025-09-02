// auth.js
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// === Firebase config (corretta) ===
const firebaseConfig = {
  apiKey: "AIzaSyD0tDQQepdvj_oZPcQuUrEKpoNOd4zF0nE",
  authDomain: "agenda-carmenmauro.firebaseapp.com",
  projectId: "agenda-carmenmauro",
  storageBucket: "agenda-carmenmauro.appspot.com", // <-- FIX qui
  messagingSenderId: "959324976221",
  appId: "1:959324976221:web:780c8e9195965cea0749b4"
};

// Init app una sola volta
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// --- EXPORT funzioni di autenticazione (come prima) ---
export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged
};

// === AUTH GUARD globale ===
// Pagine pubbliche (senza login obbligatorio)
const PUBLIC_PAGES = new Set(["/login.html"]);

// Nascondi il contenuto finché non sappiamo lo stato (evita flicker)
// Se vuoi evitare di nascondere su login.html, teniamolo comunque: su login si vedrà appena arriva l'evento
const htmlEl = document.documentElement;
if (htmlEl) htmlEl.style.visibility = "hidden";

onAuthStateChanged(auth, (user) => {
  const path = location.pathname;
  const isPublic = PUBLIC_PAGES.has(path) || path === "/" || path.endsWith("/index.html");

  if (!user && !isPublic) {
    // Non loggato su pagina protetta -> vai a login
    location.href = "login.html";
    return;
  }

  if (user && PUBLIC_PAGES.has(path)) {
    // Già loggato ma su login -> porta alla home (scegli tu la landing interna)
    location.href = "calendario.html";
    return;
  }

  // Mostra la pagina quando è tutto deciso
  if (htmlEl) htmlEl.style.visibility = "";
});