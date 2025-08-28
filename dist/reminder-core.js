// reminder-core.js
// Modulo riutilizzabile per caricare il template da Firestore,
// costruire il messaggio, e aprire WhatsApp con testo + emoji corretti.

// ===== Firebase =====
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Se l'app è già inizializzata altrove, non crea duplicati
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

// ===== Utility locali =====
const FMT_DATA = new Intl.DateTimeFormat("it-IT", { day:"2-digit", month:"2-digit", year:"2-digit" });
const normalizeText = (s) => (s ?? "").toString().normalize("NFC"); // emoji-safe

export function normalizePhoneForWA(telRaw){
  const digits = (telRaw||"").replace(/\D/g,"");
  if(!digits) return "";
  if(digits.length === 10 && digits.startsWith("3")) return "39"+digits; // mobile IT
  return digits;
}

export function apptToDateTime(a){
  if(!a) return null;
  // preferisci a.dateTime (Timestamp/Date/number/string)
  const toDate = (d)=>{
    if(!d) return null;
    if(d?.toDate) return d.toDate();
    if(typeof d==="number" || typeof d==="string") return new Date(d);
    return d instanceof Date ? d : null;
  };
  const dtFull = toDate(a.dateTime);
  if(dtFull) return dtFull;

  const base = toDate(a.data || a.date);
  if(!base) return null;
  const res = new Date(base);
  const hhmm = (a.ora || "").split(":");
  const hh = parseInt(hhmm[0]||"0",10);
  const mm = parseInt(hhmm[1]||"0",10);
  res.setHours(hh||0, mm||0, 0, 0);
  return res;
}

export function getApptNames(a){
  if(Array.isArray(a?.trattamenti) && a.trattamenti.length){
    return a.trattamenti.map(t=>t?.nome||t?.titolo||t).join(", ");
  }
  return a?.trattamento || a?.titolo || "";
}

export function findBestAppointmentForReminder(list, now=new Date()){
  if(!Array.isArray(list)) return null;
  const map = list.map(a=>({ a, when: apptToDateTime(a) })).filter(x=>x.when instanceof Date);
  const future = map.filter(x=>x.when >= now).sort((x,y)=> x.when - y.when);
  if(future.length) return future[0].a;
  const past = map.filter(x=>x.when < now).sort((x,y)=> y.when - x.when);
  return past.length ? past[0].a : null;
}

// ===== Template da Firestore (cache + invalidazione) =====
let templateCache = null;

export async function loadReminderTemplate({force=false}={}){
  if(!force && templateCache !== null) return templateCache;
  try{
    const snap = await getDoc(doc(db, "settings", "reminder"));
    templateCache = snap.exists() ? (snap.data().template || "") : "";
  }catch{
    templateCache = "";
  }
  return templateCache;
}
export function invalidateReminderTemplateCache(){
  templateCache = null;
  // opzionale: broadcast per chi volesse ascoltare l’evento
  window.dispatchEvent(new CustomEvent("reminder-template-updated"));
}

// ===== Costruzione messaggio =====
export function buildReminderMessage(template, cliente, appt){
  const nome = cliente?.nome || "";
  const d = apptToDateTime(appt);
  const dataStr = d ? FMT_DATA.format(d) : "";
  const oraStr  = d ? String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0")
                    : (appt?.ora||"");
  const tratt   = getApptNames(appt);

  const tpl = (template && String(template).trim()) ||
    "Ciao {NOME}! Ti ricordiamo l’appuntamento del {DATA} alle {ORA}. {TRATTAMENTI}. A presto!";
  return tpl
    .replaceAll("{NOME}", nome)
    .replaceAll("{DATA}", dataStr)
    .replaceAll("{ORA}",  oraStr)
    .replaceAll("{TRATTAMENTI}", tratt);
}

// ===== Apertura WhatsApp =====
export async function openWhatsAppReminder({cliente, appuntamenti, telefonoOverride}={}){
  const tel = (telefonoOverride ?? cliente?.telefono ?? "").toString().trim();
  const telNorm = normalizePhoneForWA(tel);
  if(!telNorm){ alert("Numero non valido o mancante per WhatsApp."); return; }

  if(!Array.isArray(appuntamenti) || appuntamenti.length===0){
    alert("Nessun appuntamento per questo cliente.");
    return;
  }
  const appt = findBestAppointmentForReminder(appuntamenti);
  if(!appt){ alert("Non trovo un appuntamento valido per creare il messaggio."); return; }

  const template = await loadReminderTemplate(); // legge sempre l’ultimo (grazie a invalidate su salvataggio)
  const msg = normalizeText(buildReminderMessage(template, cliente, appt));

  // Apri WhatsApp in nuova tab (non tocca la pagina attuale)
  const url = `https://wa.me/${telNorm}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank", "noopener");
}