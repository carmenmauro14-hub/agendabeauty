// =============== reminder-settings.js ===============
import {
  loadTemplate,
  saveTemplate,
  DEFAULT_TEMPLATE,
  renderPreview,
} from "./reminder-store.js";

(function () {
  // --- DOM refs ---
  const textarea = document.getElementById("reminder-template");
  const btnSave  = document.getElementById("btnSalvaTemplate");
  const btnPrev  = document.getElementById("btnAnteprima");

  if (!textarea) return; // pagina non presente

  // --- Init: carica template dallo store ---
  textarea.value = loadTemplate() || DEFAULT_TEMPLATE;

  // --- Helper: inserisci testo alla posizione del cursore ---
  function insertAtCursor(el, text) {
    el.focus();
    const start  = el.selectionStart ?? el.value.length;
    const end    = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start);
    const after  = el.value.slice(end);
    el.value = before + text + after;

    const caret = start + text.length;
    // riposiziona il cursore
    try { el.setSelectionRange(caret, caret); } catch {}
    // notifica eventuali listener
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // --- Click sui token {NOME}/{DATA}/{ORA}/{TRATTAMENTI} ---
  document.querySelectorAll(".token").forEach(tok => {
    tok.addEventListener("click", () => {
      const value = tok.getAttribute("data-insert") || tok.textContent.trim();
      insertAtCursor(textarea, value);
    });
  });

  // --- Salva esplicito ---
  btnSave?.addEventListener("click", () => {
    const ok = saveTemplate(textarea.value || "");
    // feedback semplice
    if (ok) {
      btnSave.disabled = true;
      setTimeout(() => (btnSave.disabled = false), 350);
      alert("Template salvato.");
    } else {
      alert("Errore: impossibile salvare il template.");
    }
  });

  // --- Anteprima “mock” con valori di esempio ---
  btnPrev?.addEventListener("click", () => {
    const preview = renderPreview(textarea.value || DEFAULT_TEMPLATE, {
      NOME: "Giulia",
      DATA: "12/09/2025",
      ORA: "15:00",
      TRATTAMENTI: "Laminazione ciglia",
    });
    alert("Anteprima:\n\n" + preview);
  });
})();