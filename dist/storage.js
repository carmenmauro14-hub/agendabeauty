// storage.js — IndexedDB wrapper per offline-first
// ES Module

const DB_NAME = "beautybook";
const DB_VERSION = 3; // 🔼 incrementato per forzare upgrade schema

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
  settings: { keyPath: "id", indexes: [] }, // ⬅️ AGGIUNTO
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
  sync_queue: { keyPath: "qid", indexes: [
    ["collezione", "collezione", { unique: false }],
    ["op", "op", { unique: false }],
    ["ts", "ts", { unique: false }],
  ]},
  meta: { keyPath: "key", indexes: [] },
};

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      Object.entries(STORES).forEach(([name, cfg]) => {
        const exists = db.objectStoreNames.contains(name);
        const store = exists
          ? req.transaction.objectStore(name)
          : db.createObjectStore(name, { keyPath: cfg.keyPath });

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
    if (index) return store.index(index).getAll(query ?? null);
    return store.getAll();
  });
}

export async function getById(storeName, id) {
  return withStore(storeName, "readonly", (store) => store.get(id));
}

export async function putOne(storeName, obj) {
  if (storeName === "clienti" && obj.nome) obj.nomeLower = String(obj.nome).toLowerCase();
  if (storeName === "trattamenti" && obj.nome) obj.nomeLower = String(obj.nome).toLowerCase();
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
export async function bulkUpsert(storeName, docs) {
  if (!Array.isArray(docs) || docs.length === 0) return;
  await putMany(storeName, docs);
  await setLastSync(storeName, Date.now());
}

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
export async function nukeAll() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function initStorage() {
  await openDB();
  return true;
}