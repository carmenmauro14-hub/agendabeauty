// reminder-settings.js
// Pagina "Impostazioni Promemoria" senza store separato.
// Salva/legge il template da Firestore (permanente) e da localStorage (cache),
// seguendo lo stesso stile del resto dell'app (init in auth.js).

import { getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ---- Costanti ----
const LOCAL_KEY = "bb-reminder-template";
const DEFAULT_TEMPLATE = "Ciao {NOME}! Ti ricordiamo l’appuntamento del {DATA} alle {ORA}. A presto!";

// ---- Helper Firebase (allineato al resto dell’app: init in auth.js) ----
function getDbOrNull() {
  if (!getApps().length) return null;
  try { return getFirestore(getApp()); } catch { return null; }
}
function getAuthOrNull() {
  if (!getApps().length) return null;
  try { return getAuth(getApp()); } catch { return null; }
}
function getDocRef(db, uid) {
  // Se c'è un utente loggato: users/{uid}/settings/reminder
  // Altrimenti: settings/reminder (globale)
  return uid
    ? doc(db, "users", uid, "settings", "reminder")
    : doc(db, "settings", "reminder");
}

// ---- Cache locale ----
function loadFromLocal() {
  try { const v = localStorage.getItem(LOCAL_KEY); return v && v.trim() ? v : null; } catch { return null; }
}
function saveToLocal(text) {
  try { localStorage.setItem(LOCAL_KEY, String(text || "")); } catch {}
}

// ---- DOM refs ----
const textarea = document.getElementById("reminder-template");
const btnSave  = document.getElementById("btnSalvaTemplate");
const btnPrev  = document.getElementById("btnAnteprima");

// ---- Caricamento iniziale (mostra subito qualcosa) ----
(function primeFromLocal() {
  if (!textarea) return;
  const loc = loadFromLocal();
  textarea.value = loc ?? DEFAULT_TEMPLATE;
})();

// ---- Carica da Firestore (override del locale se esiste su cloud) ----
async function loadFromFirestoreAndFill(uid) {
  const db = getDbOrNull();
  if (!db || !textarea) return;

  try {
    const ref = getDocRef(db, uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      const tpl = (typeof data?.template === "string" && data.template.trim())
        ? data.template
        : null;
      if (tpl != null) {
        textarea.value = tpl;
        saveToLocal(tpl); // allinea cache
      }
    }
  } catch (e) {
    console.warn("[reminder-settings] loadFromFirestore errore:", e);
  }
}

// ---- Salva su Firestore + cache ----
async function saveToFirestore(text, uid) {
  const db = getDbOrNull();
  if (!db) return false;

  try {
    const ref = getDocRef(db, uid);
    await setDoc(ref, {
      template: String(text || ""),
      updatedAt: serverTimestamp(),
      source: "manual"
    }, { merge: true });
    return true;
  } catch (e) {
    console.warn("[reminder-settings] saveToFirestore errore:", e);
    return false;
  }
}

// ---- Auth: ricarica dal cloud quando lo stato cambia ----
(function watchAuthAndLoad() {
  const auth = getAuthOrNull();
  if (!auth) {
    // anche senza auth, proviamo il documento globale
    loadFromFirestoreAndFill(null);
    return;
  }
  onAuthStateChanged(auth, (user) => {
    const uid = user?.uid ?? null;
    loadFromFirestoreAndFill(uid);
  });
})();

// ---- Token: inserimento al cursore ----
function insertAtCursor(el, text) {
  if (!el) return;
  el.focus();
  const start = el.selectionStart ?? el.value.length;
  const end   = el.selectionEnd ?? el.value.length;
  const before = el.value.slice(0, start);
  const after  = el.value.slice(end);
  el.value = before + text + after;
  const caret = start + text.length;
  el.setSelectionRange(caret, caret);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
document.querySelectorAll(".token").forEach(tok => {
  tok.addEventListener("click", () => {
    const value = tok.getAttribute("data-insert") || tok.textContent.trim();
    insertAtCursor(textarea, value);
  });
});

// ---- Salva (cloud + cache) ----
btnSave?.addEventListener("click", async () => {
  if (!textarea) return;
  const auth = getAuthOrNull();
  const uid = auth?.currentUser?.uid ?? null;
  const text = textarea.value || "";

  btnSave.disabled = true;
  try {
    // salva cache locale subito
    saveToLocal(text);

    // salva su Firestore
    const ok = await saveToFirestore(text, uid);
    if (!ok) {
      // anche se il cloud fallisce, il locale resta aggiornato
      alert("Salvato in locale. Il salvataggio sul cloud non è riuscito al momento.");
    } else {
      alert("Template salvato.");
    }
  } catch (e) {
    console.error(e);
    alert("Impossibile salvare il template.");
  } finally {
    setTimeout(() => (btnSave.disabled = false), 320);
  }
});

// ---- Anteprima (mock) ----
btnPrev?.addEventListener("click", () => {
  if (!textarea) return;
  const demo = (textarea.value || "")
    .replaceAll("{NOME}", "Giulia")
    .replaceAll("{DATA}", "12/09/2025")
    .replaceAll("{ORA}", "15:00")
    .replaceAll("{TRATTAMENTI}", "Laminazione ciglia");
  alert("Anteprima:\n\n" + demo);
});