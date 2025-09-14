// giorno.js — VISTA GIORNO (lista appuntamenti + promemoria WA + mini-calendario on-demand)
// Coerente con: auth.js (Firestore con persistentLocalCache) + storage.js (IndexedDB) + sw.js (cache statici)
import { db } from "./auth.js";
import {
  collection, query, where, orderBy, getDocs,
  doc, getDoc, Timestamp, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAll, getById, putOne, deleteById, queueChange } from "./storage.js";
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
   MODALE DETTAGLIO
   ────────────────────────────────────────────────────────────── */
const detModal     = document.getElementById("detModal");
const detSheet     = detModal?.querySelector?.(".det-sheet");
const detCloseBtn  = document.getElementById("detCloseBtn");
const detTopbar    = document.getElementById("detTopbar");
const elTitolo     = document.getElementById("detTitolo");
const elData       = document.getElementById("detData");
const elOra        = document.getElementById("detOra");
const elTrattList  = document.getElementById("detTrattList");
const elTotale     = document.getElementById("detTotale");
const btnModifica  = document.getElementById("detModifica");
const btnPromem    = document.getElementById("detPromemoria");

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
  // Normalizza Firestore Timestamp / ISO string / Date → {dateObj, iso}
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
  const extra = 220; // header/footer
  if (contenuto) contenuto.style.minHeight = (vh - extra) + "px";
}

function apptForReminder(appt){
  return { data: appt.iso, ora: appt.ora || "", trattamenti: appt.trattamenti || [] };
}

/* ──────────────────────────────────────────────────────────────
   MINI CALENDARIO
   ────────────────────────────────────────────────────────────── */
function generaBarraMesiCompleta() {
  if (!mesiBar) return;
  mesiBar.innerHTML = "";
  let currentSpan = null;

  for (let anno = 2020; anno <= 2050; anno++) {
    const sep = document.createElement("span");
    sep.textContent = anno;
    sep.classList.add("separatore-anno");
    mesiBar.appendChild(sep);

    for (let mese = 0; mese < 12; mese++) {
      const span = document.createElement("span");
      span.textContent = new Date(anno, mese).toLocaleDateString("it-IT", { month: "short" });
      span.dataset.mese = mese;
      span.dataset.anno = anno;

      if (dataCorrente && mese === dataCorrente.getMonth() && anno === dataCorrente.getFullYear()) {
        span.classList.add("attivo");
        currentSpan = span;
      }

      span.addEventListener("click", () => {
        renderMiniCalendario(anno, mese);
        mesiBar.querySelectorAll("span").forEach(s => s.classList.remove("attivo"));
        span.classList.add("attivo");
      });

      mesiBar.appendChild(span);
    }
  }

  setTimeout(() => { currentSpan?.scrollIntoView({ behavior: "smooth", inline: "center" }); }, 40);
}

