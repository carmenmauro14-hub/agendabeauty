// cliente.js — dettaglio cliente con supporto offline-first + sync_queue
import { db } from "./auth.js";
import {
  doc, getDoc, updateDoc, collection, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { openWhatsAppReminder } from "./reminder-core.js";
import { getAll, getById, putOne, putMany, queueChange } from "./storage.js";

// ===== Utils ================================================================
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

// ===== DOM ==================================================================
const backBtn        = document.getElementById("backBtn");
const editBtnTop     = document.getElementById("editBtnTop");

const avatarIniziali = document.getElementById("avatarIniziali");
const displayName    = document.getElementById("displayName");
const infoPhone      = document.getElementById("infoPhone");
const infoEmail      = document.getElementById("infoEmail");
const rowEmail       = document.getElementById("rowEmail");

const noteInput      = document.getElementById("noteInput");
const noteStatus     = document.getElementById("noteStatus");

const infoView       = document.getElementById("infoView");
const infoEdit       = document.getElementById("infoEdit");
const editNome       = document.getElementById("editNome");
const editTelefono   = document.getElementById("editTelefono");
const editEmail      = document.getElementById("editEmail");
const cancelInline   = document.getElementById("cancelInline");

const yearSelect     = document.getElementById("yearSelect");
const valAnno        = document.getElementById("valAnno");
const valTotale      = document.getElementById("valTotale");
const barAnno        = document.getElementById("barAnno");
const barTotale      = document.getElementById("barTotale");
const yearByTreatment= document.getElementById("yearByTreatment");

const historyList    = document.getElementById("historyList");
const showAllBtn     = document.getElementById("showAllHistory");

const sheet          = document.getElementById("historySheet");
const sheetBackdrop  = document.getElementById("sheetBackdrop");
const sheetClose     = document.getElementById("sheetClose");
const sheetYear      = document.getElementById("sheetYear");
const sheetHistory   = document.getElementById("sheetHistory");
const sheetPanel     = document.querySelector("#historySheet .sheet-panel");
const sheetHeader    = document.querySelector("#historySheet .sheet-header");
const sheetHandle    = document.querySelector("#historySheet .sheet-handle");
const sheetContent   = document.querySelector("#historySheet .sheet-content");

// ===== Stato =================================================================
let clienteId   = null;
let clienteData = null;
let allHistoryItems = [];
let allYears = [];
let allAppointmentsRaw = [];

// ===== Helpers ===============================================================
const debounce = (fn, ms=600) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };
function autosize(el){ if(!el) return; el.style.height='auto'; el.style.height = Math.max(el.scrollHeight, 92) + 'px'; }
function getClienteId(){ const url = new URLSearchParams(location.search); return url.get("id") || sessionStorage.getItem("clienteId") || null; }

