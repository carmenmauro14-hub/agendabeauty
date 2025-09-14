// giorno.js — VISTA GIORNO (lista appuntamenti + promemoria WA + mini-calendario on-demand)
// Coerente con: auth.js (Firestore con persistentLocalCache) + storage.js (IndexedDB) + sw.js (cache statici)

import { db } from "./auth.js";
import {
  collection, query, where, orderBy, getDocs,
  doc, Timestamp, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAll, deleteById, queueChange } from "./storage.js";
import { openWhatsAppReminder } from "./reminder-core.js";

/* ──────────────────────────────────────────────────────────────
   STATO
   ────────────────────────────────────────────────────────────── */
let dataCorrente;              // Date dell’area visualizzata
let appuntamenti = [];         // appuntamenti del giorno corrente
const clientiCache = {};       // { clienteId: {nome, telefono, email} }
let openingWA = false;         // anti-doppio-tap promemoria

let meseMiniCorrente = null;   // mini-calendario stato
let annoMiniCorrente = null;

/* ──────────────────────────────────────────────────────────────
   DOM
   ────────────────────────────────────────────────────────────── */
const contenuto      = document.getElementById("contenutoGiorno");
const mesiBar        = document.getElementById("mesiBar");
const miniCalendario = document.getElementById("miniCalendario");
const lblMese        = document.getElementById("meseCorrente");
const lblAnno        = document.getElementById("annoCorrente");
const btnOggi        = document.getElementById("btnTornaOggi");
const btnAggiungi    = document.getElementById("aggiungiAppuntamentoBtn");

/* ──────────────────────────────────────────────────────────────
   UTILS
   ────────────────────────────────────────────────────────────── */
const fmtEuro = (n) => Number(n || 0).toLocaleString("it-IT", { style: "currency", currency: "EUR" });

function dayRangeFromISO(iso) {
  const start = new Date(iso + "T00:00:00");
  const end   = new Date(start); end.setDate(end.getDate() + 1);
  return { start: Timestamp.fromDate(start), end: Timestamp.fromDate(end) };
}

function pickDate(d) {
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
  if (contenuto) contenuto.style.minHeight = (vh - extra) + "px";
}

function apptForReminder(appt){
  return { data: appt.iso, ora: appt.ora || "", trattamenti: appt.trattamenti || [] };
}

/* ──────────────────────────────────────────────────────────────
   LISTA GIORNO
   ────────────────────────────────────────────────────────────── */
function renderLista(items){
  if (!contenuto) return;
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

  const frag = document.createDocumentFragment();

  items.forEach(appt => {
    const row = document.createElement("div");
    row.className = "evento-giorno";
    row.dataset.id = appt.id || "";
    row.tabIndex = 0;
    row.setAttribute("role","button");

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

    const promemEl = document.createElement("button");
    promemEl.className = "btn-pill promem-ico";
    promemEl.innerHTML = '<i class="fa-solid fa-bell"></i>';
    promemEl.title = "Promemoria WhatsApp";
    promemEl.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (openingWA) return;
      openingWA = true;
      const cliente = clientiCache[appt.clienteId] || { nome: appt.nome || "", telefono: "" };
      try { await openWhatsAppReminder(cliente, [apptForReminder(appt)]); }
      finally { setTimeout(() => (openingWA = false), 1600); }
    });

    row.appendChild(oraEl);
    row.appendChild(iconeEl);
    row.appendChild(nomeEl);
    row.appendChild(promemEl);

    row.addEventListener("click", () => openModal(appt));
    row.addEventListener("keydown", (e)=>{
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      openModal(appt);
    });

    frag.appendChild(row);
  });

  contenuto.appendChild(frag);
  ensureMinHeight();
}

/* ──────────────────────────────────────────────────────────────
   DATA: IndexedDB (offline) + Firestore (online refresh)
   ────────────────────────────────────────────────────────────── */
async function caricaAppuntamentiGiornoISO(iso) {
  appuntamenti = [];

  try {
    const cachedAppts = await getAll("appuntamenti");
    const todays = cachedAppts.filter(a => (a.dataISO || "").slice(0,10) === iso);

    const cachedClients = await getAll("clienti");
    cachedClients.forEach(c => {
      clientiCache[c.id] = clientiCache[c.id] || {
        nome: c?.nome || "",
        telefono: (c?.telefono || "").toString().trim(),
        email: (c?.email || "").toString().trim()
      };
    });

    appuntamenti = todays.map(a => ({
      id: a.id,
      clienteId: a.clienteId || a.cliente || "",
      iso: a.dataISO || iso,
      ora: a.ora || "",
      trattamenti: Array.isArray(a.trattamenti) ? a.trattamenti : []
    }));

    renderLista(appuntamenti);
  } catch (err) {
    console.warn("[giorno] errore lettura cache:", err);
    renderLista([]);
  }

  // 🔹 Aggiorna solo se online (non obbligatorio per aprire offline)
  if (navigator.onLine) {
    try {
      const { start, end } = dayRangeFromISO(iso);
      const qRef = query(
        collection(db,"appuntamenti"),
        where("data", ">=", start),
        where("data", "<",  end),
        orderBy("data","asc")
      );
      const snap = await getDocs(qRef);

      const appts = snap.docs.map(d => {
        const raw = d.data();
        const { iso: isoApp } = pickDate(raw.data);
        return {
          id: d.id,
          clienteId: raw.clienteId || raw.cliente || "",
          iso: isoApp,
          ora: raw.ora || "",
          trattamenti: Array.isArray(raw.trattamenti) ? raw.trattamenti : [],
          dataISO: isoApp
        };
      });

      appuntamenti = appts;
      renderLista(appuntamenti);
    } catch (err) {
      console.warn("[giorno] Firestore fallito:", err);
    }
  }
}

/* ──────────────────────────────────────────────────────────────
   HEADER / NAVIGAZIONE
   ────────────────────────────────────────────────────────────── */
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

  if (anim && contenuto) {
    contenuto.classList.add(anim);
    setTimeout(()=>contenuto.classList.remove(anim), 280);
  }

  renderLista([]);
  caricaAppuntamentiGiornoISO(iso);
}

/* ──────────────────────────────────────────────────────────────
   INIT
   ────────────────────────────────────────────────────────────── */
(function init(){
  const params   = new URLSearchParams(location.search);
  const dataParam= params.get("data");
  const oggi     = new Date();
  dataCorrente   = dataParam ? new Date(dataParam) : oggi;

  aggiornaHeader();
  ensureMinHeight();

  renderLista([]);
  const iso = (dataParam ? dataParam : oggi.toISOString().slice(0,10));
  caricaAppuntamentiGiornoISO(iso);

  btnAggiungi?.addEventListener("click", ()=>{
    const d = dataCorrente.toISOString().slice(0,10);
    location.href = `nuovo-appuntamento.html?data=${d}`;
  });

  btnOggi?.addEventListener("click", ()=>{
    const isoOggi = new Date().toISOString().slice(0,10);
    location.href = `giorno.html?data=${isoOggi}`;
  });
})();