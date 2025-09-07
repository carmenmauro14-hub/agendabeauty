// giorno.js — VISTA GIORNO (lista appuntamenti + promemoria WA + mini-calendario on-demand)

// 🔁 Usa l'istanza già creata in auth.js
import { db } from "./auth.js";
import {
  collection, query, where, orderBy,
  getDocs, doc, getDoc, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { getAll, putMany } from "./storage.js";

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

// ── Cache clienti da IndexedDB
async function caricaClientiCache(){
  const clienti = await getAll("clienti");
  clienti.forEach(c => {
    clientiCache[c.id] = {
      nome: c.nome || "",
      telefono: c.telefono || "",
      email: c.email || ""
    };
  });
}

// ── Query Firestore con fallback cache
async function caricaAppuntamentiGiornoISO(iso){
  appuntamenti = [];
  const { start, end } = dayRangeFromISO(iso);

  try {
    // 🔹 ONLINE → Firestore
    const qRef = query(
      collection(db,"appuntamenti"),
      where("data", ">=", start),
      where("data", "<",  end),
      orderBy("data","asc")
    );
    const snap = await getDocs(qRef);

    const docs = [];
    for (const d of snap.docs) {
      const a = d.data();
      const { iso: isoApp } = pickDate(a.data);
      docs.push({ id: d.id, ...a, iso: isoApp });
    }
    // salva in cache
    await putMany("appuntamenti", docs);

    appuntamenti = docs;
  } catch (err) {
    console.warn("[giorno] Offline, carico dalla cache:", err);
    const cached = await getAll("appuntamenti");
    appuntamenti = cached.filter(a => a.iso === iso);
  }

  renderLista(appuntamenti);
}

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

    row.appendChild(oraEl);
    row.appendChild(iconeEl);
    row.appendChild(nomeEl);

    contenuto.appendChild(row);
    row.addEventListener("click", ()=> openModal(appt));
  });

  ensureMinHeight();
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

  renderLista([]);
  caricaAppuntamentiGiornoISO(iso);
}

// ── Init
(async function init(){
  await caricaClientiCache();

  const params = new URLSearchParams(location.search);
  const dataParam = params.get("data");
  const oggi = new Date();
  dataCorrente = dataParam ? new Date(dataParam) : oggi;

  aggiornaHeader();
  ensureMinHeight();

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
})();