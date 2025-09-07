// auth.js — Firebase + cache offline + preload + fullSync + auto-refresh + banner sync
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

import { bulkUpsert } from "./storage.js";  // 🔥 sync su IndexedDB

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
// Helpers
function monthRange(centerDate = new Date(), offsetMonths = 0){
  const d = new Date(centerDate.getFullYear(), centerDate.getMonth()+offsetMonths, 1);
  return {
    start: new Date(d.getFullYear(), d.getMonth(), 1),
    end:   new Date(d.getFullYear(), d.getMonth()+1, 1)
  };
}

// ───────────────────────────────────────────────
// Preload rapido Firestore (solo query)
let _preloadDone = false;

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
// UI Banner
function showBanner(message, success = true) {
  let banner = document.createElement("div");
  banner.textContent = message;
  banner.style.position = "fixed";
  banner.style.bottom = "20px";
  banner.style.left = "50%";
  banner.style.transform = "translateX(-50%)";
  banner.style.background = "#d2b8a3"; // beige primario
  banner.style.color = "#fff";
  banner.style.padding = "10px 20px";
  banner.style.borderRadius = "10px";
  banner.style.fontWeight = "600";
  banner.style.fontSize = "15px";
  banner.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
  banner.style.opacity = "0";
  banner.style.transition = "opacity .3s ease, transform .3s ease";
  banner.style.zIndex = "9999";

  document.body.appendChild(banner);

  // fade-in
  requestAnimationFrame(() => {
    banner.style.opacity = "1";
    banner.style.transform = "translateX(-50%) translateY(0)";
  });

  // fade-out dopo 3s
  setTimeout(() => {
    banner.style.opacity = "0";
    banner.style.transform = "translateX(-50%) translateY(20px)";
    banner.addEventListener("transitionend", () => banner.remove());
  }, 3000);
}

// ───────────────────────────────────────────────
// Full Sync → salva in IndexedDB
async function fullSyncAll() {
  try {
    // Clienti → tutti
    const snapClienti = await getDocs(collection(db, "clienti"));
    await bulkUpsert("clienti", snapClienti.docs.map(d => ({ id: d.id, ...d.data() })));

    // Trattamenti → tutti
    const snapTratt = await getDocs(collection(db, "trattamenti"));
    await bulkUpsert("trattamenti", snapTratt.docs.map(d => ({ id: d.id, ...d.data() })));

    // Promemoria → tutti
    const snapProm = await getDocs(collection(db, "promemoria"));
    await bulkUpsert("promemoria", snapProm.docs.map(d => ({ id: d.id, ...d.data() })));

    // Appuntamenti → da -6 a +6 mesi
    const tasks = [];
    for (let off = -6; off <= 6; off++) {
      const { start, end } = monthRange(new Date(), off);
      const qy = query(
        collection(db, "appuntamenti"),
        where("data", ">=", Timestamp.fromDate(start)),
        where("data", "<",  Timestamp.fromDate(end)),
        orderBy("data", "asc")
      );
      tasks.push(
        getDocs(qy).then(snap => {
          const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          return bulkUpsert("appuntamenti", docs);
        }).catch(() => {})
      );
    }
    await Promise.all(tasks);

    console.log("[fullSyncAll] Dati sincronizzati in IndexedDB");
    showBanner("Dati sincronizzati ✅", true);
  } catch (err) {
    console.error("[fullSyncAll] errore sync:", err);
    showBanner("Sincronizzazione fallita 🚫", false);
  }
}

// ───────────────────────────────────────────────
// Auto-refresh service worker cache
function setupAutoRefresh() {
  if (!navigator.serviceWorker?.controller) return;

  // Subito al login
  navigator.serviceWorker.controller.postMessage({ type: "PRECACHE_PAGES" });

  // Ogni 3h
  setInterval(() => {
    console.log("[auth] Auto refresh cache");
    navigator.serviceWorker.controller.postMessage({ type: "PRECACHE_PAGES" });
  }, 3 * 60 * 60 * 1000);
}

// ───────────────────────────────────────────────
// Protezione route + preload + fullSync
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

  // Loggato → preload + full sync + auto-refresh
  preloadReady = preloadDataOnce().catch(console.warn);
  fullSyncAll();  // 🔥 salva tutto in IndexedDB
  setupAutoRefresh();
});