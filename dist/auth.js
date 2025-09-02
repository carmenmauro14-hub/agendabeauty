// auth.js — versione anti-loop con index protetta
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ---- Firebase (una sola istanza) ----
const firebaseConfig = {
  apiKey: "AIzaSyD0tDQQepdvj_oZPcQuUrEKpoNOd4zF0nE",
  authDomain: "agenda-carmenmauro.firebaseapp.com",
  projectId: "agenda-carmenmauro",
  storageBucket: "agenda-carmenmauro.appspot.com",
  messagingSenderId: "959324976221",
  appId: "1:959324976221:web:780c8e9195965cea0749b4"
};

export const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Re-export funzioni utili
export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged
};

// ---- Guard globale ----
const HTML = document.documentElement;
if (HTML) HTML.style.visibility = "hidden";  // evita flicker all’avvio

const FILE = (location.pathname.split("/").pop() || "index.html").toLowerCase();

// Solo queste pagine sono pubbliche
const AUTH_PAGES = new Set(["login.html", "signup.html", "forgot.html"]);
// Home di default per utenti loggati
const HOME_PAGE  = "index.html";

// failsafe: sblocca visibilità in ogni caso dopo 3s
const failsafe = setTimeout(() => { if (HTML) HTML.style.visibility = ""; }, 3000);

// evita doppi redirect
let redirected = false;
const go = (url) => { if (!redirected) { redirected = true; location.replace(url); } };

onAuthStateChanged(auth, (user) => {
  clearTimeout(failsafe);

  if (!user) {
    // NON loggato → consenti solo pagine di autenticazione
    if (!AUTH_PAGES.has(FILE)) return go("login.html");
    if (HTML) HTML.style.visibility = "";
    return;
  }

  // Loggato → se sei su login/forgot/signup, porta alla home
  if (AUTH_PAGES.has(FILE)) return go(HOME_PAGE);

  // Loggato su pagina protetta → mostra normalmente
  if (HTML) HTML.style.visibility = "";
});