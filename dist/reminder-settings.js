// ===== Firebase =====
import { db } from "./auth.js";
import { doc, getDoc, setDoc }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

(async () => {
  // ===== DOM =====
const textarea = document.getElementById("reminder-template");
const btnSave  = document.getElementById("btnSalvaTemplate");
const btnPrev  = document.getElementById("btnAnteprima");

// ===== Costanti =====
const SETTINGS_DOC_REF = doc(db, "settings", "reminder");
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

async function loadTemplate() {
  try {
    const snap = await getDoc(SETTINGS_DOC_REF);
    if (snap.exists()) {
      const t = (snap.data()?.template ?? "").toString();
      textarea.value = t || DEFAULT_TEMPLATE;
    } else {
      textarea.value = DEFAULT_TEMPLATE;
    }
  } catch (err) {
    console.error("Errore caricamento template:", err);
    textarea.value = DEFAULT_TEMPLATE;
  }
}

async function saveTemplate() {
  try {
    const value = (textarea.value || "").toString();
    // salva/aggiorna solo il campo "template"
    await setDoc(SETTINGS_DOC_REF, { template: value }, { merge: true });
    btnSave.disabled = true;
    setTimeout(() => (btnSave.disabled = false), 350);
    alert("Template salvato.");
  } catch (err) {
    console.error("Errore salvataggio template:", err);
    alert("Impossibile salvare il template.");
  }
}

function showPreview() {
  const demo = (textarea.value || "")
    .replaceAll("{NOME}", "Giulia")
    .replaceAll("{DATA}", "12/09/2025")
    .replaceAll("{ORA}", "15:00")
    .replaceAll("{TRATTAMENTI}", "Laminazione ciglia");
  alert("Anteprima:\n\n" + demo);
}

// ===== Event listeners =====
// Token cliccabili
document.querySelectorAll(".token").forEach(tok => {
  tok.addEventListener("click", () => {
    const value = tok.getAttribute("data-insert") || tok.textContent.trim();
    insertAtCursor(textarea, value);
  });
});

// Salva
btnSave?.addEventListener("click", saveTemplate);

// Anteprima
btnPrev?.addEventListener("click", showPreview);

// ===== Avvio =====
await loadTemplate();