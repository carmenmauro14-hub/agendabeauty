import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, getDocs, addDoc, updateDoc, getDoc, doc, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { abilitaSwipeVerticale } from "./swipe.js";

// ─── Firebase config ───────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyD0tDQQepdvj_oZPcQuUrEKpoNOd4zF0nE",
  authDomain: "agenda-carmenmauro.firebaseapp.com",
  projectId: "agenda-carmenmauro",
  storageBucket: "agenda-carmenmauro.appspot.com",
  messagingSenderId: "959324976221",
  appId: "1:959324976221:web:780c8e9195965cea0749b4"
};
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db  = getFirestore(app);

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
  if(d.toDate) return d.toDate();
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

// ===== Helpers =====
const debounce = (fn, ms=600) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };
function autosize(el){ if(!el) return; el.style.height='auto'; el.style.height = Math.max(el.scrollHeight, 92) + 'px'; }
function getClienteId(){ const url = new URLSearchParams(location.search); return url.get("id") || sessionStorage.getItem("clienteId") || null; }

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
  btnRem.onclick = (e)=>{ e.preventDefault(); alert("Promemoria WhatsApp: funzione in sviluppo."); };

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
  const q  = query(collection(db,"appuntamenti"), where("clienteId","==",clienteId));
  const qs = await getDocs(q);

  let totaleSempre = 0;

  qs.forEach(s=>{
    const a = s.data();
    const dt = safeDate(a.data || a.date || a.dateTime);
    const tot = getApptTotal(a);
    totaleSempre += tot;
    allHistoryItems.push({ dt, tratt: getApptNames(a) || "—", prezzo: tot });
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
  // Blocca lo scroll del body solo se tocchi/clicki FUORI dal pannello
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

  // Previeni scroll sotto al foglio
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

  // Parametri “tuning”
  const CLOSE_DISTANCE  = 120;      // px per chiudere trascinando piano
  const FLICK_DISTANCE  = 60;       // px min con flick
  const FLICK_VELOCITY  = 0.35;     // px/ms per chiusura con flick
  const LINEAR_LIMIT    = 80;       // primi px senza resistenza
  const RESISTANCE_GAIN = 0.3;      // percentuale oltre il limite

  let startY = 0, lastY = 0, dragging = false, lastT = 0, velocity = 0;

  const getY = (e) => e?.touches?.[0]?.clientY ?? e?.clientY ?? 0;

  const mapWithResistance = (dy) => {
    if (dy <= 0) return 0;
    if (dy <= LINEAR_LIMIT) return dy;
    // oltre il limite, applica “elasticità”
    return LINEAR_LIMIT + (dy - LINEAR_LIMIT) * RESISTANCE_GAIN;
  };

  const beginDrag = (e) => {
    startY = lastY = getY(e);
    lastT  = performance.now();
    velocity = 0;
    dragging = true;
    // durante il drag niente transizione
    sheetPanel.classList.add("dragging");
    sheetPanel.style.transition = "none";
    e.preventDefault(); // entriamo in drag, non scroll
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
    // piccolo rimbalzo per tornare su
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

    // ripristina eventuale transizione
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

  // Avvio drag SOLO da handle + header (contenuto scorre liberamente)
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

// ─── Lettura modalità (nuovo / modifica) ───────────────────────────
const params  = new URLSearchParams(location.search);
const editId  = params.get("edit");   // se presente, siamo in MODIFICA
let apptData  = null;                 // dati appuntamento in modifica (se edit)

// ─── Riferimenti DOM ───────────────────────────────────────────────
const wizardTitle        = document.getElementById("wizardTitle");
const step1              = document.getElementById("step1");
const step2              = document.getElementById("step2");
const step3              = document.getElementById("step3");

const btnToStep2         = document.getElementById("toStep2");
const btnBackToStep1     = document.getElementById("backToStep1");
const btnToStep3         = document.getElementById("toStep3");
const btnBackToStep2     = document.getElementById("backToStep2");
const btnSalva           = document.getElementById("salvaAppuntamento");
const btnCancel          = document.getElementById("cancelWizard");

const inpData            = document.getElementById("dataAppuntamento");
const inpOra             = document.getElementById("oraAppuntamento");
const wrapperTratt       = document.getElementById("trattamentiWrapper");

// Picker cliente
const clienteIdHidden    = document.getElementById("clienteId");
const clienteSelezionato = document.getElementById("clienteSelezionato");
const openRubrica        = document.getElementById("openRubrica");
const rubricaModal       = document.getElementById("rubricaModal");
const searchCliente      = document.getElementById("searchCliente");
const clientListPicker   = document.getElementById("clientListPicker");
const letterNavPicker    = document.getElementById("letterNavPicker");
const rubricaPanel       = document.querySelector("#rubricaModal .rubrica-container");
const rubricaGrabber     = document.getElementById("rubricaGrabber");
const btnRubricaClose    = document.getElementById("rubricaClose");

// Campo finto input che apre la rubrica
const openRubricaField   = document.getElementById("openRubricaField");
const pickerValue        = document.getElementById("pickerValue");
const pickerPlaceholder  = document.getElementById("pickerPlaceholder");

// ─── (Opzionale) modalità “pagina-modale”: overlay/sheet ───────────
const pageModal   = document.querySelector(".page-modal");
const sheetEl     = document.getElementById("wizardSheet");
const sheetHeader = document.querySelector(".sheet-header");
const sheetClose  = document.getElementById("sheetClose");

// ─── Helpers ───────────────────────────────────────────────────────
function setPageTitle(text) {
  if (wizardTitle) wizardTitle.textContent = text;
  document.title = text;
}
function showModal(m) { m.style.display = "flex"; }
function closeModal(m) { m.style.display = "none"; }

function updateNavState() {
  if (btnToStep2) btnToStep2.disabled = !clienteIdHidden.value;
  if (btnToStep3) btnToStep3.disabled = !(inpData.value && inpOra.value);
}
[inpData, inpOra].forEach(el => el?.addEventListener("input", updateNavState));

rubricaModal?.addEventListener("click", (e) => {
  if (e.target === rubricaModal) closeModal(rubricaModal);
});

function chiudiRubricaConAnimazioneVert() {
  if (!rubricaPanel) return;
  rubricaPanel.classList.add("swipe-out-down");
  rubricaPanel.addEventListener("transitionend", () => {
    rubricaPanel.classList.remove("swipe-out-down");
    closeModal(rubricaModal);
  }, { once: true });
}

// Swipe verticale (rubrica)
const rubricaHeader = document.querySelector("#rubricaModal .rubrica-header");
if (rubricaHeader) {
  abilitaSwipeVerticale(
    rubricaHeader,
    () => {},
    () => chiudiRubricaConAnimazioneVert(),
    true,
    45
  );
}

// ─── (Opzionale) Chiusura sheet ────────────────────────────────────
function chiudiSheet() {
  const doClose = () => document.getElementById("cancelWizard")?.click();
  if (!sheetEl) return doClose();
  sheetEl.classList.add("swipe-out-down");
  sheetEl.addEventListener("transitionend", doClose, { once: true });
}
sheetClose?.addEventListener("click", chiudiSheet);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") chiudiSheet(); });
pageModal?.addEventListener("click", (e) => { if (e.target === pageModal) chiudiSheet(); });
if (sheetHeader) { abilitaSwipeVerticale(sheetHeader, null, chiudiSheet, true, 45); }

// ─── Rubrica ───────────────────────────────────────────────────────
let clientiCache = null;

async function apriRubrica() {
  if (!clientiCache) {
    const snap = await getDocs(collection(db, "clienti"));
    clientiCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    clientiCache.sort((a,b) => (a.nome || "").localeCompare(b.nome || ""));
  }
  renderRubrica(clientiCache);
  if (searchCliente) searchCliente.value = "";
  if (letterNavPicker) letterNavPicker.style.display = "flex";
  showModal(rubricaModal);
}
openRubrica?.addEventListener("click", apriRubrica);
if (openRubricaField) {
  openRubricaField.addEventListener("click", apriRubrica);
  openRubricaField.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); apriRubrica(); }
  });
}

