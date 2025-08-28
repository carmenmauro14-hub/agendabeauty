// === Reminder Settings Page Logic (con Firestore) ===
import { loadReminderTemplate, saveReminderTemplate } from "./reminder-store.js";

(function () {
  const textarea = document.getElementById('reminder-template');
  const btnSave  = document.getElementById('btnSalvaTemplate');
  const btnPrev  = document.getElementById('btnAnteprima');

  // --- Caricamento iniziale dal backend (con fallback interno allo store) ---
  (async () => {
    try {
      const tpl = await loadReminderTemplate();
      if (!textarea.value && tpl) textarea.value = tpl;
      setPristine();
    } catch {
      // Se qualcosa va storto nello store, lasciamo il campo com'è
      setPristine();
    }
  })();

  // --- Util: inserisce testo alla posizione del cursore ---
  function insertAtCursor(el, text) {
    el.focus();
    const start  = el.selectionStart ?? el.value.length;
    const end    = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start);
    const after  = el.value.slice(end);
    el.value = before + text + after;
    const caret = start + text.length;
    el.setSelectionRange(caret, caret);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // --- Token cliccabili → inserimento placeholder ---
  document.querySelectorAll('.token').forEach(tok => {
    tok.addEventListener('click', () => {
      const value = tok.getAttribute('data-insert') || tok.textContent.trim();
      insertAtCursor(textarea, value);
    });
  });

  // --- Stato "modificato/non modificato" per il tasto Salva ---
  let pristineValue = '';
  function setPristine() {
    pristineValue = textarea.value || '';
    updateSaveButton();
  }
  function updateSaveButton() {
    const dirty = (textarea.value || '') !== pristineValue;
    if (btnSave) btnSave.disabled = !dirty;
  }
  textarea?.addEventListener('input', updateSaveButton);

  // --- SALVA (Firestore + cache locale gestita dallo store) ---
  btnSave?.addEventListener('click', async () => {
    btnSave.disabled = true;
    try {
      await saveReminderTemplate(textarea.value || '');
      setPristine();
      alert('Template salvato.');
    } catch (e) {
      // In caso di errore Firestore, lo store ha già tentato il fallback locale
      alert('Salvataggio non riuscito. Riprova più tardi.');
      updateSaveButton();
    }
  });

  // --- ANTEPRIMA (mock) ---
  btnPrev?.addEventListener('click', () => {
    const demo = (textarea.value || '')
      .replaceAll('{NOME}', 'Giulia')
      .replaceAll('{DATA}', '12/09/2025')
      .replaceAll('{ORA}', '15:00')
      .replaceAll('{TRATTAMENTI}', 'Laminazione ciglia');
    alert('Anteprima:\n\n' + demo);
  });
})();