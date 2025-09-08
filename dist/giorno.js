// giorno.js — VISTA GIORNO (lista appuntamenti + promemoria WA + mini-calendario on-demand)

// 🔁 Usa l'istanza già creata in auth.js
import { app } from "./auth.js";
import {
  getFirestore, collection, query, where, orderBy,
  getDocs, doc, getDoc, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { openWhatsAppReminder } from "./reminder-core.js";

const db  = getFirestore(app);

// ── Stato
let dataCorrente;
let appuntamenti = [];
const clientiCache = {};
let openingWA = false; // anti-doppio-tap

// mini-cal
let meseMiniCorrente = null;
let annoMiniCorrente = null;

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
    "airbrush_sopracciglia","laser"
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
    data: appt.iso,
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

    const nomeEl = document.createElement("span");
    nomeEl.className = "eg-nome";
    nomeEl.textContent = clientiCache[appt.clienteId]?.nome || appt.nome || "Cliente";

    // 🔔 pulsante inline
    const promemEl = document.createElement("button");
    promemEl.className = "btn-pill promem-ico";
    promemEl.innerHTML = '<i class="fa-solid fa-bell"></i>';
    promemEl.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (openingWA) return;
      openingWA = true;
      const cliente = clientiCache[appt.clienteId] || { nome: appt.nome || "", telefono: "" };
      try { await openWhatsAppReminder(cliente, [apptForReminder(appt)]); }
      finally { setTimeout(() => (openingWA = false), 1800); }
    });

    row.appendChild(oraEl);
    row.appendChild(iconeEl);
    row.appendChild(nomeEl);
    row.appendChild(promemEl);

    // 🔑 questo mancava nella tua versione nuova
    row.addEventListener("click", ()=> openModal(appt));

    contenuto.appendChild(row);
  });

  ensureMinHeight();
}

// ── Query Firestore
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
      clientiCache[cid] = csnap.exists() ? csnap.data() : { nome:"", telefono:"", email:"" };
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

// ── Init
(function init(){
  const params = new URLSearchParams(location.search);
  const dataParam = params.get("data");
  const oggi = new Date();
  dataCorrente = dataParam ? new Date(dataParam) : oggi;

  renderLista([]);
  caricaAppuntamentiGiornoISO(dataCorrente.toISOString().slice(0,10));

  document.getElementById("aggiungiAppuntamentoBtn").addEventListener("click", ()=>{
    const d = dataCorrente.toISOString().slice(0,10);
    location.href = `nuovo-appuntamento.html?data=${d}`;
  });
})();