// ===== Caricamento Cliente ===================================================
async function caricaCliente(){
  clienteId = getClienteId();
  if(!clienteId) return;

  try {
    // 🔹 Online → Firestore
    const ref  = doc(db,"clienti",clienteId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    clienteData = { id: clienteId, ...snap.data() };
    await putOne("clienti", clienteData); // aggiorna cache
  } catch (err) {
    console.warn("[cliente] offline, uso cache", err);
    clienteData = await getById("clienti", clienteId);
    if (!clienteData) return;
  }

  renderCliente();
  await caricaStoricoETotale();
  await popolaAnniERender();
}

function renderCliente(){
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

  btnRem.onclick = async (e)=>{
    e.preventDefault();
    await openWhatsAppReminder(clienteData, allAppointmentsRaw);
  };
}

// ===== Note ==================================================================
const saveNote = debounce(async ()=>{
  if(!clienteId) return;
  const newNote = noteInput.value.trim();
  if(newNote === (clienteData.note || "")) { noteStatus.textContent = ""; return; }
  noteStatus.textContent = "Salvataggio…";
  try{
    if (navigator.onLine) {
      await updateDoc(doc(db,"clienti",clienteId), { note: newNote });
    } else {
      await queueChange({ collezione:"clienti", op:"update", id: clienteId, payload: { note: newNote } });
    }
    clienteData.note = newNote;
    await putOne("clienti", clienteData); // aggiorna cache
    noteStatus.textContent = "Salvato";
    setTimeout(()=>{ noteStatus.textContent=""; }, 1200);
  }catch{
    noteStatus.textContent = "Errore salvataggio (offline)";
    clienteData.note = newNote;
    await putOne("clienti", clienteData);
    await queueChange({ collezione:"clienti", op:"update", id: clienteId, payload: { note: newNote } });
  }
}, 700);

noteInput.addEventListener('input', ()=>{ autosize(noteInput); saveNote(); });
window.addEventListener('resize', ()=>autosize(noteInput));

// ===== Storico & Totale ======================================================
async function caricaStoricoETotale(){
  historyList.innerHTML = "";
  allHistoryItems = [];
  allAppointmentsRaw = [];

  try {
    const q  = query(collection(db,"appuntamenti"), where("clienteId","==",clienteId));
    const qs = await getDocs(q);
    const docs = qs.docs.map(s=>({ id:s.id, ...s.data() }));
    await putMany("appuntamenti", docs); // aggiorna cache

    processStorico(docs);
  } catch (err) {
    console.warn("[cliente] offline storico:", err);
    const cached = await getAll("appuntamenti");
    processStorico(cached.filter(a => a.clienteId === clienteId));
  }
}

function processStorico(arr){
  let totaleSempre = 0;
  allHistoryItems = [];
  allAppointmentsRaw = arr;

  arr.forEach(a=>{
    const dt = safeDate(a.data || a.date || a.dateTime);
    const tot = getApptTotal(a);
    totaleSempre += tot;
    allHistoryItems.push({ dt, tratt: getApptNames(a) || "—", prezzo: tot });
  });

  allHistoryItems.sort((a,b)=>(b.dt?.getTime?.()||0)-(a.dt?.getTime?.()||0));

  renderHistoryList(historyList, allHistoryItems.slice(0,3));
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

// ===== Statistiche ===========================================================
async function popolaAnniERender(){
  try {
    const q  = query(collection(db,"appuntamenti"), where("clienteId","==",clienteId));
    const qs = await getDocs(q);
    const docs = qs.docs.map(s=>({ id:s.id, ...s.data() }));
    await putMany("appuntamenti", docs);

    renderStats(docs);
  } catch (err) {
    console.warn("[cliente] offline stats:", err);
    const cached = await getAll("appuntamenti");
    renderStats(cached.filter(a => a.clienteId === clienteId));
  }
}

async function aggiornaStatistiche(anno){
  const items = allAppointmentsRaw.filter(a=>{
    const dt = safeDate(a.data || a.date || a.dateTime);
    return dt && dt.getFullYear() === anno;
  });
  renderStats(items, anno);
}

function renderStats(arr, anno){
  let totAnno = 0;
  const perTratt = {};

  arr.forEach(a=>{
    const dt = safeDate(a.data || a.date || a.dateTime);
    if (anno && (!dt || dt.getFullYear()!==anno)) return;

    const apptTotal = getApptTotal(a);
    totAnno += apptTotal;

    if(Array.isArray(a.trattamenti)&&a.trattamenti.length){
      a.trattamenti.forEach(t=>{
        const nome = t?.nome || "Trattamento";
        const p    = toNumberSafe(t?.prezzo ?? t?.costo ?? t?.price);
        if(!perTratt[nome]) perTratt[nome] = {count:0,sum:0};
        perTratt[nome].count += 1;
        perTratt[nome].sum   += p;
      });
    }
  });

  if (anno) {
    valAnno.textContent = formatEuro(totAnno);
    const totalSempreNum = Number(valTotale.textContent.replace(/[^\d,.-]/g,"").replace(",","."));
    const perc = totalSempreNum>0 ? Math.max(0,Math.min(100,(totAnno/totalSempreNum)*100)) : 0;
    barAnno.style.width = `${perc.toFixed(0)}%`;

    const entries = Object.entries(perTratt).sort((a,b)=> b[1].count - a[1].count);
    yearByTreatment.innerHTML = entries.length
      ? entries.map(([nome,v]) =>
          `<li><div class="qta-nome">${v.count} ${nome}</div><div class="totale">${formatEuro(v.sum)}</div></li>`
        ).join("")
      : "<li>—</li>";
  } else {
    const anni = [...new Set(arr.map(a=>safeDate(a.data)?.getFullYear()).filter(Boolean))].sort((a,b)=>b-a);
    yearSelect.innerHTML = anni.map(y=>`<option value="${y}">${y}</option>`).join("");
    yearSelect.value = anni[0] || new Date().getFullYear();
    yearSelect.onchange = ()=>aggiornaStatistiche(Number(yearSelect.value));
    aggiornaStatistiche(Number(yearSelect.value));
  }
}

// ===== Edit inline ===========================================================
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

  const payload = {
    nome: editNome.value.trim(),
    telefono: editTelefono.value.trim(),
    email: editEmail.value.trim()
  };

  try {
    if (navigator.onLine) {
      await updateDoc(doc(db,"clienti",clienteId), payload);
    } else {
      await queueChange({ collezione:"clienti", op:"update", id: clienteId, payload });
    }
    clienteData = { ...clienteData, ...payload };
    await putOne("clienti", clienteData);
  } catch {
    clienteData = { ...clienteData, ...payload };
    await putOne("clienti", clienteData);
    await queueChange({ collezione:"clienti", op:"update", id: clienteId, payload });
  }
  setEditMode(false);
  renderCliente();
});

// ===== Back ==================================================================
backBtn.addEventListener("click", ()=>history.back());

// ===== Avvio =================================================================
caricaCliente();