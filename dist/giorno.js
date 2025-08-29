// giorno.js — VISTA GIORNO (lista appuntamenti + promemoria WA)

import { initializeApp, getApps, getApp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, query, where, orderBy,
  getDocs, doc, getDoc, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { openWhatsAppReminder } from "./reminder-core.js";

// ── Firebase
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

// ── Stato
let dataCorrente;
let appuntamenti = [];
const clientiCache = {};
let openingWA = false; // anti-doppio-tap

// ── DOM
const contenuto      = document.getElementById("contenutoGiorno");
const mesiBar        = document.getElementById("mesiBar");
const miniCalendario = document.getElementById("miniCalendario");
const lblMese        = document.getElementById("meseCorrente");
const lblAnno        = document.getElementById("annoCorrente");
const btnOggi        = document.getElementById("btnTornaOggi");

// Modal (già in HTML)
const detModal     = document.getElementById("detModal");
const detSheet     = detModal.querySelector(".det-sheet");
const detCloseBtn  = document.getElementById("detCloseBtn");
const detTopbar    = document.getElementById("detTopbar");
const elTitolo     = document.getElementById("detTitolo");
const elData       = document.getElementById("detData");
const elOra        = document.getElementById("detOra");
const elTrattList  = document.getElementById("detTrattList");
const elTotale     = document.getElementById("detTotale");
const btnModifica  = document.getElementById("detModifica");
const btnPromem    = document.getElementById("detPromemoria");

// ── Utils
const fmtEuro = (n) => Number(n || 0).toLocaleString("it-IT", { style: "currency", currency: "EUR" });

function dayRangeFromISO(iso) {
  const start = new Date(iso + "T00:00:00");
  const end   = new Date(start); end.setDate(end.getDate()+1);
  return { start: Timestamp.fromDate(start), end: Timestamp.fromDate(end) };
}

function pickDate(d){
  if (d && typeof d.toDate === "function") {
    const dateObj = d.toDate();
    return { dateObj, iso: dateObj.toISOString().slice(0,10) };
  }
  if (typeof d === "string") {
    const dateObj = new Date(d.length === 10 ? d + "T00:00:00" : d);
    return { dateObj, iso: dateObj.toISOString().slice(0,10) };
  }
  if (d instanceof Date) {
    return { dateObj: d, iso: d.toISOString().slice(0,10) };
  }
  return { dateObj: null, iso: "" };
}

function trovaIcona(nome) {
  const icone = [
    "makeup_sposa","makeup","microblading","extension_ciglia",
    "laminazione_ciglia","filo_arabo","architettura_sopracciglia",
    "airbrush_sopracciglia","microblinding"
  ];
  const norm = (nome || "").toLowerCase().replace(/\s+/g, "_");
  for (const base of icone) if (norm.includes(base)) return `icones_trattamenti/${base}.png`;
  return "icone_uniformate_colore/setting.png";
}

function ensureMinHeight() {
  const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  const extra = 220;
  contenuto.style.minHeight = (vh - extra) + "px";
}

// Normalizza l’oggetto appuntamento per reminder-core
function apptForReminder(appt){
  return {
    data: appt.iso,                // stringa "YYYY-MM-DD"
    ora: appt.ora || "",
    trattamenti: appt.trattamenti || []
  };
}

// ── Modal
function openModal(appt){
  elTitolo.textContent = clientiCache[appt.clienteId]?.nome || appt.nome || "Cliente";
  elData.textContent   = appt.iso || "";
  elOra.textContent    = appt.ora || "";

  elTrattList.innerHTML = "";
  let tot = 0;
  (appt.trattamenti||[]).forEach(t => {
    const r = document.createElement("div");
    r.className = "det-tratt-item";
    const n = document.createElement("span");
    n.className = "det-tratt-nome";
    n.textContent = t?.nome || "-";
    const p = document.createElement("span");
    p.className = "det-tratt-prezzo";
    const val = Number(t?.prezzo ?? 0);
    p.textContent = fmtEuro(val);
    tot += val;
    r.appendChild(n); r.appendChild(p);
    elTrattList.appendChild(r);
  });
  elTotale.textContent = fmtEuro(tot);

  btnModifica.onclick = () => {
    if (appt.id) location.href = `nuovo-appuntamento.html?edit=${appt.id}`;
  };
  btnPromem.onclick = async () => {
    if (openingWA) return;
    openingWA = true;
    const cliente = clientiCache[appt.clienteId] || { nome: appt.nome || "", telefono: "" };
    try { await openWhatsAppReminder(cliente, [apptForReminder(appt)]); }
    finally { setTimeout(()=>openingWA=false, 1800); }
  };

  detModal.setAttribute("aria-hidden","false");
  detModal.style.display = "flex";
}

function closeModal(){
  detSheet.classList.add("swipe-out-down");
  const finish = () => {
    detSheet.removeEventListener("transitionend", finish);
    detModal.style.display = "none";
    detModal.setAttribute("aria-hidden","true");
    detSheet.classList.remove("swipe-out-down");
  };
  setTimeout(finish, 200);
  detSheet.addEventListener("transitionend", finish);
}

detCloseBtn.addEventListener("click", closeModal);
detModal.addEventListener("click", (e) => { if (e.target === detModal) closeModal(); });

// swipe-down sulla topbar del modal
(() => {
  let startY=0, dragging=false, lastY=0, lastT=0, velocity=0;
  const getY = (e)=> e?.touches?.[0]?.clientY ?? e?.clientY ?? 0;
  const begin = (e)=>{ dragging=true; startY=lastY=getY(e); lastT=performance.now(); velocity=0; detSheet.style.transition="none"; e.preventDefault(); };
  const move  = (e)=>{
    if(!dragging) return;
    const y=getY(e), now=performance.now(), dy=Math.max(0, y-startY);
    const dt=Math.max(1, now-lastT);
    velocity=(y-lastY)/dt; lastY=y; lastT=now;
    detSheet.style.transform=`translateY(${dy}px)`; e.preventDefault();
  };
  const end   = ()=>{
    if(!dragging) return; dragging=false; detSheet.style.transition="";
    detSheet.style.transform="";
    const dy = Math.max(0, lastY-startY);
    const shouldClose = dy>120 || (dy>60 && velocity>0.35);
    if(shouldClose) closeModal();
  };
  const opts={passive:false};
  detTopbar.addEventListener("touchstart", begin, opts);
  detTopbar.addEventListener("mousedown",  begin, opts);
  window.addEventListener("touchmove", move, opts);
  window.addEventListener("mousemove",  move, opts);
  window.addEventListener("touchend",  end);
  window.addEventListener("mouseup",   end);
  window.addEventListener("touchcancel", end);
})();

// ── Render lista
function renderLista(items){
  contenuto.innerHTML = "";

  const h2 = document.createElement("h2");
  h2.id = "titoloData";
  h2.style.textTransform = "capitalize";
  h2.textContent = dataCorrente.toLocaleDateString("it-IT", {
    weekday:"long", day:"numeric", month:"long", year:"numeric"
  });
  contenuto.appendChild(h2);

  if (!items.length) {
    const p = document.createElement("p");
    p.className = "no-appt";
    p.textContent = "Nessun appuntamento per questo giorno.";
    contenuto.appendChild(p);
    ensureMinHeight();
    return;
  }

  items.sort((A,B)=>(A.ora||"").localeCompare(B.ora||""));

  items.forEach(appt => {
    const row = document.createElement("div");
    row.className = "evento-giorno";

    const oraEl = document.createElement("span");
    oraEl.className = "eg-ora";
    oraEl.textContent = `Ore ${appt.ora || "--:--"}`;

    const iconeEl = document.createElement("span");
    iconeEl.className = "eg-icone";
    (appt.trattamenti||[]).slice(0,6).forEach(t=>{
      const img = document.createElement("img");
      img.src = t.icona || trovaIcona(t.nome);
      img.alt = t.nome || "";
      iconeEl.appendChild(img);
    });
    if ((appt.trattamenti||[]).length > 6) {
      const more = document.createElement("span");
      more.className = "eg-more";
      more.textContent = `+${appt.trattamenti.length-6}`;
      iconeEl.appendChild(more);
    }

    const nomeEl = document.createElement("span");
    nomeEl.className = "eg-nome";
    nomeEl.textContent = clientiCache[appt.clienteId]?.nome || appt.nome || "Cliente";

    // 🔔 Campanella promemoria inline
    const promemEl = document.createElement("button");
    promemEl.className = "btn-pill promem-ico";
    promemEl.setAttribute("aria-label", "Promemoria WhatsApp");
    promemEl.innerHTML = "🔔";
    promemEl.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (openingWA) return;
      openingWA = true;
      const cliente = clientiCache[appt.clienteId] || { nome: appt.nome || "", telefono: "" };
      try { await openWhatsAppReminder(cliente, [apptForReminder(appt)]); }
      finally { setTimeout(()=>openingWA=false, 1800); }
    });

    row.appendChild(oraEl);
    row.appendChild(iconeEl);
    row.appendChild(nomeEl);
    row.appendChild(promemEl);

    contenuto.appendChild(row);
    row.addEventListener("click", ()=> openModal(appt));
  });

  ensureMinHeight();
}

