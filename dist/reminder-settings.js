// Salvataggio locale + anteprima + inserimento chip nel punto-cursore
const KEY = 'bb-reminder-template';

const textarea = document.getElementById('reminder-template');
const btnSave  = document.getElementById('btnSalvaTemplate');
const btnPrev  = document.getElementById('btnAnteprima');

// 1) carica template (se presente) da localStorage
try{
  const saved = localStorage.getItem(KEY);
  if (!textarea.value && saved) textarea.value = saved;
}catch{}

// 2) inserimento token nel caret
function insertAtCaret(el, text){
  // fallback: append
  if (typeof el.selectionStart !== 'number' || typeof el.selectionEnd !== 'number'){
    el.value += text;
    el.focus();
    return;
  }
  const start = el.selectionStart;
  const end   = el.selectionEnd;
  const before = el.value.slice(0, start);
  const after  = el.value.slice(end);
  el.value = before + text + after;

  const pos = start + text.length;
  el.selectionStart = el.selectionEnd = pos;
  el.focus();
}

// click sui chip
document.querySelectorAll('.chip').forEach(chip=>{
  chip.addEventListener('click', ()=>{
    const token = chip.dataset.token || chip.textContent.trim();
    insertAtCaret(textarea, token);
  });
});

// 3) Salva
btnSave?.addEventListener('click', ()=>{
  try{
    localStorage.setItem(KEY, textarea.value || '');
    alert('Template salvato.');
  }catch{
    alert('Impossibile salvare il template.');
  }
});

// 4) Anteprima (con valori fittizi)
btnPrev?.addEventListener('click', ()=>{
  const demo = (textarea.value || '')
    .replaceAll('{NOME}','Giulia')
    .replaceAll('{DATA}','12/09/2025')
    .replaceAll('{ORA}','15:00')
    .replaceAll('{TRATTAMENTI}','Laminazione ciglia');
  alert('Anteprima:\n\n' + demo);
});