// ===== Firebase =====
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, getDoc, updateDoc, collection, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

// ===== Utils =====
const formatEuro = (n) => Number(n || 0).toLocaleString("it-IT",{style:"currency",currency:"EUR"});
function toNumberSafe(v){
  if(v==null) return 0;
  if(typeof v==="number") return isFinite(v)?v:0;
  if(typeof v==="string"){
    const n=parseFloat(v.replace(/[€\s]/g,"").replace(",","."));
    return isNaN(n)?0:n;
  }
  return 0;
}
function safeDate(d){
  if(!d) return null;
  if(d?.toDate) return d.toDate();
  if(typeof d==="number") return new Date(d);
  if(typeof d==="string") return new Date(d);
  return d instanceof Date ? d : null;
}
function getApptTotal(a){
  if(Array.isArray(a.trattamenti)&&a.trattamenti.length){
    return a.trattamenti.reduce((s,t)=>s+toNumberSafe(t?.prezzo ?? t?.costo ?? t?.price),0);
  }
  return toNumberSafe(a.prezzo ?? a.totale ?? a.price ?? a.costo);
}
function getApptNames(a){
  if(Array.isArray(a.trattamenti)&&a.trattamenti.length){
    return a.trattamenti.map(t=>t?.nome||t?.titolo||t).join(", ");
  }
  return a.trattamento || a.titolo || "";
}
const FMT_DATA = new Intl.DateTimeFormat("it-IT",{day:"2-digit",month:"2-digit",year:"2-digit"});

// ===== DOM =====
const backBtn        = document.getElementById("backBtn");
const editBtnTop     = document.getElementById("editBtnTop");

const avatarIniziali = document.getElementById("avatarIniziali");
const displayName    = document.getElementById("displayName");
const infoPhone      = document.getElementById("infoPhone");
const infoEmail      = document.getElementById("infoEmail");
const rowEmail       = document.getElementById("rowEmail");

// NOTE
const noteInput      = document.getElementById("noteInput");
const noteStatus     = document.getElementById("noteStatus");

// inline edit
const infoView       = document.getElementById("infoView");
const infoEdit       = document.getElementById("infoEdit");
const editNome       = document.getElementById("editNome");
const editTelefono   = document.getElementById("editTelefono");
const editEmail      = document.getElementById("editEmail");
const cancelInline   = document.getElementById("cancelInline");

// stats
const yearSelect     = document.getElementById("yearSelect");
const valAnno        = document.getElementById("valAnno");
const valTotale      = document.getElementById("valTotale");
const barAnno        = document.getElementById("barAnno");
const barTotale      = document.getElementById("barTotale");
const yearByTreatment= document.getElementById("yearByTreatment");

// storico (in pagina)
const historyList    = document.getElementById("historyList");
const showAllBtn     = document.getElementById("showAllHistory");

// bottom-sheet
const sheet          = document.getElementById("historySheet");
const sheetBackdrop  = document.getElementById("sheetBackdrop");
const sheetClose     = document.getElementById("sheetClose");
const sheetYear      = document.getElementById("sheetYear");
const sheetHistory   = document.getElementById("sheetHistory");
const sheetPanel     = document.querySelector("#historySheet .sheet-panel");
const sheetHeader    = document.querySelector("#historySheet .sheet-header");
const sheetHandle    = document.querySelector("#historySheet .sheet-handle");
const sheetContent   = document.querySelector("#historySheet .sheet-content");

// ===== Stato =====
let clienteId   = null;
let clienteData = null;
let allHistoryItems = [];
let allYears = [];
let allAppointmentsRaw = []; // <— per promemoria

// ===== Helpers =====
const debounce = (fn, ms=600) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };
function autosize(el){ if(!el) return; el.style.height='auto'; el.style.height = Math.max(el.scrollHeight, 92) + 'px'; }
function getClienteId(){ const url = new URLSearchParams(location.search); return url.get("id") || sessionStorage.getItem("clienteId") || null; }