function renderRubrica(clienti) {
  const groups = {};
  clienti.forEach(c => {
    const L = (c.nome ? c.nome.charAt(0) : "#").toUpperCase();
    (groups[L] = groups[L] || []).push(c);
  });
  const letters = Object.keys(groups).sort();

  clientListPicker.innerHTML = "";
  letters.forEach(L => {
    const sec = document.createElement("li");
    sec.textContent = L;
    sec.className = "section";
    sec.id = "picker-letter-" + L;
    clientListPicker.appendChild(sec);

    groups[L].forEach(c => {
      const li = document.createElement("li");
      li.className = "item";
      li.textContent = c.nome || "(senza nome)";
      li.onclick = () => {
        clienteIdHidden.value = c.id;
        clienteSelezionato.textContent = c.nome || "(senza nome)";
        if (pickerValue) pickerValue.textContent = c.nome || "(senza nome)";
        if (pickerPlaceholder) pickerPlaceholder.style.display = "none";
        if (openRubricaField) openRubricaField.classList.remove("empty");
        closeModal(rubricaModal);
        updateNavState();
      };
      clientListPicker.appendChild(li);
    });
  });

  letterNavPicker.innerHTML = "";
  letters.forEach(L => {
    const el = document.createElement("span");
    el.textContent = L;
    el.onclick = () => {
      const target = document.getElementById("picker-letter-" + L);
      target && target.scrollIntoView({ behavior: "smooth" });
    };
    letterNavPicker.appendChild(el);
  });
}

