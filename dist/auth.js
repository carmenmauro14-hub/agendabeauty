// auth.js — gestione login, sync e offline-first
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  initializeFirestore,
  persistentLocalCache,
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc,
  query, where, orderBy, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  initStorage,
  bulkUpsert, getAll, putOne, getLastSync, setLastSync,
  getQueuedChanges, clearQueue
} from "./storage.js";

import { showOffline, showOnline, showSyncOK, showSyncFail } from "./ui.js";

// Inizializza IndexedDB SUBITO
await initStorage();

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

// Init Firebase
export const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db   = initializeFirestore(app, { localCache: persistentLocalCache() });
export const auth = getAuth(app);

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
// Full Sync (cloud → cache)
async function fullSyncAll() {
  try {
    console.log("[sync] Avvio fullSyncAll...");

    // Clienti
    const snapClienti = await getDocs(collection(db, "clienti"));
    await bulkUpsert("clienti", snapClienti.docs.map(d => ({ id: d.id, ...d.data() })));

    // Trattamenti
    const snapTratt = await getDocs(collection(db, "trattamenti"));
    await bulkUpsert("trattamenti", snapTratt.docs.map(d => ({ id: d.id, ...d.data() })));

    // Settings
    const snapSettings = await getDocs(collection(db, "settings"));
    await bulkUpsert("settings", snapSettings.docs.map(d => ({ id: d.id, ...d.data() })));

    // Appuntamenti (da -6 a +6 mesi)
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

    await setLastSync("all", Date.now());
    console.log("[sync] Full sync completato ✅");
    showSyncOK();
  } catch (err) {
    console.error("[sync] Errore durante fullSyncAll:", err);
    showSyncFail();
  }
}

// ───────────────────────────────────────────────
// Sync pending (gestisce add / update / delete)
async function syncPending() {
  try {
    const queue = await getQueuedChanges();
    if (!queue.length) return;

    console.group("[syncPending] Avvio sync");
    console.table(queue);

    for (const q of queue) {
      try {
        if (q.op === "add") {
          const ref = await addDoc(collection(db, q.collezione), q.payload);
          await putOne(q.collezione, { ...q.payload, id: ref.id });
        }
        if (q.op === "update" && q.payload.id) {
          await updateDoc(doc(db, q.collezione, q.payload.id), q.payload);
          await putOne(q.collezione, q.payload);
        }
        if (q.op === "delete" && q.payload.id) {
          await deleteDoc(doc(db, q.collezione, q.payload.id));
        }
      } catch (e) {
        console.error("[syncPending] Errore su item:", q, e);
      }
    }

    await clearQueue(queue.map(q => q.qid));
    console.groupEnd();
    showSyncOK();
  } catch (err) {
    console.error("[syncPending] errore globale:", err);
    showSyncFail();
  }
}

// ───────────────────────────────────────────────
// Stato connessione
window.addEventListener("online", () => {
  showOnline();
  fullSyncAll().then(syncPending);
});
window.addEventListener("offline", () => showOffline());

// Mostra stato iniziale
if (!navigator.onLine) showOffline();

// ───────────────────────────────────────────────
// Protezione route + sync
onAuthStateChanged(auth, async (user) => {
  const isFree = PAGINE_LIBERE.has(FILE);

  if (!user) {
    if (!isFree) location.href = "login.html";
    return;
  }

  if (isFree) {
    location.href = "calendario.html";
    return;
  }

  // 🔹 Utente loggato
  if (navigator.onLine) {
    await fullSyncAll();
    await syncPending();
  } else {
    console.warn("[auth] Avvio offline: uso dati IndexedDB già presenti");
  }
});