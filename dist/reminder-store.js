// ===== Reminder Store (Firestore + localStorage fallback) =====
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } 
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getApp, getApps, initializeApp } 
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

// 🔹 Inizializza Firebase solo se non già fatto
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

// 🔹 Percorso unico in Firestore (config globale)
const TEMPLATE_DOC = doc(db, "config", "reminders");
const TEMPLATE_KEY = "bb-reminder-template"; // copia locale

// Carica template (prima Firestore, poi fallback locale)
export async function loadReminderTemplate(){
  try {
    const snap = await getDoc(TEMPLATE_DOC);
    if (snap.exists()){
      const t = snap.data()?.template ?? "";
      try { localStorage.setItem(TEMPLATE_KEY, t); } catch {}
      return t;
    }
  } catch(e) {
    console.warn("Errore lettura Firestore template:", e);
  }
  try { return localStorage.getItem(TEMPLATE_KEY) || ""; } catch { return ""; }
}

// Salva template (Firestore + fallback locale)
export async function saveReminderTemplate(text){
  const cleaned = String(text || "").trim();
  try {
    await setDoc(TEMPLATE_DOC, { 
      template: cleaned, 
      updatedAt: serverTimestamp() 
    }, { merge: true });
  } catch(e){
    console.warn("Errore salvataggio Firestore template:", e);
  }
  try { localStorage.setItem(TEMPLATE_KEY, cleaned); } catch {}
}