function renderMiniCalendario(anno, mese) {
  if (!miniCalendario) return;
  miniCalendario.innerHTML = "";
  meseMiniCorrente = mese;
  annoMiniCorrente = anno;

  const oggiStr = new Date().toISOString().slice(0,10);
  const giornoVisualizzato = dataCorrente?.toISOString().slice(0,10);

  const primaGiorno  = new Date(anno, mese, 1).getDay(); // 0=Dom
  const ultimoGiorno = new Date(anno, mese+1, 0).getDate();

  const giorniSettimana = ["L","M","M","G","V","S","D"];
  const table = document.createElement("table");

  const thead = document.createElement("thead");
  const trHead = document.createElement("tr");
  giorniSettimana.forEach(g => {
    const th = document.createElement("th");
    th.textContent = g;
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  let tr = document.createElement("tr");
  let dayCount = 0;

  const offset = (primaGiorno + 6) % 7; // lunedì=0
  for (let i=0; i<offset; i++) {
    tr.appendChild(document.createElement("td"));
    dayCount++;
  }

  for (let giorno = 1; giorno <= ultimoGiorno; giorno++) {
    if (dayCount % 7 === 0) {
      tbody.appendChild(tr);
      tr = document.createElement("tr");
    }
    const td = document.createElement("td");
    const dataStr = `${anno}-${String(mese+1).padStart(2,"0")}-${String(giorno).padStart(2,"0")}`;
    td.textContent = String(giorno);

    if (dataStr === oggiStr) td.classList.add("oggi");
    if (dataStr === giornoVisualizzato) td.classList.add("selezionato");

    td.addEventListener("click", () => {
      const d = new Date(dataStr);
      vaiAData(d, "");
      if (miniCalendario.style.display === "block") {
        renderMiniCalendario(d.getFullYear(), d.getMonth());
      }
    });

    tr.appendChild(td);
    dayCount++;
  }
  tbody.appendChild(tr);
  table.appendChild(tbody);
  miniCalendario.appendChild(table);

  // Swipe locale (solo nel riquadro mini-cal)
  enableLocalSwipe(miniCalendario,
    () => { const next = new Date(anno, mese+1, 1); renderMiniCalendario(next.getFullYear(), next.getMonth()); },
    () => { const prev = new Date(anno, mese-1, 1); renderMiniCalendario(prev.getFullYear(), prev.getMonth()); }
  );
}

function enableLocalSwipe(el, onLeft, onRight) {
  let startX = 0, tracking = false;
  const TH = 40;
  el.addEventListener("touchstart", (e)=>{
    if (e.touches.length !== 1) return;
    tracking = true; startX = e.touches[0].clientX;
  }, {passive:true});
  el.addEventListener("touchend", (e)=>{
    if (!tracking) return; tracking = false;
    const endX = (e.changedTouches && e.changedTouches[0]?.clientX) || startX;
    const dx = endX - startX;
    if (dx < -TH) onLeft?.();
    if (dx >  TH) onRight?.();
  }, {passive:true});
}

/* ──────────────────────────────────────────────────────────────
   MODALE DETTAGLIO
   ────────────────────────────────────────────────────────────── */
function openModal(appt){
  try {
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

    btnModifica.onclick = () => { if (appt.id) location.href = `nuovo-appuntamento.html?edit=${appt.id}`; };
    btnPromem.onclick = async () => {
      if (openingWA) return;
      openingWA = true;
      const cliente = clientiCache[appt.clienteId] || { nome: appt.nome || "", telefono: "" };
      try { await openWhatsAppReminder(cliente, [apptForReminder(appt)]); }
      finally { setTimeout(()=>openingWA=false, 1600); }
    };

    // pulsante elimina (creato una sola volta)
    let btnElimina = document.getElementById("detElimina");
    if (!btnElimina) {
      btnElimina = document.createElement("button");
      btnElimina.id = "detElimina";
      btnElimina.className = "btn-danger";
      btnElimina.style.marginTop = "12px";
      btnElimina.innerHTML = '<i class="fa-solid fa-trash"></i> Elimina Appuntamento';
      btnPromem?.insertAdjacentElement("afterend", btnElimina);
    }
    btnElimina.onclick = async () => {
      const conferma = confirm("Vuoi davvero eliminare questo appuntamento?");
      if (!conferma) return;
      try {
        if (navigator.onLine) {
          await deleteDoc(doc(db, "appuntamenti", appt.id));
        } else {
          await queueChange({ collezione: "appuntamenti", op: "delete", id: appt.id, payload: { id: appt.id } });
        }
        await deleteById("appuntamenti", appt.id);
        appuntamenti = appuntamenti.filter(a => a.id !== appt.id);
        closeModal();
        renderLista(appuntamenti);
      } catch (err) {
        console.error("[giorno] errore eliminazione appuntamento:", err);
        alert("Errore durante l'eliminazione.");
      }
    };

    // mostra modale
    detModal.setAttribute("aria-hidden","false");
    detModal.style.display = "flex";
  } catch (err) {
    console.error("[openModal] errore:", err, appt);
  }
}

function closeModal(){
  if (!detSheet) { detModal.style.display = "none"; return; }
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

detCloseBtn?.addEventListener("click", closeModal);
// chiusura cliccando fuori
detModal?.addEventListener("click", (e) => { if (e.target === detModal) closeModal(); });

// swipe-down sulla topbar del modal
(()=>{
  if (!detTopbar || !detSheet) return;
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

    // Accessibilità / iOS click
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
    promemEl.setAttribute("aria-label", "Promemoria WhatsApp");
    promemEl.title = "Promemoria WhatsApp";
    promemEl.innerHTML = '<i class="fa-solid fa-bell"></i>';

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

    // click/Enter/Space → apri dettagli
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
   DATA: Firestore (online/cache) + IndexedDB (offline duro)
   ────────────────────────────────────────────────────────────── */
async function caricaAppuntamentiGiornoISO(iso) {
  appuntamenti = [];

  // 1️⃣ Carica subito dalla cache
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

// 2️⃣ Poi prova Firestore per aggiornare
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

    const appts = [];
    for (const d of snap.docs) {
      const raw = d.data();
      const { iso: isoApp } = pickDate(raw.data);
      const cid = raw.clienteId || raw.cliente || "";

      // aggiorna clienti ...
      // (resto del codice invariato)

      const appt = {
        id: d.id,
        clienteId: cid,
        iso: isoApp,
        ora: raw.ora || "",
        trattamenti: Array.isArray(raw.trattamenti) ? raw.trattamenti : [],
        dataISO: isoApp,     // 👈 normalizzazione coerente
        data: raw.data       // 👈 mantieni anche il campo originale
      };

      appts.push(appt);

      // aggiorna cache locale subito
      await putOne("appuntamenti", appt);
    }

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
  if (!lblMese || !lblAnno || !btnOggi) return;
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

  if (miniCalendario && miniCalendario.style.display === "block") {
    renderMiniCalendario(dataCorrente.getFullYear(), dataCorrente.getMonth());
  }
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

  // Aggiungi appuntamento
  btnAggiungi?.addEventListener("click", ()=>{
    const d = dataCorrente.toISOString().slice(0,10);
    location.href = `nuovo-appuntamento.html?data=${d}`;
  });

  // Torna oggi
  btnOggi?.addEventListener("click", ()=>{
    const isoOggi = new Date().toISOString().slice(0,10);
    location.href = `giorno.html?data=${isoOggi}`;
  });

  // Toggle mini-cal
  document.getElementById("meseSwitch")?.addEventListener("click", ()=>{
    if (!mesiBar || !miniCalendario) return;
    const vis = mesiBar.classList.contains("visibile");
    if (vis) {
      mesiBar.classList.remove("visibile");
      mesiBar.style.display = "none";
      miniCalendario.style.display = "none";
    } else {
      mesiBar.classList.add("visibile");
      mesiBar.style.display = "flex";
      miniCalendario.style.display = "block";

      if (!mesiBar.dataset.built) {
        generaBarraMesiCompleta();
        mesiBar.dataset.built = "1";
      }
      renderMiniCalendario(dataCorrente.getFullYear(), dataCorrente.getMonth());
      const attivo = mesiBar.querySelector(".attivo");
      if (attivo) attivo.scrollIntoView({ behavior:"smooth", inline:"center" });
    }
  });

  // Swipe tra giorni nella lista (globale sulla lista)
  if (contenuto) {
    let startX=0, swiping=false;
    contenuto.addEventListener("touchstart",(e)=>{ if(e.touches.length===1){ swiping=true; startX=e.touches[0].clientX; }}, {passive:true});
    contenuto.addEventListener("touchend",(e)=>{
      if(!swiping) return; swiping=false;
      const endX = (e.changedTouches && e.changedTouches[0]?.clientX) || startX;
      const dx = endX - startX;
      if (dx < -50){ const d=new Date(dataCorrente); d.setDate(d.getDate()+1); vaiAData(d,"slide-left"); }
      if (dx >  50){ const d=new Date(dataCorrente); d.setDate(d.getDate()-1); vaiAData(d,"slide-right"); }
    }, {passive:true});
  }
})();