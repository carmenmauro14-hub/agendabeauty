import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { abilitaSwipe } from "./swipe.js";

let meseMiniCorrente;
let annoMiniCorrente;
let dataCorrente;

document.addEventListener("DOMContentLoaded", async () => {
  const firebaseConfig = {
    apiKey: "AIzaSyD0tDQQepdvj_oZPcQuUrEKpoNOd4zF0nE",
    authDomain: "agenda-carmenmauro.firebaseapp.com",
    projectId: "agenda-carmenmauro",
    storageBucket: "agenda-carmenmauro.appspot.com",
    messagingSenderId: "959324976221",
    appId: "1:959324976221:web:780c8e9195965cea0749b4"
  };
  const app = initializeApp(firebaseConfig);
  const db  = getFirestore(app);

  const params = new URLSearchParams(window.location.search);
  const dataParam = params.get("data");
  const oggi = new Date();
  dataCorrente = dataParam ? new Date(dataParam) : oggi;
  const dataParamFinale = dataParam || oggi.toISOString().split("T")[0];

  const contenuto      = document.getElementById("contenutoGiorno");
  const mesiBar        = document.getElementById("mesiBar");
  const miniCalendario = document.getElementById("miniCalendario");

  document.getElementById("meseCorrente").textContent = dataCorrente.toLocaleDateString('it-IT', { month: 'long' });
  document.getElementById("annoCorrente").textContent = dataCorrente.getFullYear();
  document.getElementById("btnTornaOggi").textContent = oggi.getDate();

  document.getElementById("btnTornaOggi").addEventListener("click", () => {
    const oggiStr = oggi.toISOString().split("T")[0];
    window.location.href = `giorno.html?data=${oggiStr}`;
  });

  document.getElementById("aggiungiAppuntamentoBtn").addEventListener("click", () => {
    window.location.href = `nuovo-appuntamento.html?data=${dataParamFinale}`;
  });

  // titolo giorno
  const titolo = document.createElement("h2");
  titolo.id = "titoloData";
  titolo.textContent = dataCorrente.toLocaleDateString("it-IT", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });
  titolo.style.textTransform = "capitalize";
  contenuto.appendChild(titolo);

  // fallback icone
  function trovaIcona(nome) {
    const iconeDisponibili = [
      "makeup_sposa","makeup","microblinding","microblading","extension_ciglia",
      "laminazione_ciglia","filo_arabo","architettura_sopracciglia","airbrush_sopracciglia"
    ];
    const norm = (nome || "").toLowerCase().replace(/\s+/g, "_");
    for (const base of iconeDisponibili) {
      if (norm.includes(base)) return `icones_trattamenti/${base}.png`;
    }
    return "icone_uniformate_colore/setting.png";
  }

  // ——— MODALE DETTAGLIO ———
  const modal      = document.getElementById("dettaglioModal");
  const panel      = modal?.querySelector(".det-panel");
  const btnClose   = document.getElementById("detClose");
  const detTitolo  = document.getElementById("detNomeCliente");
  const detData    = document.getElementById("detData");
  const detOra     = document.getElementById("detOra");
  const detTratt   = document.getElementById("detTrattamenti");
  const detTotale  = document.getElementById("detTotale");
  const detModBtn  = document.getElementById("detModifica");

  let currentAppointmentId = null;

  function euro(n) {
    try { return n.toLocaleString('it-IT', { style:'currency', currency:'EUR' }); }
    catch { return `€ ${Number(n || 0).toFixed(2)}`; }
  }

  function openModal() {
    if (!modal) return;
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden","false");
  }
  function closeModal() {
    if (!panel || !modal) return;
    panel.classList.add("swipe-out-down");
    panel.addEventListener("transitionend", () => {
      panel.classList.remove("swipe-out-down");
      modal.style.display = "none";
      modal.setAttribute("aria-hidden","true");
      panel.style.transform = "";
    }, { once:true });
  }

  btnClose?.addEventListener("click", closeModal);
  modal?.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  // Carica appuntamenti del giorno e attacca click per aprire dettaglio
  async function caricaAppuntamentiGiorno() {
    const q = query(collection(db, "appuntamenti"), where("data", "==", dataParamFinale));
    const snapshot = await getDocs(q);

    const clientiCache = {};
    const appuntamenti = [];

    for (const docSnap of snapshot.docs) {
      const dati = docSnap.data();
      const idCliente = dati.clienteId;

      let nomeCliente = clientiCache[idCliente];
      if (!nomeCliente) {
        const clienteDoc = await getDoc(doc(db, "clienti", idCliente));
        nomeCliente = clienteDoc.exists() ? (clienteDoc.data().nome || "") : "";
        clientiCache[idCliente] = nomeCliente;
      }

      appuntamenti.push({
        id: docSnap.id,
        data: dati.data || dati.date,
        ora:  dati.ora  || dati.time,
        nome: nomeCliente,
        trattamenti: Array.isArray(dati.trattamenti) ? dati.trattamenti : []
      });
    }

    appuntamenti.sort((a,b) => a.ora.localeCompare(b.ora));

    if (appuntamenti.length === 0) {
      contenuto.innerHTML += "<p>Nessun appuntamento per questo giorno.</p>";
      return;
    }

    appuntamenti.forEach(app => {
      const row = document.createElement("div");
      row.className = "evento-giorno";

      const oraEl = document.createElement("span");
      oraEl.className = "eg-ora";
      oraEl.textContent = `Ore ${app.ora}`;

      const iconeEl = document.createElement("span");
      iconeEl.className = "eg-icone";
      app.trattamenti.slice(0,6).forEach(t=>{
        const img = document.createElement("img");
        img.src = t.icona || trovaIcona(t.nome);
        img.alt = t.nome || "";
        iconeEl.appendChild(img);
      });
      if (app.trattamenti.length > 6) {
        const more = document.createElement("span");
        more.className = "eg-more";
        more.textContent = `+${app.trattamenti.length - 6}`;
        iconeEl.appendChild(more);
      }

      const nomeEl = document.createElement("span");
      nomeEl.className = "eg-nome";
      nomeEl.textContent = app.nome;

      row.appendChild(oraEl); row.appendChild(iconeEl); row.appendChild(nomeEl);
      contenuto.appendChild(row);

      // Click = apri dettaglio
      row.addEventListener("click", () => {
        currentAppointmentId = app.id;

        detTitolo && (detTitolo.textContent = app.nome || "Appuntamento");
        detData   && (detData.textContent   = app.data || dataParamFinale);
        detOra    && (detOra.textContent    = app.ora  || "");

        if (detTratt) {
          detTratt.innerHTML = "";
          let totale = 0;
          (app.trattamenti || []).forEach(t => {
            const r = document.createElement("div");
            r.className = "det-tratt-item";
            const nome  = document.createElement("span");
            nome.className = "det-tratt-nome";
            nome.textContent = t.nome || "-";
            const prezzo = document.createElement("span");
            prezzo.className = "det-tratt-prezzo";
            const p = Number(t.prezzo) || 0;
            prezzo.textContent = euro(p);
            totale += p;
            r.appendChild(nome); r.appendChild(prezzo);
            detTratt.appendChild(r);
          });
          detTotale && (detTotale.textContent = euro(totale));
        }

        openModal();
      });
    });
  }

  // Navigazione giorno
  function aggiornaVistaGiorno(nuovaData, animazione) {
    dataCorrente = nuovaData;
    const dataStr = nuovaData.toISOString().split("T")[0];

    history.replaceState(null, "", `giorno.html?data=${dataStr}`);
    document.getElementById("meseCorrente").textContent = nuovaData.toLocaleDateString("it-IT", { month:"long" });
    document.getElementById("annoCorrente").textContent = nuovaData.getFullYear();
    document.getElementById("btnTornaOggi").textContent = new Date().getDate();

    const titolo = document.getElementById("titoloData");
    titolo.textContent = nuovaData.toLocaleDateString("it-IT", {
      weekday:"long", day:"numeric", month:"long", year:"numeric"
    });

    contenuto.classList.add(animazione);
    setTimeout(()=>contenuto.classList.remove(animazione),300);
    contenuto.innerHTML = ""; contenuto.appendChild(titolo);

    caricaAppuntamentiGiornoDaData(dataStr);

    if (miniCalendario.style.display === "block") {
      mostraMiniCalendario(nuovaData.getFullYear(), nuovaData.getMonth());
      mesiBar.classList.add("visibile");
      mesiBar.style.display = "flex";
      miniCalendario.style.display = "block";
    }
  }

  async function caricaAppuntamentiGiornoDaData(dataStr){
    const q = query(collection(db, "appuntamenti"), where("data", "==", dataStr));
    const snapshot = await getDocs(q);

    const clientiCache = {};
    const appuntamenti = [];

    for (const docSnap of snapshot.docs) {
      const dati = docSnap.data();
      const idCliente = dati.clienteId;
      let nomeCliente = clientiCache[idCliente];
      if (!nomeCliente) {
        const clienteDoc = await getDoc(doc(db,"clienti",idCliente));
        nomeCliente = clienteDoc.exists() ? (clienteDoc.data().nome || "") : "";
        clientiCache[idCliente] = nomeCliente;
      }
      appuntamenti.push({
        id: docSnap.id,
        data: dati.data || dati.date,
        ora:  dati.ora  || dati.time,
        nome: nomeCliente,
        trattamenti: Array.isArray(dati.trattamenti) ? dati.trattamenti : []
      });
    }

    appuntamenti.sort((a,b)=>a.ora.localeCompare(b.ora));

    if (appuntamenti.length === 0){
      contenuto.innerHTML += "<p>Nessun appuntamento per questo giorno.</p>";
      return;
    }

    appuntamenti.forEach(app=>{
      const row = document.createElement("div");
      row.className = "evento-giorno";

      const oraEl = document.createElement("span");
      oraEl.className = "eg-ora";
      oraEl.textContent = `Ore ${app.ora}`;

      const iconeEl = document.createElement("span");
      iconeEl.className = "eg-icone";
      app.trattamenti.slice(0,6).forEach(t=>{
        const img=document.createElement("img");
        img.src = t.icona || trovaIcona(t.nome);
        img.alt = t.nome || "";
        iconeEl.appendChild(img);
      });
      if (app.trattamenti.length > 6) {
        const more = document.createElement("span");
        more.className = "eg-more";
        more.textContent = `+${app.trattamenti.length - 6}`;
        iconeEl.appendChild(more);
      }

      const nomeEl = document.createElement("span");
      nomeEl.className = "eg-nome";
      nomeEl.textContent = app.nome;

      row.appendChild(oraEl); row.appendChild(iconeEl); row.appendChild(nomeEl);
      contenuto.appendChild(row);

      row.addEventListener("click", ()=>{
        currentAppointmentId = app.id;

        detTitolo && (detTitolo.textContent = app.nome || "Appuntamento");
        detData   && (detData.textContent   = app.data || dataStr);
        detOra    && (detOra.textContent    = app.ora  || "");

        if (detTratt) {
          detTratt.innerHTML = "";
          let totale = 0;
          (app.trattamenti||[]).forEach(t=>{
            const r = document.createElement("div");
            r.className = "det-tratt-item";
            const n = document.createElement("span"); n.className="det-tratt-nome"; n.textContent = t.nome || "-";
            const pr= document.createElement("span"); pr.className="det-tratt-prezzo";
            const p = Number(t.prezzo) || 0; pr.textContent = euro(p); totale += p;
            r.appendChild(n); r.appendChild(pr); detTratt.appendChild(r);
          });
          detTotale && (detTotale.textContent = euro(totale));
        }
        openModal();
      });
    });
  }

  // Pulsante "Modifica appuntamento"
  detModBtn?.addEventListener("click", ()=>{
    if (currentAppointmentId) {
      window.location.href = `nuovo-appuntamento.html?edit=${currentAppointmentId}`;
    }
  });

  // Toggle barra mesi
  document.getElementById("meseSwitch").addEventListener("click", () => {
    const mini = document.getElementById("miniCalendario");
    const vis = mesiBar.classList.contains("visibile");
    if (vis) { mesiBar.classList.remove("visibile"); mesiBar.style.display="none"; mini.style.display="none"; }
    else {
      mesiBar.classList.add("visibile"); mesiBar.style.display="flex"; mini.style.display="block";
      const att = mesiBar.querySelector(".attivo");
      if (att) { att.scrollIntoView({behavior:"smooth", inline:"center"}); mostraMiniCalendario(parseInt(att.dataset.anno), parseInt(att.dataset.mese)); }
    }
  });

  function generaBarraMesiCompleta(){
    mesiBar.innerHTML = "";
    let currentSpan = null;
    for (let anno=2020; anno<=2050; anno++){
      const sep = document.createElement("span");
      sep.textContent = anno; sep.classList.add("separatore-anno");
      mesiBar.appendChild(sep);
      for (let mese=0; mese<12; mese++){
        const span=document.createElement("span");
        span.textContent = new Date(anno,mese).toLocaleDateString("it-IT",{month:"short"});
        span.dataset.mese=mese; span.dataset.anno=anno;
        if (mese===dataCorrente.getMonth() && anno===dataCorrente.getFullYear()){ span.classList.add("attivo"); currentSpan=span; }
        span.addEventListener("click",()=>{
          mostraMiniCalendario(anno,mese);
          mesiBar.querySelectorAll("span").forEach(s=>s.classList.remove("attivo"));
          span.classList.add("attivo");
        });
        mesiBar.appendChild(span);
      }
    }
    setTimeout(()=>{ if(currentSpan) currentSpan.scrollIntoView({behavior:"smooth", inline:"center"}); },50);
  }

  function mostraMiniCalendario(anno,mese){
    const container = document.getElementById("miniCalendario");
    container.innerHTML = ""; meseMiniCorrente=mese; annoMiniCorrente=anno;

    const oggiStr = new Date().toISOString().split("T")[0];
    const giornoVisualizzato = dataCorrente.toISOString().split("T")[0];
    const primaGiorno = new Date(anno, mese, 1).getDay();
    const ultimoGiorno = new Date(anno, mese+1, 0).getDate();

    const giorniSettimana = ["L","M","M","G","V","S","D"];
    const table=document.createElement("table");
    const thead=document.createElement("thead");
    const trHead=document.createElement("tr");
    giorniSettimana.forEach(g=>{ const th=document.createElement("th"); th.textContent=g; trHead.appendChild(th); });
    thead.appendChild(trHead); table.appendChild(thead);

    const tbody=document.createElement("tbody");
    let tr=document.createElement("tr"); let dayCount=0;
    for (let i=1; i<(primaGiorno===0?7:primaGiorno); i++){ tr.appendChild(document.createElement("td")); dayCount++; }

    for (let giorno=1; giorno<=ultimoGiorno; giorno++){
      if (dayCount % 7 === 0){ tbody.appendChild(tr); tr=document.createElement("tr"); }
      const td=document.createElement("td");
      const dataStr = `${anno}-${String(mese+1).padStart(2,'0')}-${String(giorno).padStart(2,'0')}`;
      td.textContent = giorno;
      if (dataStr===oggiStr) td.classList.add("oggi");
      if (dataStr===giornoVisualizzato) td.classList.add("selezionato");
      td.addEventListener("click", ()=> aggiornaVistaGiorno(new Date(dataStr), "") );
      tr.appendChild(td); dayCount++;
    }
    tbody.appendChild(tr); table.appendChild(tbody);
    container.appendChild(table); container.style.display="block";

    document.querySelectorAll("#mesiBar span").forEach(s=>{
      const sm=parseInt(s.dataset.mese), sa=parseInt(s.dataset.anno);
      s.classList.toggle("attivo", sm===mese && sa===anno);
    });

    import("./swipe.js").then(({ abilitaSwipe })=>{
      abilitaSwipe(container, ()=>{
        const next=new Date(anno, mese+1); mostraMiniCalendario(next.getFullYear(), next.getMonth());
      }, ()=>{
        const prev=new Date(anno, mese-1); mostraMiniCalendario(prev.getFullYear(), prev.getMonth());
      }, true);
    });
  }

  // Swipe tra giorni (orizzontale)
  abilitaSwipe(contenuto, ()=>{
    const nd = new Date(dataCorrente); nd.setDate(nd.getDate()+1); aggiornaVistaGiorno(nd, "slide-left");
  }, ()=>{
    const nd = new Date(dataCorrente); nd.setDate(nd.getDate()-1); aggiornaVistaGiorno(nd, "slide-right");
  });

  // Start
  generaBarraMesiCompleta();
  await caricaAppuntamentiGiorno();
});

