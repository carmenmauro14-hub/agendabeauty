// reminder-settings.js
// Gestione del template promemoria

import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

const db = getFirestore(getApp());

const ta      = document.getElementById("reminder-template");
const btnPrev = document.getElementById("btnAnteprima");
const btnSave = document.getElementById("btnSalvaTemplate");

const LS_KEY = "bb-reminder-template";

function buildPreview(text){
  return (text||"")
    .replaceAll("{NOME}","Giulia")
    .replaceAll("{DATA}","12/09/2025")
    .replaceAll("{ORA}","15:00")
    .replaceAll("{TRATTAMENTI}","Laminazione ciglia");
}

async function loadTemplate(){
  try {
    const snap = await getDoc(doc(db,"settings","reminder"));
    if (snap.exists()) {
      const tpl = snap.data().template || "";
      if (!ta.value) ta.value = tpl;
      localStorage.setItem(LS_KEY, tpl);
      return;
    }
  } catch {}
  // fallback LS
  const saved = localStorage.getItem(LS_KEY);
  if (!ta.value && saved) ta.value = saved;
}

async function saveTemplate(){
  const value = ta.value || "";
  try {
    await setDoc(doc(db,"settings","reminder"),{
      template:value, updatedAt:serverTimestamp()
    },{merge:true});
    localStorage.setItem(LS_KEY,value);
    alert("Template salvato.");
  } catch(e){
    localStorage.setItem(LS_KEY,value);
    alert("Salvato in locale (offline).");
  }
}

btnSave?.addEventListener("click", saveTemplate);
btnPrev?.addEventListener("click", ()=>{
  alert("Anteprima:\n\n"+buildPreview(ta.value));
});

loadTemplate();