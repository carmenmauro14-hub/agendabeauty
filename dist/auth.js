// auth.js v4 — anti-loop + failsafe + log
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

console.log("[AUTH] v4 loading…");

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

export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged
};

// --- Guard ---
const HTML = document.documentElement;
// nascondo per evitare flicker, ma metto due failsafe di sicurezza
if (HTML) HTML.style.visibility = "hidden";

// nome file corrente (funziona anche in sottocartelle)
const FILE = (location.pathname.split("/").pop() || "index.html").toLowerCase();
const AUTH_PAGES = new Set(["login.html", "signup.html", "forgot.html"]);
const HOME_PAGE  = "index.html";

// failsafe 1: comunque mostra la pagina dopo 2.5s
const fs1 = setTimeout(() => {
  console.warn("[AUTH] failsafe #1: sblocco visibilità");
  if (HTML) HTML.style.visibility = "";
}, 2500);

// previeni doppi redirect
let redirected = false;
const go = (url, why) => {
  if (!redirected) {
    redirected = true;
    console.log("[AUTH] redirect →", url, "| motivo:", why, "| page:", FILE);
    location.replace(url);
  }
};

onAuthStateChanged(auth, (user) => {
  clearTimeout(fs1);

  const logged = !!user;
  console.log("[AUTH] onAuthStateChanged", { page: FILE, logged });

  if (!logged) {
    // non loggato → solo pagine di auth sono consentite
    if (!AUTH_PAGES.has(FILE)) return go("login.html", "non loggato su pagina protetta");
    if (HTML) HTML.style.visibility = "";
    return;
  }

  // loggato → se sei su una pagina di auth, vai in home
  if (AUTH_PAGES.has(FILE)) return go(HOME_PAGE, "loggato su pagina di auth");

  // loggato su pagina protetta → ok
  if (HTML) HTML.style.visibility = "";
});

// failsafe 2: se per qualunque motivo onAuthStateChanged non parte,
// sblocco comunque dopo 4s
setTimeout(() => {
  if (getAuth().currentUser || AUTH_PAGES.has(FILE)) {
    console.warn("[AUTH] failsafe #2: sblocco visibilità tardivo");
    if (HTML) HTML.style.visibility = "";
  }
}, 4000);