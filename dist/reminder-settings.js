// reminder-settings.js
// Gestione template promemoria WhatsApp (salvataggio, anteprima, token cliccabili)

(function(){
  const KEY     = 'bb-reminder-template';
  const ta      = document.getElementById('reminder-template');
  const btnSave = document.getElementById('btnSalvaTemplate');
  const btnPrev = document.getElementById('btnAnteprima');

  // ===== Carica template salvato =====
  try {
    const saved = localStorage.getItem(KEY);
    if (!ta.value && saved) ta.value = saved;
  } catch(e){ console.warn("Errore lettura localStorage", e); }

  // ===== Salva =====
  btnSave?.addEventListener('click', () => {
    try {
      localStorage.setItem(KEY, ta.value || '');
      btnSave.classList.add('is-tapped');
      setTimeout(()=>btnSave.classList.remove('is-tapped'), 160);
      alert('Template salvato.');
    } catch(e){
      alert('Impossibile salvare il template.');
    }
  });

  // ===== Anteprima =====
  btnPrev?.addEventListener('click', () => {
    const demo = (ta.value || '')
      .replaceAll('{NOME}', 'Giulia')
      .replaceAll('{DATA}', '12/09/2025')
      .replaceAll('{ORA}', '15:00')
      .replaceAll('{TRATTAMENTI}', 'Laminazione ciglia');
    btnPrev.classList.add('is-tapped');
    setTimeout(()=>btnPrev.classList.remove('is-tapped'), 160);
    alert('Anteprima:\n\n' + demo);
  });

  // ===== Inserimento token cliccabili =====
  function insertAtCursor(el, text){
    const start = el.selectionStart ?? el.value.length;
    const end   = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start);
    const after  = el.value.slice(end);
    el.value = before + text + after;
    const pos = start + text.length;
    el.setSelectionRange?.(pos, pos);
    el.focus();
  }

  (function makeTokensClickable(){
    if(!ta) return;
    document.querySelectorAll('.token').forEach(tok=>{
      tok.setAttribute('role','button');
      tok.setAttribute('tabindex','0');
      tok.addEventListener('click', ()=> insertAtCursor(ta, tok.textContent.trim()));
      tok.addEventListener('keydown', (e)=>{
        if(e.key==='Enter' || e.key===' '){
          e.preventDefault();
          insertAtCursor(ta, tok.textContent.trim());
        }
      });
    });
  })();

})();