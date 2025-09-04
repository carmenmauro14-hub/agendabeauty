// auth.js — Firebase + cache offline + SW + preload dati (centralizzato)

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

// ─────────────────────────────────────────────────────────────────────────────
// Config Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD0tDQQepdvj_oZPcQuUrEKpoNOd4zF0nE",
  authDomain: "agenda-carmenmauro.firebaseapp.com",
  projectId: "agenda-carmenmauro",
  storageBucket: "agenda-carmenmauro.appspot.com",
  messagingSenderId: "959324976221",
  appId: "1:959324976221:web:780c8e9195965cea0749b4"
};

// App + Firestore con cache persistente
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db  = initializeFirestore(app, { localCache: persistentLocalCache() });
export const auth = getAuth(app);

// Esport utili
export {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
};

// ─────────────────────────────────────────────────────────────────────────────
// Riconosci pagina corrente (per evitare redirect su pagine "libere")
let FILE = location.pathname.split("/").pop()?.toLowerCase() || "index.html";
if (!FILE.endsWith(".html")) FILE += ".html";
const PAGINE_LIBERE = new Set(["login.html", "signup.html", "forgot.html"]);

// ─────────────────────────────────────────────────────────────────────────────
// Service Worker: registra 1 volta ovunque (anche su login va bene)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(console.error);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PRELOAD DATI: centralizzato qui, scatta solo quando l’utente è loggato
let _preloadDone = false;

function monthRange(centerDate = new Date(), offsetMonths = 0){
  const d = new Date(centerDate.getFullYear(), centerDate.getMonth()+offsetMonths, 1);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end   = new Date(d.getFullYear(), d.getMonth()+1, 1);
  return { start, end };
}

async function warmClients(){
  try { await getDocs(collection(db, "clienti")); } catch {}
}
async function warmTreatments(){
  try { await getDocs(collection(db, "trattamenti")); } catch {}
}
async function warmAppointmentsAroundNow(){
  const tasks = [];
  for (const off of [-1, 0, 1]) { // cambia a [-2, -1, 0, 1, 2] se vuoi precaricare ±2 mesi
    const { start, end } = monthRange(new Date(), off);
    const qy = query(
      collection(db, "appuntamenti"),
      where("data", ">=", Timestamp.fromDate(start)),
      where("data", "<",  Timestamp.fromDate(end)),
      orderBy("data", "asc")
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
    warmAppointmentsAroundNow()
  ]);
}

// Espongo una Promise se vuoi attendere altrove (opzionale)
export let preloadReady = Promise.resolve();

// ─────────────────────────────────────────────────────────────────────────────
// Protezione route + trigger preload
onAuthStateChanged(auth, user => {
  const isFree = PAGINE_LIBERE.has(FILE);

  if (!user) {
    // Non loggato → se non sei su pagina libera, vai a login
    if (!isFree) location.href = "login.html";
    // Non avviare preload senza utente (evita errori di permessi)
    return;
  }

  // Loggato → se sei su pagina libera, manda a home
  if (isFree) {
    location.href = "calendario.html"; // o dove preferisci
    return;
  }

  // Loggato su pagina dell’app: avvia preload centralizzato
  preloadReady = preloadDataOnce().catch(console.warn);
});