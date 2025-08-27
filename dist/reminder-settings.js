// === Reminder Settings Page Logic ===
(function () {
  const KEY = 'bb-reminder-template';

  const textarea = document.getElementById('reminder-template');
  const btnSave  = document.getElementById('btnSalvaTemplate');
  const btnPrev  = document.getElementById('btnAnteprima');

  // Carica eventuale testo salvato
  try {
    const saved = localStorage.getItem(KEY);
    if (!textarea.value && saved) textarea.value = saved;
  } catch (_) {}

  // Inserisce testo alla posizione del cursore
  function insertAtCursor(el, text) {
    el.focus();
    const start = el.selectionStart ?? el.value.length;
    const end   = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start);
    const after  = el.value.slice(end);
    el.value = before + text + after;
    const caret = start + text.length;
    el.setSelectionRange(caret, caret);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Click sui token → inserimento placeholder
  document.querySelectorAll('.token').forEach(tok => {
    tok.addEventListener('click', () => {
      const value = tok.getAttribute('data-insert') || tok.textContent.trim();
      insertAtCursor(textarea, value);
    });
  });

  // Salva localmente
  btnSave?.addEventListener('click', () => {
    try {
      localStorage.setItem(KEY, textarea.value || '');
      btnSave.disabled = true;
      setTimeout(() => (btnSave.disabled = false), 350);
      alert('Template salvato.');
    } catch (e) {
      alert('Impossibile salvare il template.');
    }
  });

  // Anteprima semplice (mock)
  btnPrev?.addEventListener('click', () => {
    const demo = (textarea.value || '')
      .replaceAll('{NOME}', 'Giulia')
      .replaceAll('{DATA}', '12/09/2025')
      .replaceAll('{ORA}', '15:00')
      .replaceAll('{TRATTAMENTI}', 'Laminazione ciglia');
    alert('Anteprima:\n\n' + demo);
  });
})();