// --- Helpers promemoria ---
function normalizePhoneForWA(telRaw){
  const digits = (telRaw||"").replace(/\D/g,"");
  if(!digits) return "";
  if(digits.length === 10 && digits.startsWith("3")) return "39"+digits; // mobile IT
  return digits;
}
function apptToDateTime(a){
  const dtFull = safeDate(a.dateTime);
  if(dtFull) return dtFull;
  const base = safeDate(a.data || a.date);
  if(!base) return null;
  const res = new Date(base);
  const hhmm = (a.ora || "").split(":");
  const hh = parseInt(hhmm[0]||"0",10);
  const mm = parseInt(hhmm[1]||"0",10);
  res.setHours(hh||0, mm||0, 0, 0);
  return res;
}
function findBestAppointmentForReminder(list){
  const now = new Date();
  const withDT = list.map(a => ({ a, when: apptToDateTime(a) || safeDate(a.data) || null }))
                     .filter(x => x.when instanceof Date);
  const future = withDT.filter(x => x.when >= now).sort((x,y)=> x.when - y.when);
  if(future.length) return future[0].a;
  const past = withDT.filter(x => x.when < now).sort((x,y)=> y.when - x.when);
  return past.length ? past[0].a : null;
}
function buildReminderMessage(template, cliente, appt){
  const nome = cliente?.nome || "";
  const d = apptToDateTime(appt);
  const dataStr = d ? FMT_DATA.format(d) : "";
  const oraStr  = d ? String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0") : (appt?.ora||"");
  const tratt   = getApptNames(appt) || "";

  const tpl = (template && String(template).trim()) ||
    "Ciao {NOME}! Ti ricordiamo l’appuntamento del {DATA} alle {ORA}. {TRATTAMENTI}. A presto!";

  return tpl
    .replaceAll("{NOME}", nome)
    .replaceAll("{DATA}", dataStr)
    .replaceAll("{ORA}",  oraStr)
    .replaceAll("{TRATTAMENTI}", tratt);
}

// --- Loader template da Firestore con cache in memoria + fallback locale ---
let reminderTemplateCache = null;
async function loadReminderTemplate(){
  if (reminderTemplateCache !== null) return reminderTemplateCache;
  try{
    const snap = await getDoc(doc(db, "settings", "reminder"));
    reminderTemplateCache = snap.exists() ? (snap.data().template || "") : "";
  }catch(_){
    reminderTemplateCache = "";
  }
  if (!reminderTemplateCache) {
    try { reminderTemplateCache = localStorage.getItem("bb-reminder-template") || ""; } catch(_) {}
  }
  return reminderTemplateCache;
}

