(function(){
  const KEY = 'bb-reminder-template';
  const ta  = document.getElementById('reminder-template');
  const btnSave = document.getElementById('btnSalvaTemplate');
  const btnPrev = document.getElementById('btnAnteprima');
  const tokens  = document.querySelectorAll('.token');

  // Carica template salvato
  try {
    const saved = localStorage.getItem(KEY);
    if (!ta.value && saved) ta.value = saved;
  } catch(e){}

  // Salva template
  btnSave?.addEventListener('click', () => {
    try {
      localStorage.setItem(KEY, ta.value || '');
      alert('Template salvato.');
    } catch(e){
      alert('Impossibile salvare il template.');
    }
  });

  // Anteprima template
  btnPrev?.addEventListener('click', () => {
    const demo = (ta.value || '')
      .replaceAll('{NOME}', 'Giulia')
      .replaceAll('{DATA}', '12/09/2025')
      .replaceAll('{ORA}', '15:00')
      .replaceAll('{TRATTAMENTI}', 'Laminazione ciglia');
    alert('Anteprima:\n\n' + demo);
  });

  // Inserimento variabile cliccando il chip
  tokens.forEach(tok => {
    tok.addEventListener('click', () => {
      const token = tok.dataset.token;
      const start = ta.selectionStart;
      const end   = ta.selectionEnd;
      const text  = ta.value;
      ta.value = text.slice(0, start) + token + text.slice(end);
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + token.length;
    });
  });
})();