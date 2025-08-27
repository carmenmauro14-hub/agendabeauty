// reminder-settings.js
import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const db = getFirestore(getApp());

// ─── Riferimenti DOM ───────────────────────────────────────────
const templateInput = document.getElementById("reminderTemplate");
const saveBtn       = document.getElementById("saveReminder");
const previewBox    = document.getElementById("reminderPreview");

// ─── Stato corrente ───────────────────────────────────────────
let settingsDocRef = doc(db, "settings", "reminder");
let currentData = {};

// ─── Funzione di sostituzione token ────────────────────────────
function buildPreview(template){
  return template
    .replace("{NOME}", "Maria Rossi")
    .replace("{DATA}", "12/09/2025")
    .replace("{ORA}", "15:00");
}

// ─── Caricamento iniziale ──────────────────────────────────────
async function loadSettings(){
  try {
    const snap = await getDoc(settingsDocRef);
    if (snap.exists()) {
      currentData = snap.data();
      if (templateInput) {
        templateInput.value = currentData.template ||
          "Ciao {NOME}, ti ricordiamo il tuo appuntamento il {DATA} alle {ORA}.";
      }
    } else {
      templateInput.value =
        "Ciao {NOME}, ti ricordiamo il tuo appuntamento il {DATA} alle {ORA}.";
    }
    aggiornaPreview();
  } catch (err) {
    console.error("Errore caricando impostazioni:", err);
    alert("Errore nel caricamento impostazioni.");
  }
}

// ─── Aggiorna preview ─────────────────────────────────────────
function aggiornaPreview(){
  if (!previewBox) return;
  const text = templateInput.value || "";
  previewBox.textContent = buildPreview(text);
}

// ─── Salvataggio ──────────────────────────────────────────────
async function saveSettings(){
  const template = templateInput.value.trim();
  try {
    await setDoc(settingsDocRef, { template }, { merge:true });
    alert("Promemoria salvato!");
  } catch (err) {
    console.error("Errore salvataggio:", err);
    alert("Errore durante il salvataggio.");
  }
}

// ─── Eventi UI ────────────────────────────────────────────────
saveBtn?.addEventListener("click", saveSettings);
templateInput?.addEventListener("input", aggiornaPreview);

// ─── Avvio ────────────────────────────────────────────────────
loadSettings();