// ===== Caricamento Cliente =====
async function caricaCliente(){
  clienteId = getClienteId();
  if(!clienteId) return;

  const ref  = doc(db,"clienti",clienteId);
  const snap = await getDoc(ref);
  if(!snap.exists()) return;

  clienteData = snap.data();

  const nome = clienteData.nome || "—";
  const tel  = (clienteData.telefono || "").toString().trim();
  const mail = (clienteData.email || "").toString().trim();
  const note = (clienteData.note  || "").toString();

  displayName.textContent = nome;
  infoPhone.textContent = tel || "—";
  infoPhone.href = tel ? `tel:${tel}` : "#";

  if (mail) {
    rowEmail.style.display = "";
    infoEmail.textContent = mail;
    infoEmail.href = `mailto:${mail}`;
  } else {
    rowEmail.style.display = "none";
  }

  noteInput.value = note; autosize(noteInput); noteStatus.textContent = "";

  const iniziali = nome.split(" ").filter(Boolean).map(w=>w[0].toUpperCase()).slice(0,2).join("") || "AA";
  avatarIniziali.textContent = iniziali;

  // quick actions
  const btnSms = document.getElementById("btnSms");
  const btnCall = document.getElementById("btnCall");
  const btnWa   = document.getElementById("btnWa");
  const btnApp  = document.getElementById("btnApp");
  const btnRem  = document.getElementById("btnRem");

  if (tel) {
    btnSms.href = `sms:${tel}`;
    btnCall.href = `tel:${tel}`;
    btnWa.href   = `https://wa.me/${tel.replace(/[^\d]/g,"")}`;
  } else {
    btnSms.removeAttribute("href"); btnCall.removeAttribute("href"); btnWa.removeAttribute("href");
  }
  btnApp.href = `nuovo-appuntamento.html?cliente=${encodeURIComponent(clienteId)}`;

  // ——— Promemoria WhatsApp (semi-automatico)
  btnRem.onclick = async (e)=>{
    e.preventDefault();
    const telNorm = normalizePhoneForWA(tel);
    if(!telNorm){
      alert("Numero non valido o mancante per WhatsApp.");
      return;
    }
    if(!allAppointmentsRaw.length){
      alert("Nessun appuntamento per questo cliente.");
      return;
    }
    const appt = findBestAppointmentForReminder(allAppointmentsRaw);
    if(!appt){
      alert("Non trovo un appuntamento valido per creare il messaggio.");
      return;
    }

    // Carica il template da Firestore (con cache/fallback)
    const template = await loadReminderTemplate();

    const msg = buildReminderMessage(template, clienteData, appt);
    const url = `https://wa.me/${telNorm}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener");
  };

  await caricaStoricoETotale();
  await popolaAnniERender();
}

// ===== Note =====
const saveNote = debounce(async ()=>{
  if(!clienteId) return;
  const newNote = noteInput.value.trim();
  if(newNote === (clienteData.note || "")) { noteStatus.textContent = ""; return; }
  noteStatus.textContent = "Salvataggio…";
  try{
    await updateDoc(doc(db,"clienti",clienteId), { note: newNote });
    clienteData.note = newNote;
    noteStatus.textContent = "Salvato";
    setTimeout(()=>{ noteStatus.textContent=""; }, 1200);
  }catch{ noteStatus.textContent = "Errore salvataggio"; }
}, 700);

noteInput.addEventListener('input', ()=>{ autosize(noteInput); saveNote(); });
window.addEventListener('resize', ()=>autosize(noteInput));

// ===== Storico & Totale (pagina) =====
async function caricaStoricoETotale(){
  historyList.innerHTML = "";
  allHistoryItems = [];
  allAppointmentsRaw = [];

  const q  = query(collection(db,"appuntamenti"), where("clienteId","==",clienteId));
  const qs = await getDocs(q);

  let totaleSempre = 0;

  qs.forEach(s=>{
    const a = s.data();
    const dt = safeDate(a.data || a.date || a.dateTime);
    const tot = getApptTotal(a);
    totaleSempre += tot;

    allHistoryItems.push({ dt, tratt: getApptNames(a) || "—", prezzo: tot });
    allAppointmentsRaw.push(a);
  });

  allHistoryItems.sort((a,b)=>(b.dt?.getTime?.()||0)-(a.dt?.getTime?.()||0));

  const short = allHistoryItems.slice(0,3);
  renderHistoryList(historyList, short);

  showAllBtn.style.display = allHistoryItems.length > 3 ? "" : "none";

  valTotale.textContent = formatEuro(totaleSempre);
  barTotale.style.width = "100%";

  const anni = new Set();
  allHistoryItems.forEach(it => { if(it.dt) anni.add(it.dt.getFullYear()); });
  allYears = [...anni].sort((a,b)=>b-a);
}

function renderHistoryList(container, items){
  container.innerHTML = "";
  items.forEach(it=>{
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <div class="h-date">${it.dt ? FMT_DATA.format(it.dt) : "—"}</div>
        <div class="h-tratt">${it.tratt}</div>
      </div>
        <div class="h-amt">${formatEuro(it.prezzo)}</div>`;
    container.appendChild(li);
  });
}

// ===== Statistiche per anno =====
async function popolaAnniERender(){
  const q  = query(collection(db,"appuntamenti"), where("clienteId","==",clienteId));
  const qs = await getDocs(q);
  const anni = new Set();

  qs.forEach(s=>{
    const dt = safeDate(s.data().data || s.data().date || s.data().dateTime);
    if(dt) anni.add(dt.getFullYear());
  });

  const arr = [...anni].sort((a,b)=>b-a);
  const current = new Date().getFullYear();
  yearSelect.innerHTML = (arr.length?arr:[current]).map(y=>`<option value="${y}">${y}</option>`).join("");
  yearSelect.value = arr.includes(current) ? current : (arr[0] || current);

  await aggiornaStatistiche(Number(yearSelect.value));
  yearSelect.onchange = ()=>aggiornaStatistiche(Number(yearSelect.value));
}