searchCliente?.addEventListener("input", () => {
  const f = searchCliente.value.toLowerCase();
  if (letterNavPicker) letterNavPicker.style.display = f ? "none" : "flex";
  clientListPicker.querySelectorAll("li.item").forEach(li => {
    li.style.display = li.textContent.toLowerCase().includes(f) ? "" : "none";
  });
  clientListPicker.querySelectorAll("li.section").forEach(sec => {
    let el = sec.nextElementSibling;
    let visible = false;
    while (el && !el.classList.contains("section")) {
      if (el.style.display !== "none") { visible = true; break; }
      el = el.nextElementSibling;
    }
    sec.style.display = visible ? "" : "none";
  });
});

// ─── Trattamenti ───────────────────────────────────────────────────
const iconeDisponibili = [
  "makeup_sposa", "makeup", "microblading", "extension_ciglia",
  "laminazione_ciglia", "filo_arabo", "architettura_sopracciglia", "airbrush_sopracciglia"
];
function trovaIcona(nome) {
  const norm = (nome || "").toLowerCase().replace(/\s+/g, "_");
  for (const base of iconeDisponibili) {
    if (norm.includes(base)) return `icones_trattamenti/${base}.png`;
  }
  return "icone_uniformate_colore/setting.png";
}

/** Carica il listino “trattamenti” e pre-spunta quelli dell’appuntamento (edit). */
async function caricaTrattamenti(selectedMap = null) {
  wrapperTratt.innerHTML = "";
  try {
    const snap = await getDocs(collection(db, "trattamenti"));
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    lista.sort((a,b) => (a.nome || "").localeCompare(b.nome || ""));
    for (const t of lista) {
      const icona = t.icona || trovaIcona(t.nome);
      const prezzoListino = Number(t.prezzo) || 0;

      const row = document.createElement("div");
      row.classList.add("trattamento-row");

      const checked   = selectedMap ? selectedMap.has(t.nome) : false;
      const prezzoSel = selectedMap && selectedMap.has(t.nome)
                        ? Number(selectedMap.get(t.nome)) || 0
                        : prezzoListino;

      row.innerHTML = `
  <label>
    <input type="checkbox" class="trattamento-checkbox"
           ${checked ? "checked" : ""}
           data-nome="${t.nome}" data-prezzo="${prezzoListino}" data-icona="${icona}">
    <img src="${icona}" alt="${t.nome}" class="icona-trattamento">
    ${t.nome}
  </label>
  <input type="number" class="prezzo-input"
         placeholder="€${prezzoListino}"
         value="${prezzoSel}"
         min="0" step="0.01"
         inputmode="decimal">
`;
      wrapperTratt.appendChild(row);
    }
  } catch (e) {
    console.error("Errore caricamento trattamenti:", e);
    alert("Errore nel caricamento dei trattamenti.");
  }
}

// ─── Navigazione step ──────────────────────────────────────────────
btnToStep2?.addEventListener("click", () => {
  if (!clienteIdHidden.value) return alert("Seleziona un cliente");
  step1.style.display = "none";
  step2.style.display = "block";
});
btnBackToStep1?.addEventListener("click", () => {
  step2.style.display = "none";
  step1.style.display = "block";
});
btnToStep3?.addEventListener("click", () => {
  if (!(inpData.value && inpOra.value)) return alert("Inserisci data e ora");
  step2.style.display = "none";
  step3.style.display = "block";
});
btnBackToStep2?.addEventListener("click", () => {
  step3.style.display = "none";
  step2.style.display = "block";
});

