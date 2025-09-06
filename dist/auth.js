// auth.js — Firebase + cache offline + preload
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  initializeFirestore,
  persistentLocalCache,
  collection, getDocs, query, where, orderBy, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ───────────────────────────────────────────────
// Config Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD0tDQQepdvj_oZPcQuUrEKpoNOd4zF0nE",
  authDomain: "agenda-carmenmauro.firebaseapp.com",
  projectId: "agenda-carmenmauro",
  storageBucket: "agenda-carmenmauro.appspot.com",
  messagingSenderId: "959324976221",
  appId: "1:959324976221:web:780c8e9195965cea0749b4"
};

// Init
export const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db   = initializeFirestore(app, { localCache: persistentLocalCache() });
export const auth = getAuth(app);

// Export utili
export {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
};

// ───────────────────────────────────────────────
// Pagine libere
let FILE = location.pathname.split("/").pop()?.toLowerCase() || "index.html";
if (!FILE.endsWith(".html")) FILE += ".html";
const PAGINE_LIBERE = new Set(["login.html", "signup.html", "forgot.html"]);

// ───────────────────────────────────────────────
// Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(console.error);
  });
}

// ───────────────────────────────────────────────
// Preload Firestore
let _preloadDone = false;

function monthRange(centerDate = new Date(), offsetMonths = 0){
  const d = new Date(centerDate.getFullYear(), centerDate.getMonth()+offsetMonths, 1);
  return {
    start: new Date(d.getFullYear(), d.getMonth(), 1),
    end:   new Date(d.getFullYear(), d.getMonth()+1, 1)
  };
}

async function warmClients(){ try { await getDocs(collection(db, "clienti")); } catch {} }
async function warmTreatments(){ try { await getDocs(collection(db, "trattamenti")); } catch {} }
async function warmAppointments(){
  const tasks = [];
  for (const off of [-1, 0, 1]) {
    const { start, end } = monthRange(new Date(), off);
    const qy = query(
      collection(db, "appuntamenti"),
      where("data", ">=", Timestamp.fromDate(start)),
      where("data", "<",  Timestamp.fromDate(end)),
      orderBy("data","asc")
    );
    tasks.push(getDocs(qy).catch(()=>{}));
  }
  await Promise.all(tasks);
}

async function preloadDataOnce(){
  if (_preloadDone) return;
  _preloadDone = true;

  await Promise.all([
    warmClients(),
    warmTreatments(),
    warmAppointments()
  ]);

  // 👉 Notifica il service worker di precache HTML/CSS/JS
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "PRECACHE_PAGES" });
  }
}

export let preloadReady = Promise.resolve();

// ───────────────────────────────────────────────
// Protezione route + preload
onAuthStateChanged(auth, user => {
  const isFree = PAGINE_LIBERE.has(FILE);

  if (!user) {
    if (!isFree) location.href = "login.html";
    return;
  }

  if (isFree) {
    location.href = "calendario.html";
    return;
  }

  // Loggato → avvia preload
  preloadReady = preloadDataOnce().catch(console.warn);
});