/* ---------- Swipe verticale sulla maniglia del dettaglio ---------- */
/* Funziona su .det-header dentro #dettaglioModal, chiude tirando giù */
(() => {
  const detHeader = document.querySelector("#dettaglioModal .det-header");
  const panel     = document.querySelector("#dettaglioModal .det-panel");
  const modal     = document.getElementById("dettaglioModal");
  if (!detHeader || !panel || !modal) return;

  let startY = 0;
  let currentY = 0;
  let dragging = false;

  const THRESHOLD = 60;
  const MAX_TRANSLATE = 200;

  const setTranslate = (y) => {
    const clamped = Math.max(0, Math.min(y, MAX_TRANSLATE));
    panel.style.transition = "none";
    panel.style.transform = `translateY(${clamped}px)`;
  };

  const endDrag = () => {
    panel.style.transition = "";
    if (currentY - startY > THRESHOLD) {
      panel.classList.add("swipe-out-down");
      panel.addEventListener("transitionend", () => {
        panel.classList.remove("swipe-out-down");
        panel.style.transform = "";
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
      }, { once: true });
    } else {
      panel.style.transform = "";
    }
    dragging = false;
  };

  // Touch
  detHeader.addEventListener("touchstart", (e) => {
    if (!e.touches || !e.touches[0]) return;
    dragging = true;
    startY = e.touches[0].clientY;
    currentY = startY;
    e.preventDefault();
  }, { passive: false });

  detHeader.addEventListener("touchmove", (e) => {
    if (!dragging || !e.touches || !e.touches[0]) return;
    currentY = e.touches[0].clientY;
    const delta = currentY - startY;
    if (delta > 0) setTranslate(delta);
    e.preventDefault();
  }, { passive: false });

  detHeader.addEventListener("touchend", endDrag);

  // Mouse
  detHeader.addEventListener("mousedown", (e) => {
    dragging = true;
    startY = e.clientY;
    currentY = startY;
    e.preventDefault();
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    currentY = e.clientY;
    const delta = currentY - startY;
    if (delta > 0) setTranslate(delta);
  });

  window.addEventListener("mouseup", () => {
    if (dragging) endDrag();
  });
})();