// ── Query Firestore (data = Timestamp)
async function caricaAppuntamentiGiornoISO(iso){
  appuntamenti = [];
  const { start, end } = dayRangeFromISO(iso);
  const qRef = query(
    collection(db,"appuntamenti"),
    where("data", ">=", start),
    where("data", "<",  end),
    orderBy("data","asc")
  );
  const snap = await getDocs(qRef);

  for (const d of snap.docs) {
    const a = d.data();
    const { iso: isoApp } = pickDate(a.data);

    const cid = a.clienteId || a.cliente || "";
    if (cid && !clientiCache[cid]) {
      const csnap = await getDoc(doc(db,"clienti",cid));
      if (csnap.exists()) {
        const c = csnap.data();
        clientiCache[cid] = {
          nome: c?.nome || "",
          telefono: (c?.telefono || "").toString().trim(),
          email: (c?.email || "").toString().trim()
        };
      } else {
        clientiCache[cid] = { nome:"", telefono:"", email:"" };
      }
    }

    appuntamenti.push({
      id: d.id,
      clienteId: cid,
      iso: isoApp,
      ora: a.ora || "",
      trattamenti: Array.isArray(a.trattamenti) ? a.trattamenti : []
    });
  }

  renderLista(appuntamenti);
}

// ── Header + navigazione
function aggiornaHeader(){
  lblMese.textContent = dataCorrente.toLocaleDateString("it-IT",{month:"long"});
  lblAnno.textContent = dataCorrente.getFullYear();
  btnOggi.textContent = (new Date()).getDate();
}

