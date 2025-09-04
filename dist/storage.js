// Il contenuto originale // storage.js — IndexedDB wrapper per offline-first
// ES Module

const DB_NAME = "beautybook";
const DB_VERSION = 2; // aumenta se modifichi lo schema

const STORES = {
  appuntamenti: { keyPath: "id", indexes: [
    ["dataISO", "dataISO", { unique: false }],
    ["dateTime", "dateTime", { unique: false }],
    ["clienteId", "clienteId", { unique: false }],
  ]},
  clienti: { keyPath: "id", indexes: [
    ["nomeLower", "nomeLower", { unique: false }],
    ["phone", "telefono", { unique: false }],
  ]},
  trattamenti: { keyPath: "id", indexes: [
    ["nomeLower", "nomeLower", { unique: false }],
  ]},
  promemoria: { keyPath: "id", indexes: [
    ["clienteId", "clienteId", { unique: false }],
    ["scheduledAt", "scheduledAt", { unique: false }],
  ]},
  statistiche_cache: { keyPath: "id", indexes: [
    ["cacheKey", "cacheKey", { unique: true }],
    ["createdAt", "createdAt", { unique: false }],
  ]},
  utenti: { keyPath: "id", indexes: [
    ["email", "email", { unique: true }],
    ["uid", "uid", { unique: true }],
  ]},
  // Coda cambi offline (CRUD in attesa di sync con Firestore)
  sync_queue: { keyPath: "qid", indexes: [
    ["collezione", "collezione", { unique: false }],
    ["op", "op", { unique: false }], // "add" | "update" | "delete"
    ["ts", "ts", { unique: false }],
  ]},
  // Metadati vari (lastSync per store, flags, versioni…)
  meta: { keyPath: "key", indexes: [] },
};

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = req.result;

      // Crea store e indici se mancano (idempotente)
      Object.entries(STORES).forEach(([name, cfg]) => {
        const exists = db.objectStoreNames.contains(name);
        const store = exists
          ? req.transaction.objectStore(name)
          : db.createObjectStore(name, { keyPath: cfg.keyPath });

        // Crea indici se non esistono
        (cfg.indexes || []).forEach(([idxName, path, opts]) => {
          if (!exists || !store.indexNames.contains(idxName)) {
            try { store.createIndex(idxName, path, opts || { unique: false }); }
            catch(_) {}
          }
        });
      });
    };

    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

async function withStore(storeName, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = fn(store);
    tx.oncomplete = () => resolve(request?.result ?? true);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
  });
}

/* -------------------- API base -------------------- */

export async function getAll(storeName, { index, query } = {}) {
  return withStore(storeName, "readonly", (store) => {
    if (index) {
      const idx = store.index(index);
      return idx.getAll(query ?? null);
    }
    return store.getAll();
  });
}

export async function getById(storeName, id) {
  return withStore(storeName, "readonly", (store) => store.get(id));
}

export async function putOne(storeName, obj) {
  // normalizza campi derivati utili agli indici
  if (storeName === "clienti") {
    if (obj.nome) obj.nomeLower = String(obj.nome).toLowerCase();
  }
  if (storeName === "trattamenti") {
    if (obj.nome) obj.nomeLower = String(obj.nome).toLowerCase();
  }
  return withStore(storeName, "readwrite", (store) => store.put(obj));
}

export async function putMany(storeName, arr) {
  return withStore(storeName, "readwrite", (store) => {
    arr.forEach((obj) => {
      if (storeName === "clienti" && obj?.nome) obj.nomeLower = String(obj.nome).toLowerCase();
      if (storeName === "trattamenti" && obj?.nome) obj.nomeLower = String(obj.nome).toLowerCase();
      store.put(obj);
    });
  });
}

export async function deleteById(storeName, id) {
  return withStore(storeName, "readwrite", (store) => store.delete(id));
}

/* -------------------- Sync helpers -------------------- */

// Upsert da snapshot Firestore (array di {id, ...data})
export async function bulkUpsert(storeName, docs) {
  if (!Array.isArray(docs) || docs.length === 0) return;
  await putMany(storeName, docs);
  await setLastSync(storeName, Date.now());
}

// Memorizza/legge l’ultimo sync per store
export async function setLastSync(storeName, tsMs) {
  return withStore("meta", "readwrite", (store) => {
    store.put({ key: `lastSync:${storeName}`, value: tsMs });
  });
}

export async function getLastSync(storeName) {
  const rec = await withStore("meta", "readonly", (store) => store.get(`lastSync:${storeName}`));
  return rec?.value || 0;
}

/* -------------------- Coda cambi offline -------------------- */

export async function queueChange({ collezione, op, id, payload }) {
  const qid = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const ts = Date.now();
  return withStore("sync_queue", "readwrite", (store) => {
    store.put({ qid, collezione, op, id, payload: payload ?? null, ts });
  });
}

export async function getQueuedChanges({ collezione } = {}) {
  const all = await getAll("sync_queue");
  return collezione ? all.filter((x) => x.collezione === collezione) : all;
}

export async function clearQueue(qids) {
  if (!qids?.length) return;
  return withStore("sync_queue", "readwrite", (store) => {
    qids.forEach((qid) => store.delete(qid));
  });
}

/* -------------------- Utility vari -------------------- */

// wipe completo (attenzione!)
export async function nukeAll() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// Avvio “soft” per forzare creazione DB/indici
export async function initStorage() {
  await openDB();
  return true;