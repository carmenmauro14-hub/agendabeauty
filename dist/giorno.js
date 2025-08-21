// giorno.js — COMPLETO (Timestamp-based) + fix area swipe

// Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, query, where, getDocs, doc, getDoc,
  orderBy, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { abilitaSwipe, abilitaSwipeVerticale } from "./swipe.js";

let dataCorrente;      // Date (giorno visualizzato)
let meseMiniCorrente;  // numero mese per mini-cal
let annoMiniCorrente;  // anno per mini-cal

document.addEventListener("DOMContentLoaded", async () => {
  // ---- Firebase ----
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

  // ---- DOM ----
  const contenuto      = document.getElementById("contenutoGiorno");
  const mesiBar        = document.getElementById("mesiBar");
  const miniCalendario = document.getElementById("miniCalendario");
  const lblMese        = document.getElementById("meseCorrente");
  const lblAnno        = document.getElementById("annoCorrente");
  const btnOggi        = document.getElementById("btnTornaOggi");

  // 🔸 garantisce sempre una superficie “toccabile” per lo swipe
  function ensureMinHeight() {
    const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    // ~ somma di header + barra mesi + mini-cal + navbar bottom (adatta se serve)
    const extra = 220;
    contenuto.style.minHeight = (vh - extra) + "px";
  }
  ensureMinHeight();
  window.addEventListener("resize", ensureMinHeight);

  // ---- Stato iniziale ----
  const params          = new URLSearchParams(location.search);
  const dataParam       = params.get("data"); // "YYYY-MM-DD"
  const oggi            = new Date();
  dataCorrente          = dataParam ? new Date(dataParam) : oggi;
  const dataParamFinale = dataParam || oggi.toISOString().slice(0,10);

  // ---- Header iniziale ----
  function aggiornaHeader() {
    lblMese.textContent = dataCorrente.toLocaleDateString("it-IT", { month: "long" });
    lblAnno.textContent = dataCorrente.getFullYear();
    btnOggi.textContent = oggi.getDate();
  }
  aggiornaHeader();

  // Titolo data grande
  const titolo = document.createElement("h2");
  titolo.id = "titoloData";
  titolo.style.textTransform = "capitalize";
  titolo.textContent = dataCorrente.toLocaleDateString("it-IT", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });
  contenuto.appendChild(titolo);

  // ---- Utils ----
  function trovaIcona(nome) {
    const icone = [
      "makeup_sposa","makeup","microblading","extension_ciglia",
      "laminazione_ciglia","filo_arabo","architettura_sopracciglia","airbrush_sopracciglia","microblinding"
    ];
    const norm = (nome || "").toLowerCase().replace(/\s+/g, "_");
    for (const base of icone) if (norm.includes(base)) return `icones_trattamenti/${base}.png`;
    return "icone_uniformate_colore/setting.png";
  }
  function euro(n) {
    const x = Number(n || 0);
    try { return x.toLocaleString("it-IT",{style:"currency",currency:"EUR"}); }
    catch { return `€ ${x.toFixed(2)}`; }
  }
  function dayRangeFromISO(iso) {
    const start = new Date(iso + "T00:00:00");
    const end   = new Date(start); end.setDate(end.getDate()+1);
    return { start: Timestamp.fromDate(start), end: Timestamp.fromDate(end) };
  }
  function pickDate(d) {
    // accetta Timestamp o stringa
    if (d && typeof d.toDate === "function") {
      const dateObj = d.toDate();
      return { dateObj, iso: dateObj.toISOString().slice(0,10) };
    }
    if (typeof d === "string") {
      const dateObj = new Date(d.length === 10 ? d + "T00:00:00" : d);
      return { dateObj, iso: d.slice(0,10) };
    }
    return { dateObj: null, iso: "" };
  }

  // ---- Modale dettaglio appuntamento ----
  function ensureModal() {
    let modal = document.getElementById("apptDetModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "apptDetModal";
    Object.assign(modal.style, {
      display:"none", position:"fixed", inset:"0", background:"rgba(0,0,0,.5)",
      zIndex:"1000", alignItems:"flex-start", justifyContent:"center", paddingTop:"24px"
    });

    const panel = document.createElement("div");
    panel.id = "apptDetPanel";
    Object.assign(panel.style, {
      height:"95vh", width:"100%", maxWidth:"520px", margin:"0 auto",
      background:"#fff", borderRadius:"16px 16px 0 0", position:"relative",
      overflowY:"auto", padding:"56px 16px 16px", transition:"transform 200ms ease"
    });

    const btnClose = document.createElement("button");
    btnClose.innerText = "✕";
    btnClose.setAttribute("aria-label","Chiudi");
    Object.assign(btnClose.style, {
      position:"absolute", top:"6px", right:"8px", width:"32px", height:"32px",
      border:"0", background:"transparent", fontSize:"22px", color:"#a07863", cursor:"pointer", zIndex:"4"
    });
    btnClose.addEventListener("click", closeModal);

    // grabber per swipe down
    const header = document.createElement("div");
    Object.assign(header.style, {
      position:"absolute", top:"0", left:"0", right:"0", height:"44px",
      display:"flex", alignItems:"center", justifyContent:"center", userSelect:"none"
    });
    const grabber = document.createElement("div");
    Object.assign(grabber.style, { width:"48px", height:"5px", borderRadius:"3px", background:"#e6d9d0" });
    header.appendChild(grabber);

    const title = document.createElement("h3");
    title.id = "apptDetNome";
    Object.assign(title.style, { margin:"6px 0 12px", color:"#222", fontSize:"28px", fontWeight:"900" });

    const row = (labelTxt, valueId) => {
      const r = document.createElement("div");
      Object.assign(r.style, { display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"14px 0", borderBottom:"1px solid #f0e8e2" });
      const l = document.createElement("span"); l.textContent = labelTxt;
      Object.assign(l.style, { fontWeight:"900", color:"#a07863", fontSize:"18px" });
      const v = document.createElement("span"); v.id = valueId; Object.assign(v.style, { color:"#6d584b", fontWeight:"700" });
      r.appendChild(l); r.appendChild(v); return r;
    };
    const rData = row("Data","apptDetData");
    const rOra  = row("Ora" ,"apptDetOra");

    const hr = document.createElement("hr");
    Object.assign(hr.style, { border:"0", borderTop:"1px solid #f0e8e2", margin:"12px 0" });

    const secTitle = document.createElement("div");
    secTitle.textContent = "Trattamenti";
    Object.assign(secTitle.style, { fontWeight:"900", color:"#a07863", fontSize:"18px", marginTop:"4px" });

    const list = document.createElement("div");
    list.id = "apptDetTratt";

    const totRow = document.createElement("div");
    Object.assign(totRow.style, { display:"flex", alignItems:"center", justifyContent:"space-between",
      padding:"16px 0", fontSize:"18px" });
    const totL = document.createElement("span"); totL.textContent = "Totale";
    Object.assign(totL.style, { fontWeight:"900", color:"#a07863" });
    const totV = document.createElement("span"); totV.id = "apptDetTotale";
    Object.assign(totV.style, { color:"#6d584b", fontWeight:"700" });
    totRow.appendChild(totL); totRow.appendChild(totV);

    const actions = document.createElement("div");
    const modBtn = document.createElement("button");
    modBtn.id = "apptDetModifica";
    modBtn.textContent = "Modifica appuntamento";
    Object.assign(modBtn.style, {
      display:"inline-flex", alignItems:"center", justifyContent:"center",
      width:"100%", height:"44px", border:"none", borderRadius:"14px",
      background:"#d2b8a3", color:"#fff", fontSize:"16px", fontWeight:"600", cursor:"pointer"
    });
    actions.appendChild(modBtn);

    const body = document.createElement("div");
    body.appendChild(title); body.appendChild(rData); body.appendChild(rOra);
    body.appendChild(hr); body.appendChild(secTitle); body.appendChild(list);
    body.appendChild(totRow); body.appendChild(actions);

    panel.appendChild(btnClose); panel.appendChild(header); panel.appendChild(body);
    modal.appendChild(panel); document.body.appendChild(modal);

    // chiusura overlay
    modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });
    // swipe down
    abilitaSwipeVerticale(header, null, closeModal, true, 45);

    modal._els = {
      panel, title,
      data: rData.querySelector("#apptDetData"),
      ora:  rOra.querySelector("#apptDetOra"),
      list, tot: totV, modBtn
    };
    return modal;
  }
  function openModal(appt){
    const modal = ensureModal();
    const els = modal._els;

    els.title.textContent = appt.nome || "Appuntamento";
    els.data.textContent  = appt.data || "";
    els.ora .textContent  = appt.ora  || "";

    els.list.innerHTML = "";
    let totale = 0;
    (appt.trattamenti || []).forEach(t => {
      const r = document.createElement("div");
      Object.assign(r.style, {
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"10px 0", borderBottom:"1px dashed #e6d9d0"
      });
      const n = document.createElement("span"); n.textContent = t.nome || "-"; n.style.color = "#6d584b";
      const p = document.createElement("span"); const val = Number(t.prezzo)||0;
      p.textContent = euro(val); Object.assign(p.style,{ color:"#6d584b", fontWeight:"700" });
      totale += val; r.appendChild(n); r.appendChild(p); els.list.appendChild(r);
    });
    els.tot.textContent = euro(totale);
    els.modBtn.onclick = () => { if (appt.id) location.href = `nuovo-appuntamento.html?edit=${appt.id}`; };

    modal.style.display = "flex";
  }
  function closeModal(){
    const modal = document.getElementById("apptDetModal");
    if (!modal) return;
    const panel = modal._els?.panel;
    if (!panel) { modal.style.display = "none"; return; }
    panel.style.transition = "transform 200ms ease";
    panel.style.transform  = "translateY(100%)";
    panel.addEventListener("transitionend", () => {
      panel.style.transform=""; modal.style.display="none";
    }, { once:true });
  }

  // ---- Query appuntamenti (Timestamp) ----
  async function caricaAppuntamentiGiornoISO(iso) {
    const { start, end } = dayRangeFromISO(iso);
    const qRef = query(
      collection(db, "appuntamenti"),
      where("data", ">=", start),
      where("data", "<",  end),
      orderBy("data","asc")
    );
    const snap = await getDocs(qRef);

    const clientiCache = {};
    const items = [];

    for (const d of snap.docs) {
      const a = d.data();
      const idCliente = a.clienteId;

      let nomeCliente = clientiCache[idCliente];
      if (!nomeCliente) {
        const cliDoc = await getDoc(doc(db,"clienti",idCliente));
        nomeCliente = cliDoc.exists() ? (cliDoc.data().nome || "") : "";
        clientiCache[idCliente] = nomeCliente;
      }

      const { iso: isoApp } = pickDate(a.data);

      items.push({
        id: d.id,
        data: isoApp,
        ora: a.ora || "",
        nome: nomeCliente,
        trattamenti: Array.isArray(a.trattamenti) ? a.trattamenti : []
      });
    }

    // render
    items.sort((A,B) => (A.ora||"").localeCompare(B.ora||""));

    if (items.length === 0) {
      contenuto.innerHTML += '<p class="no-appt">Nessun appuntamento per questo giorno.</p>';
      ensureMinHeight();
      return;
    }

    items.forEach(app => {
      const row = document.createElement("div");
      row.className = "evento-giorno";
      row._appt = app;

      const oraEl = document.createElement("span");
      oraEl.className = "eg-ora";
      oraEl.textContent = `Ore ${app.ora}`;

      const iconeEl = document.createElement("span");
      iconeEl.className = "eg-icone";
      app.trattamenti.slice(0,6).forEach(t => {
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

      row.appendChild(oraEl);
      row.appendChild(iconeEl);
      row.appendChild(nomeEl);
      contenuto.appendChild(row);

      row.addEventListener("click", () => openModal(row._appt));
    });

    ensureMinHeight();
  }

  async function caricaAppuntamentiGiorno() {
    await caricaAppuntamentiGiornoISO(dataParamFinale);
  }

  // ---- Cambio giorno (swipe/click mini-cal) ----
  function aggiornaVistaGiorno(nuovaData, animazione) {
    dataCorrente = nuovaData;
    const iso = nuovaData.toISOString().slice(0,10);

    history.replaceState(null,"",`giorno.html?data=${iso}`);
    aggiornaHeader();

    const titolo = document.getElementById("titoloData");
    titolo.textContent = nuovaData.toLocaleDateString("it-IT", {
      weekday:"long", day:"numeric", month:"long", year:"numeric"
    });

    if (animazione) {
      contenuto.classList.add(animazione);
      setTimeout(() => contenuto.classList.remove(animazione), 300);
    }

    contenuto.innerHTML = "";
    contenuto.appendChild(titolo);
    ensureMinHeight();

    caricaAppuntamentiGiornoISO(iso);

    // se il mini-cal è aperto, riallineo
    if (miniCalendario.style.display === "block") {
      mostraMiniCalendario(nuovaData.getFullYear(), nuovaData.getMonth());
      mesiBar.classList.add("visibile");
      mesiBar.style.display = "flex";
      miniCalendario.style.display = "block";
    }
  }

  // ---- Mini calendario ----
  function mostraMiniCalendario(anno, mese) {
    const container = miniCalendario;
    container.innerHTML = "";
    meseMiniCorrente = mese;
    annoMiniCorrente = anno;

    const oggiStr = new Date().toISOString().slice(0,10);
    const giornoVisualizzato = dataCorrente.toISOString().slice(0,10);
    const primaGiorno = new Date(anno, mese, 1).getDay(); // 0=dom
    const ultimoGiorno = new Date(anno, mese+1, 0).getDate();

    const giorniSettimana = ["L","M","M","G","V","S","D"];
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const trHead = document.createElement("tr");
    giorniSettimana.forEach(g => { const th=document.createElement("th"); th.textContent=g; trHead.appendChild(th); });
    thead.appendChild(trHead); table.appendChild(thead);

    const tbody = document.createElement("tbody");
    let tr = document.createElement("tr");
    let dayCount = 0;

    for (let i=1; i < (primaGiorno === 0 ? 7 : primaGiorno); i++) {
      tr.appendChild(document.createElement("td")); dayCount++;
    }

    for (let g=1; g<=ultimoGiorno; g++) {
      if (dayCount % 7 === 0) { tbody.appendChild(tr); tr = document.createElement("tr"); }
      const td = document.createElement("td");
      const dataStr = `${anno}-${String(mese+1).padStart(2,"0")}-${String(g).padStart(2,"0")}`;
      td.textContent = g;
      if (dataStr === oggiStr) td.classList.add("oggi");
      if (dataStr === giornoVisualizzato) td.classList.add("selezionato");
      td.addEventListener("click", () => aggiornaVistaGiorno(new Date(dataStr), ""));
      tr.appendChild(td); dayCount++;
    }
    tbody.appendChild(tr); table.appendChild(tbody);

    container.appendChild(table);
    container.style.display = "block";

    // Swipe mese precedente/successivo
    import("./swipe.js").then(({ abilitaSwipe }) => {
      abilitaSwipe(container,
        () => { const nx=new Date(anno, mese+1); mostraMiniCalendario(nx.getFullYear(), nx.getMonth()); },
        () => { const pv=new Date(anno, mese-1); mostraMiniCalendario(pv.getFullYear(), pv.getMonth()); }
      );
    });

    // evidenzia mese attivo in barra
    document.querySelectorAll("#mesiBar span").forEach(s => {
      const sm = parseInt(s.dataset.mese); const sa = parseInt(s.dataset.anno);
      s.classList.toggle("attivo", sm===mese && sa===anno);
    });
  }

  // ---- Barra mesi (orizzontale completa) ----
  function generaBarraMesiCompleta() {
    mesiBar.innerHTML = "";
    let currentSpan = null;
    for (let anno=2020; anno<=2050; anno++) {
      const sep = document.createElement("span");
      sep.textContent = anno;
      sep.classList.add("separatore-anno");
      mesiBar.appendChild(sep);

      for (let mese=0; mese<12; mese++) {
        const span = document.createElement("span");
        span.textContent = new Date(anno, mese).toLocaleDateString("it-IT",{month:"short"});
        span.dataset.mese = mese; span.dataset.anno = anno;

        if (mese===dataCorrente.getMonth() && anno===dataCorrente.getFullYear()) {
          span.classList.add("attivo"); currentSpan = span;
        }
        span.addEventListener("click", () => {
          mostraMiniCalendario(anno, mese);
          mesiBar.querySelectorAll("span").forEach(s=>s.classList.remove("attivo"));
          span.classList.add("attivo");
        });
        mesiBar.appendChild(span);
      }
    }
    setTimeout(()=>{ if (currentSpan) currentSpan.scrollIntoView({behavior:"smooth",inline:"center"}); }, 50);
  }

  // ---- Eventi UI ----
  document.getElementById("meseSwitch").addEventListener("click", () => {
    const vis = mesiBar.classList.contains("visibile");
    if (vis) {
      mesiBar.classList.remove("visibile"); mesiBar.style.display="none"; miniCalendario.style.display="none";
    } else {
      mesiBar.classList.add("visibile"); mesiBar.style.display="flex"; miniCalendario.style.display="block";
      const attivo = mesiBar.querySelector(".attivo");
      if (attivo) {
        attivo.scrollIntoView({behavior:"smooth", inline:"center"});
        mostraMiniCalendario(parseInt(attivo.dataset.anno), parseInt(attivo.dataset.mese));
      }
    }
  });

  btnOggi.addEventListener("click", () => {
    const iso = new Date().toISOString().slice(0,10);
    location.href = `giorno.html?data=${iso}`;
  });

  document.getElementById("aggiungiAppuntamentoBtn").addEventListener("click", () => {
    const iso = dataCorrente.toISOString().slice(0,10);
    location.href = `nuovo-appuntamento.html?data=${iso}`;
  });

  // ---- Avvio ----
  generaBarraMesiCompleta();
  await caricaAppuntamentiGiorno();

  // swipe giorno precedente/successivo sull'intera area contenuto
  abilitaSwipe(
    contenuto,
    () => { const nd=new Date(dataCorrente); nd.setDate(nd.getDate()+1); aggiornaVistaGiorno(nd,"slide-left"); },
    () => { const nd=new Date(dataCorrente); nd.setDate(nd.getDate()-1); aggiornaVistaGiorno(nd,"slide-right"); }
    // Se hai aggiornato swipe.js con la guardia sui bordi, puoi passare anche: , { minStartEdge:24, minDelta:60 }
  );
});