// ─── Salvataggio appuntamento (Timestamp) ──────────────────────────
btnSalva?.addEventListener("click", async () => {
  const clienteId = clienteIdHidden.value;
  const dataISO   = inpData.value;            // "YYYY-MM-DD"
  const ora       = inpOra.value;             // "HH:mm"

  if (!clienteId) return alert("Seleziona un cliente");
  if (!(dataISO && ora)) return alert("Inserisci data e ora");

  const selected = [...document.querySelectorAll(".trattamento-checkbox:checked")];
  if (!selected.length) return alert("Seleziona almeno un trattamento");

  const trattamenti = selected.map(cb => {
    const row = cb.closest(".trattamento-row");
    const prezzoInput = row.querySelector(".prezzo-input");
    const prezzoVal = parseFloat(prezzoInput.value);
    return {
      nome: cb.dataset.nome,
      prezzo: Number.isFinite(prezzoVal) ? prezzoVal : 0,
      icona: cb.dataset.icona || trovaIcona(cb.dataset.nome)
    };
  });

  // ⬇️ SALVATAGGIO CONSIGLIATO
  // dataTs = mezzanotte locale del giorno selezionato
  const dateMidnight = new Date(dataISO + "T00:00:00");
  const dataTs = Timestamp.fromDate(dateMidnight);

  // opzionale: timestamp combinato (se in futuro ti serve)
  const [hh, mm] = ora.split(":").map(n => parseInt(n,10));
  const dateWithTime = new Date(dateMidnight);
  dateWithTime.setHours(hh || 0, mm || 0, 0, 0);
  const dateTime = Timestamp.fromDate(dateWithTime);

  try {
    if (editId) {
      await updateDoc(doc(db, "appuntamenti", editId), {
        clienteId,
        data: dataTs,          // ⬅️ ora è Timestamp (non più stringa)
        dataISO: dataISO,      // (opzionale) utile per debug/test
        ora,
        dateTime,
        trattamenti
      });
      alert("Appuntamento aggiornato!");
    } else {
      await addDoc(collection(db, "appuntamenti"), {
        clienteId,
        data: dataTs,          // ⬅️ Timestamp
        dataISO: dataISO,      // (opzionale)
        ora,
        dateTime,
        trattamenti
      });
      alert("Appuntamento salvato con successo!");
    }
    location.href = "calendario.html";
  } catch (err) {
    console.error("Errore salvataggio:", err);
    alert("Errore durante il salvataggio.");
  }
});

// ─── Avvio ─────────────────────────────────────────────────────────
(async function init() {
  if (editId) {
    setPageTitle("Modifica Appuntamento");
    try {
      const apptDoc = await getDoc(doc(db, "appuntamenti", editId));
      if (!apptDoc.exists()) {
        alert("Appuntamento non trovato.");
        setPageTitle("Nuovo Appuntamento");
        await caricaTrattamenti();
        updateNavState();
        return;
      }
      apptData = apptDoc.data();

      // 🔁 Retro-compatibilità: precompila data/ora da Timestamp o da stringa
      let iso = "";
      if (apptData.data && typeof apptData.data.toDate === "function") {
        const d = apptData.data.toDate();
        const y = d.getFullYear();
        const m = String(d.getMonth()+1).padStart(2,"0");
        const da= String(d.getDate()).padStart(2,"0");
        iso = `${y}-${m}-${da}`;
      } else if (typeof apptData.data === "string") {
        iso = apptData.data.slice(0,10);
      } else if (typeof apptData.dataISO === "string") {
        iso = apptData.dataISO.slice(0,10);
      }
      if (inpData) inpData.value = iso || "";

      // ora
      if (inpOra) inpOra.value = apptData.ora || "";

      // Precompila cliente
      if (apptData.clienteId) {
        clienteIdHidden.value = apptData.clienteId;
        try {
          const cliDoc = await getDoc(doc(db, "clienti", apptData.clienteId));
          const nomeCli = cliDoc.exists() ? (cliDoc.data().nome || "(senza nome)") : "(senza nome)";
          if (clienteSelezionato) clienteSelezionato.textContent = nomeCli;
          if (pickerValue) pickerValue.textContent = nomeCli;
          if (pickerPlaceholder) pickerPlaceholder.style.display = "none";
          if (openRubricaField) openRubricaField.classList.remove("empty");
        } catch {}
      }

      // Precompila trattamenti
      const selectedMap = new Map(
        (Array.isArray(apptData.trattamenti) ? apptData.trattamenti : [])
          .map(t => [t.nome, Number(t.prezzo) || 0])
      );
      await caricaTrattamenti(selectedMap);

    } catch (e) {
      console.error("Errore caricamento appuntamento:", e);
      alert("Errore nel caricamento dell'appuntamento. Procedo come 'Nuovo'.");
      setPageTitle("Nuovo Appuntamento");
      await caricaTrattamenti();
    }
  } else {
    setPageTitle("Nuovo Appuntamento");
    await caricaTrattamenti();
  }

  updateNavState();

  // Se arrivi con ?data=YYYY-MM-DD preimposta la data (solo in "Nuovo")
  const fromDate = new URLSearchParams(location.search).get("data");
  if (!editId && fromDate && inpData && !inpData.value) {
    inpData.value = fromDate;
    updateNavState();
  }

  // Mantieni stato picker se già valorizzato
  if (clienteIdHidden.value && pickerValue && openRubricaField) {
    openRubricaField.classList.remove("empty");
    if (pickerPlaceholder) pickerPlaceholder.style.display = "none";
  }

  // ─── Tasto ANNULLA ───────────────────────────────────────────────
  btnCancel?.addEventListener("click", () => {
    if (history.length > 1) {
      history.back();
    } else {
      location.href = "calendario.html";
    }
  });

  btnRubricaClose?.addEventListener("click", () => {
    chiudiRubricaConAnimazioneVert();
  });
})();