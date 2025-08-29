// reminder-core.js
// Modulo unico per: caricamento template (Firestore), selezione appuntamento, costruzione messaggio, apertura WhatsApp

// ===== Firebase (ESM) =====
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Config condivisa (stessa della tua app)
const firebaseConfig = {
  apiKey: "AIzaSyD0tDQQepdvj_oZPcQuUrEKpoNOd4zF0nE",
  authDomain: "agenda-carmenmauro.firebaseapp.com",
  projectId: "agenda-carmenmauro",
  storageBucket: "agenda-carmenmauro.appspot.com",
  messagingSenderId: "959324976221",
  appId: "1:959324976221:web:780c8e9195965cea0749b4"
};

// Evita doppie inizializzazioni
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ===== Utils locali =====
const FMT_DATA = new Intl.DateTimeFormat("it-IT",{day:"2-digit",month:"2-digit",year:"2-digit"});

// Normalizza stringhe per preservare emoji (NFC)
const normalizeText = (s) => (s ?? "").toString().normalize("NFC");

// Normalizza telefono per WhatsApp (solo cifre + prefisso IT se serve)
function normalizePhoneForWA(telRaw){
  const digits = (telRaw||"").replace(/\D/g,"");
  if(!digits) return "";
  if(digits.length === 10 && digits.startsWith("3")) return "39"+digits;
  return digits;
}

// Converte in Date coerente
function safeDate(d){
  if(!d) return null;
  if(d?.toDate) return d.toDate();
  if(typeof d==="number") return new Date(d);
  if(typeof d==="string") return new Date(d);
  return d instanceof Date ? d : null;
}
function apptToDateTime(a){
  const dtFull = safeDate(a?.dateTime);
  if(dtFull) return dtFull;
  const base = safeDate(a?.data || a?.date);
  if(!base) return null;
  const res = new Date(base);
  const hhmm = (a?.ora || "").split(":");
  res.setHours(parseInt(hhmm[0]||"0",10), parseInt(hhmm[1]||"0",10), 0, 0);
  return res;
}

// Nomi trattamenti
function getApptNames(a){
  if(Array.isArray(a?.trattamenti) && a.trattamenti.length){
    return a.trattamenti.map(t=>t?.nome || t?.titolo || t).join(", ");
  }
  return a?.trattamento || a?.titolo || "";
}

// Sceglie: prossimo futuro, altrimenti il più recente passato
function findBestAppointmentForReminder(list){
  const now = new Date();
  const withDT = (list||[]).map(a => ({ a, when: apptToDateTime(a) || safeDate(a?.data) || null }))
                           .filter(x => x.when instanceof Date);
  const future = withDT.filter(x => x.when >= now).sort((x,y)=> x.when - y.when);
  if(future.length) return future[0].a;
  const past = withDT.filter(x => x.when < now).sort((x,y)=> y.when - x.when);
  return past.length ? past[0].a : null;
}

// ===== Template su Firestore (settings/reminder) =====
let REMINDER_TEMPLATE_CACHE = null;

export async function loadReminderTemplate(){
  if (REMINDER_TEMPLATE_CACHE !== null) return REMINDER_TEMPLATE_CACHE;
  try{
    const snap = await getDoc(doc(db, "settings", "reminder"));
    REMINDER_TEMPLATE_CACHE = snap.exists() ? (snap.data().template || "") : "";
  }catch{
    REMINDER_TEMPLATE_CACHE = "";
  }
  return REMINDER_TEMPLATE_CACHE;
}

export async function saveReminderTemplate(newTemplate){
  const tpl = (newTemplate ?? "").toString();
  await setDoc(doc(db,"settings","reminder"), { template: tpl }, { merge: true });
  REMINDER_TEMPLATE_CACHE = tpl;
  return tpl;
}

// ===== Costruzione messaggio =====
export function buildReminderMessage(template, cliente, appt){
  const nome = cliente?.nome || "";
  const d = apptToDateTime(appt);
  const dataStr = d ? FMT_DATA.format(d) : "";
  const oraStr  = d ? String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0") : (appt?.ora||"");
  const tratt   = getApptNames(appt) || "";

  const tpl = (template && String(template).trim())
    || "Ciao {NOME}! Ti ricordiamo l’appuntamento del {DATA} alle {ORA}. {TRATTAMENTI}. A presto!";

  return normalizeText(
    tpl
      .replaceAll("{NOME}", nome)
      .replaceAll("{DATA}", dataStr)
      .replaceAll("{ORA}",  oraStr)
      .replaceAll("{TRATTAMENTI}", tratt)
  );
}

// ===== Apertura WhatsApp =====
export async function openWhatsAppReminder(clienteData, appointmentsList){
  const telRaw  = (clienteData?.telefono || "").toString().trim();
  const telNorm = normalizePhoneForWA(telRaw);
  if(!telNorm){
    alert("Numero non valido o mancante per WhatsApp.");
    return;
  }

  if(!appointmentsList || !appointmentsList.length){
    alert("Nessun appuntamento per questo cliente.");
    return;
  }
  const appt = findBestAppointmentForReminder(appointmentsList);
  if(!appt){
    alert("Non trovo un appuntamento valido per creare il messaggio.");
    return;
  }

  const template = await loadReminderTemplate();
  const msg = normalizeText(buildReminderMessage(template, clienteData, appt));

  // ✅ Deeplink nativo
  const deepLink = new URL("whatsapp://send");
  deepLink.searchParams.set("phone", telNorm);
  deepLink.searchParams.set("text", msg);

  // ✅ Fallback web
  const webLink = new URL("https://api.whatsapp.com/send");
  webLink.searchParams.set("phone", telNorm);
  webLink.searchParams.set("text", msg);

  // Prova deeplink
  window.location.href = deepLink.toString();

  // Se entro 1.5s non parte WhatsApp, fallback a web
  setTimeout(()=>{
    if(document.visibilityState === "visible"){
      window.location.href = webLink.toString();
    }
  },1500);
}