// reminder-settings.js
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- Firebase init (riusa l'app se già esiste) ---
const firebaseConfig = {
  apiKey: "AIzaSyD0tDQQepdvj_oZPcQuUrEKpoNOd4zF0nE",
  authDomain: "agenda-carmenmauro.firebaseapp.com",
  projectId: "agenda-carmenmauro",
  storageBucket: "agenda-carmenmauro.appspot.com",
  messagingSenderId: "959324976221",
  appId: "1:959324976221:web:780c8e9195965cea0749b4"
};
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db  = getFirestore(app);

// --- DOM refs ---
const enableChk   = document.getElementById("enable-reminders");
const advanceSel  = document.getElementById("reminder-time");
// opzionale: se in futuro aggiungi un campo testo per il template, usa id="reminder-template"
const templateTxt = document.getElementById("reminder-template");  // può essere null
// opzionale: piccolo badge stato (lo creo dinamicamente se non esiste)
let statusEl = document.getElementById("reminder-status");

// crea uno span di stato in cima alla pagina se non esiste
(function ensureStatusBadge(){
  if (!statusEl) {
    const main = document.querySelector(".reminder-container") || document.body;
    statusEl = document.createElement("small");
    statusEl.id = "reminder-status";
    statusEl.style.display = "block";
    statusEl.style.margin = "8px 0 0";
    statusEl.style.color = "#7c6a60";
    main?.insertBefore(statusEl, main.firstChild?.nextSibling || null);
  }
})();

function setStatus(text, ok=true){
  if (!statusEl) return;
  statusEl.textContent = text || "";
  statusEl.style.color = ok ? "#7c6a60" : "#b4483a";
}

// --- Firestore doc path ---
// globale per l'app; se vorrai impostazioni per-utente: usa `doc(db, "users", userId, "settings", "reminders")`
const settingsRef = doc(db, "settings", "reminders");

// --- Debounce utility ---
const debounce = (fn, ms=500) => {
  let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); };
};

// --- Carica impostazioni ---
async function loadSettings(){
  try{
    // disabilita UI durante il load
    setDisabled(true);
    setStatus("Caricamento impostazioni…");
    const snap = await getDoc(settingsRef);
    const data = snap.exists() ? snap.data() : {
      enabled: false,
      advance: "24h",
      template: ""   // opzionale
    };

    // applica in UI (rispetta elementi mancanti)
    if (enableChk)  enableChk.checked = !!data.enabled;
    if (advanceSel) advanceSel.value  = data.advance || "24h";
    if (templateTxt && typeof data.template === "string") templateTxt.value = data.template;

    setStatus("Impostazioni caricate.");
  }catch(err){
    console.error("Errore caricamento settings:", err);
    setStatus("Errore nel caricamento delle impostazioni.", false);
  }finally{
    setDisabled(false);
  }
}

// --- Salva impostazioni (merge sicuro) ---
async function saveSettings(patch){
  try{
    setStatus("Salvataggio…");
    // se il doc non esiste ancora, setDoc con merge true lo crea
    await setDoc(settingsRef, { ...patch, updatedAt: serverTimestamp() }, { merge: true });
    setStatus("Salvato.");
  }catch(err){
    console.error("Errore salvataggio settings:", err);
    setStatus("Errore salvataggio.", false);
  }
}

const saveSettingsDebounced = debounce(saveSettings, 500);

// --- Gestione UI disabilitata durante operazioni ---
function setDisabled(on){
  [enableChk, advanceSel, templateTxt].forEach(el=>{
    if (el) el.disabled = !!on;
  });
}

// --- Event listeners (salvataggio in tempo reale con debounce) ---
enableChk?.addEventListener("change", ()=>{
  saveSettingsDebounced({ enabled: !!enableChk.checked });
});

advanceSel?.addEventListener("change", ()=>{
  // normalizza valori ammessi
  const allowed = new Set(["24h","12h","2h"]);
  const val = allowed.has(advanceSel.value) ? advanceSel.value : "24h";
  saveSettingsDebounced({ advance: val });
});

templateTxt?.addEventListener("input", ()=>{
  // se hai il campo testo per il template promemoria
  const val = templateTxt.value || "";
  saveSettingsDebounced({ template: val });
});

// --- Avvio ---
loadSettings();