async function aggiornaStatistiche(anno){
  const q  = query(collection(db,"appuntamenti"), where("clienteId","==",clienteId));
  const qs = await getDocs(q);

  let totAnno = 0;
  const perTratt = {};

  qs.forEach(s=>{
    const a  = s.data();
    const dt = safeDate(a.data || a.date || a.dateTime);
    if(!dt || dt.getFullYear()!==anno) return;

    const apptTotal = getApptTotal(a);
    totAnno += apptTotal;

    if(Array.isArray(a.trattamenti)&&a.trattamenti.length){
      a.trattamenti.forEach(t=>{
        const nome = t?.nome || t?.titolo || "Trattamento";
        const p    = toNumberSafe(t?.prezzo ?? t?.costo ?? t?.price);
        if(!perTratt[nome]) perTratt[nome] = {count:0,sum:0};
        perTratt[nome].count += 1;
        perTratt[nome].sum   += p;
      });
    } else if (a.trattamento || a.titolo){
      const nome = a.trattamento || a.titolo;
      if(!perTratt[nome]) perTratt[nome] = {count:0,sum:0};
      perTratt[nome].count += 1;
      perTratt[nome].sum   += apptTotal;
    }
  });

  valAnno.textContent = formatEuro(totAnno);
  const totalSempreNum = Number(valTotale.textContent.replace(/[^\d,.-]/g,"").replace(",","."));
  const perc = totalSempreNum>0 ? Math.max(0,Math.min(100,(totAnno/totalSempreNum)*100)) : 0;
  barAnno.style.width = `${perc.toFixed(0)}%`;

  const entries = Object.entries(perTratt)
    .sort((a,b)=> b[1].count - a[1].count || b[1].sum - a[1].sum);

  yearByTreatment.innerHTML = entries.length
    ? entries.map(([nome,v]) =>
        `<li><div class="qta-nome">${v.count} ${nome}</div><div class="totale">${formatEuro(v.sum)}</div></li>`
      ).join("")
    : "<li>—</li>";
}

// ===== Bottom-sheet =====
function preventBackgroundScroll(e){
  if (!sheet.hidden && !sheetPanel.contains(e.target)) {
    e.preventDefault();
  }
}

function openSheet(){
  const current = new Date().getFullYear();
  const anni = allYears.length ? allYears : [current];
  sheetYear.innerHTML = anni.map(y=>`<option value="${y}">${y}</option>`).join("");
  sheetYear.value = anni.includes(current) ? current : anni[0];
  renderSheetForYear(Number(sheetYear.value));

  sheetPanel.classList.remove("swipe-out-down");
  sheetPanel.style.transform = "";

  sheet.hidden = false;
  sheet.setAttribute("aria-hidden","false");
  document.body.classList.add("sheet-open");
  if (sheetContent) sheetContent.scrollTop = 0;

  window.addEventListener("touchmove", preventBackgroundScroll, {passive:false});
  window.addEventListener("wheel",     preventBackgroundScroll, {passive:false});
}

function closeSheet(){
  sheetPanel.classList.add("swipe-out-down");
  const finish = () => {
    sheetPanel.removeEventListener("transitionend", finish);
    sheet.hidden = true;
    sheet.setAttribute("aria-hidden","true");
    document.body.classList.remove("sheet-open");
    sheetPanel.classList.remove("swipe-out-down");
    sheetPanel.style.transform = "";
    window.removeEventListener("touchmove", preventBackgroundScroll);
    window.removeEventListener("wheel",     preventBackgroundScroll);
  };
  setTimeout(finish, 260);
  sheetPanel.addEventListener("transitionend", finish);
}

function renderSheetForYear(anno){
  const items = allHistoryItems.filter(it => it.dt && it.dt.getFullYear() === anno);
  renderHistoryList(sheetHistory, items);
}

