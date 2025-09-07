  // auth.js — Firebase + offline cache + sync_queue + daily sync
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  initializeFirestore,
  persistentLocalCache,
  collection, getDocs, addDoc, setDoc, updateDoc, deleteDoc, doc,
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
  bulkUpsert, getAll, putOne, getLastSync, setLastSync,
  getQueuedChanges, clearQueue
} from "./storage.js";
import { showOffline, showOnline, showSyncOK, showSyncFail } from "./ui.js";

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
    showSyncOK();
  } catch (err) {
    console.error("[fullSyncAll] errore sync:", err);
    showSyncFail();
  }
}

// ───────────────────────────────────────────────
// Auto-refresh giornaliero
async function maybeDailySync() {
  const last = await getLastSync("all");
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  if (now - last > oneDay) {
    fullSyncAll();
  }
}

// ───────────────────────────────────────────────
// Sync pending (gestisce add / update / delete)
async function syncPending() {
  try {
    const queue = await getQueuedChanges();
    if (!queue.length) return;

    for (const q of queue) {
      try {
        const collRef = collection(db, q.collezione);

        if (q.op === "add") {
          const ref = await addDoc(collRef, q.payload);
          await putOne(q.collezione, { ...q.payload, id: ref.id });
        }

        if (q.op === "update") {
          if (!q.payload.id) throw new Error("update senza id");
          await updateDoc(doc(db, q.collezione, q.payload.id), q.payload);
          await putOne(q.collezione, q.payload);
        }

        if (q.op === "delete") {
          if (!q.payload.id) throw new Error("delete senza id");
          await deleteDoc(doc(db, q.collezione, q.payload.id));
          // Rimuoverlo dalla cache → lo gestirai in storage.js (es. con deleteOne)
        }
      } catch (e) {
        console.error("Errore sync queue item:", e, q);
      }
    }

    await clearQueue(queue.map(q => q.qid));
    showSyncOK();
  } catch (err) {
    console.error("[syncPending] errore:", err);
    showSyncFail();
  }
}

// ───────────────────────────────────────────────
// Stato connessione
window.addEventListener("online", () => {
  showOnline();
  syncPending();
});
window.addEventListener("offline", () => showOffline());

// Mostra stato iniziale
if (!navigator.onLine) {
  showOffline();
}

// ───────────────────────────────────────────────
// Protezione route + sync
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

  // Loggato
  maybeDailySync();  
  syncPending();
});