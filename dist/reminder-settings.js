// ===== Firebase =====
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Configura Firebase (uguale agli altri file della tua app)
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

// ===== DOM =====
const textarea = document.getElementById("reminder-template");
const btnSave  = document.getElementById("btnSalvaTemplate");
const btnPrev  = document.getElementById("btnAnteprima");

// ===== Funzioni =====
async function caricaTemplate() {
  try {
    const ref  = doc(db, "settings", "reminder");
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      if (data.template) {
        textarea.value = data.template;
      }
    }
  } catch (err) {
    console.error("Errore caricamento template:", err);
  }
}

async function salvaTemplate() {
  try {
    const ref = doc(db, "settings", "reminder");
    await setDoc(ref, { template: textarea.value || "" }, { merge: true });
    alert("Template salvato.");
  } catch (err) {
    console.error("Errore salvataggio template:", err);
    alert("Impossibile salvare il template.");
  }
}

function insertAtCursor(el, text) {
  el.focus();
  const start = el.selectionStart ?? el.value.length;
  const end   = el.selectionEnd ?? el.value.length;
  const before = el.value.slice(0, start);
  const after  = el.value.slice(end);
  el.value = before + text + after;
  const caret = start + text.length;
  el.setSelectionRange(caret, caret);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

// ===== Eventi =====
// Token cliccabili
document.querySelectorAll(".token").forEach(tok => {
  tok.addEventListener("click", () => {
    const value = tok.getAttribute("data-insert") || tok.textContent.trim();
    insertAtCursor(textarea, value);
  });
});

// Salvataggio
btnSave?.addEventListener("click", salvaTemplate);

// Anteprima
btnPrev?.addEventListener("click", () => {
  const demo = (textarea.value || "")
    .replaceAll("{NOME}", "Giulia")
    .replaceAll("{DATA}", "12/09/2025")
    .replaceAll("{ORA}", "15:00")
    .replaceAll("{TRATTAMENTI}", "Laminazione ciglia");
  alert("Anteprima:\n\n" + demo);
});

// ===== Avvio =====
caricaTemplate();