function vaiAData(dateObj, anim){
  dataCorrente = dateObj;
  const iso = dateObj.toISOString().slice(0,10);
  history.replaceState(null, "", `giorno.html?data=${iso}`);
  aggiornaHeader();

  if (anim) {
    contenuto.classList.add(anim);
    setTimeout(()=>contenuto.classList.remove(anim), 300);
  }

  renderLista([]);
  caricaAppuntamentiGiornoISO(iso);
}

// ── Init
(function init(){
  const params = new URLSearchParams(location.search);
  const dataParam = params.get("data");
  const oggi = new Date();
  dataCorrente = dataParam ? new Date(dataParam) : oggi;

  aggiornaHeader();
  ensureMinHeight();

  renderLista([]);
  const iso = (dataParam ? dataParam : oggi.toISOString().slice(0,10));
  caricaAppuntamentiGiornoISO(iso);

  document.getElementById("aggiungiAppuntamentoBtn").addEventListener("click", ()=>{
    const d = dataCorrente.toISOString().slice(0,10);
    location.href = `nuovo-appuntamento.html?data=${d}`;
  });
  btnOggi.addEventListener("click", ()=>{
    const isoOggi = new Date().toISOString().slice(0,10);
    location.href = `giorno.html?data=${isoOggi}`;
  });

  document.getElementById("meseSwitch").addEventListener("click", ()=>{
    const vis = mesiBar.classList.contains("visibile");
    mesiBar.classList.toggle("visibile", !vis);
    mesiBar.style.display = vis ? "none" : "flex";
    miniCalendario.style.display = vis ? "none" : "block";
  });

  let startX=0, swiping=false;
  contenuto.addEventListener("touchstart",(e)=>{ if(e.touches.length===1){ swiping=true; startX=e.touches[0].clientX; }}, {passive:true});
  contenuto.addEventListener("touchend",(e)=>{
    if(!swiping) return; swiping=false;
    const endX = (e.changedTouches && e.changedTouches[0]?.clientX) || startX;
    const dx = endX - startX;
    if (dx < -50){ const d=new Date(dataCorrente); d.setDate(d.getDate()+1); vaiAData(d,"slide-left"); }
    if (dx >  50){ const d=new Date(dataCorrente); d.setDate(d.getDate()-1); vaiAData(d,"slide-right"); }
  }, {passive:true});
})();