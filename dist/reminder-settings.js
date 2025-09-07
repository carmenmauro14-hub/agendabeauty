// reminder-settings.js — offline-first con pending sync
import { db } from "./auth.js";
import { doc, getDoc, setDoc } 
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { putOne, getById } from "./storage.js";

// ===== DOM =====
const textarea = document.getElementById("reminder-template");
const btnSave  = document.getElementById("btnSalvaTemplate");
const btnPrev  = document.getElementById("btnAnteprima");

// ===== Costanti =====
const SETTINGS_DOC_ID  = "reminder";
const SETTINGS_DOC_REF = doc(db, "settings", SETTINGS_DOC_ID);
const DEFAULT_TEMPLATE =
  "Ciao {NOME}! Ti ricordiamo l’appuntamento del {DATA} alle {ORA}. {TRATTAMENTI}. A presto!";

// ===== Utils =====
function insertAtCursor(el, text) {
  el.focus();
  const start  = el.selectionStart ?? el.value.length;
  const end    = el.selectionEnd ?? el.value.length;
  const before = el.value.slice(0, start);
  const after  = el.value.slice(end);
  el.value = before + text + after;
  const caret = start + text.length;
  el.setSelectionRange(caret, caret);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

// ===== Caricamento =====
async function loadTemplate() {
  try {
    const snap = await getDoc(SETTINGS_DOC_REF);
    if (snap.exists()) {
      const t = (snap.data()?.template ?? "").toString();
      textarea.value = t || DEFAULT_TEMPLATE;
      await putOne("settings", { id: SETTINGS_DOC_ID, template: textarea.value });
    } else {
      textarea.value = DEFAULT_TEMPLATE;
    }
  } catch (err) {
    console.warn("[reminder-settings] offline, uso cache", err);
    const cached = await getById("settings", SETTINGS_DOC_ID);
    textarea.value = cached?.template || DEFAULT_TEMPLATE;
  }
}

// ===== Salvataggio =====
async function saveTemplate() {
  const value = (textarea.value || "").toString();
  if (!value) return;

  try {
    if (navigator.onLine) {
      await setDoc(SETTINGS_DOC_REF, { template: value }, { merge: true });
      await putOne("settings", { id: SETTINGS_DOC_ID, template: value });
      alert("Template salvato.");
    } else {
      // Offline → salva in cache con __pending
      await putOne("settings", { id: SETTINGS_DOC_ID, template: value, __pending: true, __action: "update" });
      alert("Template salvato offline (sarà sincronizzato)");
    }
  } catch (err) {
    console.error("[reminder-settings] errore salvataggio:", err);
    alert("Impossibile salvare il template.");
  }
}

// ===== Anteprima =====
function showPreview() {
  const demo = (textarea.value || "")
    .replaceAll("{NOME}", "Giulia")
    .replaceAll("{DATA}", "12/09/2025")
    .replaceAll("{ORA}", "15:00")
    .replaceAll("{TRATTAMENTI}", "Laminazione ciglia");
  alert("Anteprima:\n\n" + demo);
}

// ===== Event listeners =====
document.querySelectorAll(".token").forEach(tok => {
  tok.addEventListener("click", () => {
    const value = tok.getAttribute("data-insert") || tok.textContent.trim();
    insertAtCursor(textarea, value);
  });
});
btnSave?.addEventListener("click", saveTemplate);
btnPrev?.addEventListener("click", showPreview);

// ===== Avvio =====
await loadTemplate();