// ===== Drag-to-close: SOLO handle/header + resistenza elastica =====
(function enableSheetDrag(){
  if(!sheetPanel) return;

  const CLOSE_DISTANCE  = 120;
  const FLICK_DISTANCE  = 60;
  const FLICK_VELOCITY  = 0.35;
  const LINEAR_LIMIT    = 80;
  const RESISTANCE_GAIN = 0.3;

  let startY = 0, lastY = 0, dragging = false, lastT = 0, velocity = 0;

  const getY = (e) => e?.touches?.[0]?.clientY ?? e?.clientY ?? 0;

  const mapWithResistance = (dy) => {
    if (dy <= 0) return 0;
    if (dy <= LINEAR_LIMIT) return dy;
    return LINEAR_LIMIT + (dy - LINEAR_LIMIT) * RESISTANCE_GAIN;
  };

  const beginDrag = (e) => {
    startY = lastY = getY(e);
    lastT  = performance.now();
    velocity = 0;
    dragging = true;
    sheetPanel.classList.add("dragging");
    sheetPanel.style.transition = "none";
    e.preventDefault();
  };

  const onMove = (e)=>{
    if(!dragging) return;
    const y = getY(e);
    const now = performance.now();
    const dy  = Math.max(0, y - startY);
    const eased = mapWithResistance(dy);

    const dt  = Math.max(1, now - lastT);
    velocity  = (y - lastY) / dt;
    lastY = y; lastT = now;

    sheetPanel.style.transform = `translateY(${eased}px)`;
    e.preventDefault();
  };

  const springBack = () => {
    sheetPanel.classList.remove("dragging");
    sheetPanel.style.transition = "transform .18s ease-out";
    sheetPanel.style.transform  = "";
    const clear = () => {
      sheetPanel.style.transition = "";
      sheetPanel.removeEventListener("transitionend", clear);
    };
    sheetPanel.addEventListener("transitionend", clear);
  };

  const onEnd = ()=>{
    if(!dragging) return;
    dragging = false;

    const dy = Math.max(0, lastY - startY);
    const shouldClose = dy > CLOSE_DISTANCE || (dy > FLICK_DISTANCE && velocity > FLICK_VELOCITY);

    sheetPanel.classList.remove("dragging");
    sheetPanel.style.transition = "";
    sheetPanel.style.transform  = "";

    if (shouldClose) {
      closeSheet();
    } else {
      springBack();
    }
  };

  const opts = { passive:false };

  sheetHandle?.addEventListener("touchstart", beginDrag, opts);
  sheetHandle?.addEventListener("mousedown",  beginDrag, opts);
  sheetHeader?.addEventListener("touchstart", beginDrag, opts);
  sheetHeader?.addEventListener("mousedown",  beginDrag, opts);

  window.addEventListener("touchmove",  onMove,  opts);
  window.addEventListener("mousemove",  onMove,  opts);
  window.addEventListener("touchend",   onEnd);
  window.addEventListener("mouseup",    onEnd);
  window.addEventListener("touchcancel",onEnd);
})();

// Eventi UI sheet
showAllBtn?.addEventListener("click", openSheet);
sheetYear?.addEventListener("change", ()=>renderSheetForYear(Number(sheetYear.value)));
document.addEventListener("keydown", (e)=>{ if(!sheet.hidden && e.key==="Escape") closeSheet(); });

// Chiudi da backdrop + X (click + touch)
const doClose = (e)=>{ e.preventDefault?.(); e.stopPropagation?.(); closeSheet(); };
sheetBackdrop?.addEventListener("click", doClose);
sheetClose?.addEventListener("click", doClose, {capture:true});
sheetClose?.addEventListener("touchend", doClose, {capture:true, passive:false});

// ===== Edit inline =====
function setEditMode(on){
  document.body.classList.toggle('editing', on);
  infoView.style.display = on ? "none" : "";
  infoEdit.style.display = on ? "flex" : "none";
}
editBtnTop.addEventListener("click", ()=>{
  if(!clienteData) return;
  editNome.value     = clienteData.nome || "";
  editTelefono.value = clienteData.telefono || "";
  editEmail.value    = clienteData.email || "";
  setEditMode(true);
});
cancelInline.addEventListener("click", ()=> setEditMode(false));

infoEdit.addEventListener("submit", async (e)=>{
  e.preventDefault();
  if(!clienteId) return;

  const ref = doc(db,"clienti",clienteId);
  await updateDoc(ref,{
    nome: editNome.value.trim(),
    telefono: editTelefono.value.trim(),
    email: editEmail.value.trim()
  });
  setEditMode(false);
  caricaCliente();
});

// ===== Back =====
backBtn.addEventListener("click", ()=>history.back());

// ===== Avvio =====
caricaCliente();
// Precarico “soft” del template per avere tutto pronto quando clicchi Promemoria
loadReminderTemplate();