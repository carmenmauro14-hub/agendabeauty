import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { abilitaSwipe, abilitaSwipeVerticale } from './swipe.js'; // NEW ⬅️

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

  const titolo = document.createElement("h2");
  titolo.id = "titoloData";
  titolo.textContent = dataCorrente.toLocaleDateString("it-IT", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });
  titolo.style.textTransform = "capitalize";
  contenuto.appendChild(titolo);

  // ——— Fallback icone ———
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

  // ——— Util € ———
  function euro(n) {
    const x = Number(n || 0);
    try { return x.toLocaleString('it-IT', { style:'currency', currency:'EUR' }); }
    catch { return `€ ${x.toFixed(2)}`; }
  }

  // ——— Modale creato a runtime ———
  function ensureModal() {
    let modal = document.getElementById("apptDetModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "apptDetModal";
    modal.setAttribute("aria-hidden", "true");
    Object.assign(modal.style, {
      display: "none", position: "fixed", inset: "0",
      background: "rgba(0,0,0,.5)", zIndex: "1000",
      alignItems: "flex-start", justifyContent: "center", paddingTop: "24px"
    });

    const panel = document.createElement("div");
    panel.id = "apptDetPanel";
    Object.assign(panel.style, {
      height: "95vh", width: "100%", maxWidth: "520px", margin: "0 auto",
      background: "#fff", borderRadius: "16px 16px 0 0", position: "relative",
      overflowY: "auto", padding: "56px 16px 16px 16px",
      transition: "transform 200ms ease", transform: "translateY(0)"
    });

    const btnClose = document.createElement("button");
    btnClose.innerText = "✕";
    btnClose.setAttribute("aria-label","Chiudi");
    Object.assign(btnClose.style, {
      position:"absolute", top:"6px", right:"8px", width:"32px", height:"32px",
      border:"0", background:"transparent", fontSize:"22px", lineHeight:"32px",
      color:"#a07863", opacity:".85", cursor:"pointer", zIndex:"4"
    });
    btnClose.addEventListener("click", closeModal);

    const header = document.createElement("div");
    Object.assign(header.style, {
      position:"absolute", top:"0", left:"0", right:"0", height:"44px",
      display:"flex", alignItems:"center", justifyContent:"center",
      touchAction:"none", userSelect:"none", zIndex:"3"
    });
    const grabber = document.createElement("div");
    Object.assign(grabber.style, { width:"48px", height:"5px", borderRadius:"3px", background:"#e6d9d0" });
    header.appendChild(grabber);

    const title = document.createElement("h3");
    title.id = "apptDetNome";
    Object.assign(title.style, { margin:"6px 0 12px 0", color:"#222", fontSize:"28px", fontWeight:"900" });

    const row = (labelTxt, valueId) => {
      const r = document.createElement("div");
      Object.assign(r.style, {
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"14px 0", borderBottom:"1px solid #f0e8e2"
      });
      const l = document.createElement("span");
      l.textContent = labelTxt; Object.assign(l.style, { fontWeight:"900", color:"#a07863", fontSize:"18px" });
      const v = document.createElement("span");
      v.id = valueId; Object.assign(v.style, { color:"#6d584b", fontWeight:"700" });
      r.appendChild(l); r.appendChild(v); return r;
    };
    const rData = row("Data", "apptDetData");
    const rOra  = row("Ora",  "apptDetOra");

    const sep = document.createElement("hr");
    Object.assign(sep.style, { border:"0", borderTop:"1px solid #f0e8e2", margin:"12px 0" });

    const secTitle = document.createElement("div");
    secTitle.textContent = "Trattamenti";
    Object.assign(secTitle.style, { fontWeight:"900", color:"#a07863", fontSize:"18px", marginTop:"4px" });

    const list = document.createElement("div");
    list.id = "apptDetTratt";
    const rowStyle = {
      display:"flex", alignItems:"center", justifyContent:"space-between",
      padding:"10px 0", borderBottom:"1px dashed #e6d9d0"
    };

    const totRow = document.createElement("div");
    Object.assign(totRow.style, {
      display:"flex", alignItems:"center", justifyContent:"space-between",
      padding:"16px 0", fontSize:"18px"
    });
    const totL = document.createElement("span");
    totL.textContent = "Totale";
    Object.assign(totL.style, { fontWeight:"900", color:"#a07863" });
    const totV = document.createElement("span");
    totV.id = "apptDetTotale";
    Object.assign(totV.style, { color:"#6d584b", fontWeight:"700" });
    totRow.appendChild(totL); totRow.appendChild(totV);

    const actions = document.createElement("div");
    const modBtn = document.createElement("button");
    modBtn.id = "apptDetModifica";
    modBtn.textContent = "Modifica appuntamento";
    Object.assign(modBtn.style, {
      display:"inline-flex", alignItems:"center", justifyContent:"center",
      width:"100%", height:"44px", padding:"0 18px",
      border:"none", borderRadius:"14px", background:"#d2b8a3",
      color:"#fff", fontSize:"16px", fontWeight:"600", cursor:"pointer"
    });
    actions.appendChild(modBtn);

    const body = document.createElement("div");
    body.appendChild(title);
    body.appendChild(rData);
    body.appendChild(rOra);
    body.appendChild(sep);
    body.appendChild(secTitle);
    body.appendChild(list);
    body.appendChild(totRow);
    body.appendChild(actions);

    panel.appendChild(btnClose);
    panel.appendChild(header);
    panel.appendChild(body);
    modal.appendChild(panel);
    document.body.appendChild(modal);

    // click sull'overlay chiude
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

    // NEW: swipe verticale sul pannello → chiude
    const topbar = panel.querySelector(':scope > div'); // la barra con la maniglia che hai creato
    abilitaSwipeVerticale(topbar, null, closeModal, true, 45);

    modal._els = {
      panel,
      title,
      data: document.createElement("span"), // placeholder, sostituiti più sotto
      ora:  document.createElement("span"),
      list,
      tot:  document.createElement("span"),
      modBtn,
      rowStyle
    };
    modal._els.data = rData.querySelector("#apptDetData");
    modal._els.ora  = rOra.querySelector("#apptDetOra");
    modal._els.tot  = totV;

    return modal;
  }

  function openModal(appt) {
      // 🔹 Reset posizione pannello per evitare blocchi dopo chiusura con swipe
    const panel = document.getElementById("apptDetPanel");
    if (panel) panel.style.transform = "";

    const modal = ensureModal();
    const els = modal._els;

    els.title.textContent = appt.nome || "Appuntamento";
    els.data.textContent  = appt.data || dataParamFinale;
    els.ora.textContent   = appt.ora  || "";

    els.list.innerHTML = "";
    let totale = 0;
    (appt.trattamenti || []).forEach(t => {
      const r = document.createElement("div");
      Object.assign(r.style, els.rowStyle);
      const n = document.createElement("span"); n.textContent = t.nome || "-"; Object.assign(n.style, { color:"#6d584b" });
      const p = document.createElement("span"); const val = Number(t.prezzo) || 0;
      p.textContent = euro(val); Object.assign(p.style, { color:"#6d584b", fontWeight:"700" });
      totale += val; r.appendChild(n); r.appendChild(p); els.list.appendChild(r);
    });
    els.tot.textContent = euro(totale);

    els.modBtn.onclick = () => { if (appt.id) window.location.href = `nuovo-appuntamento.html?edit=${appt.id}`; };

    modal.style.display = "flex";
    modal.setAttribute("aria-hidden","false");
  }

  function closeModal() {
    const modal = document.getElementById("apptDetModal");
    if (!modal) return;
    const panel = modal._els?.panel;
    if (!panel) { modal.style.display = "none"; return; }
    panel.style.transition = "transform 200ms ease";
    panel.style.transform = "translateY(100%)";
    panel.addEventListener("transitionend", () => {
      panel.style.transform = "";
      modal.style.display = "none";
      modal.setAttribute("aria-hidden","true");
    }, { once: true });
  }

  // ——— Carica appuntamenti (iniziale) ———
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

    appuntamenti.sort((a, b) => a.ora.localeCompare(b.ora));

    if (appuntamenti.length === 0) {
      contenuto.innerHTML += "<p>Nessun appuntamento per questo giorno.</p>";
    } else {
      appuntamenti.forEach(app => {
        const row = document.createElement("div");
        row.className = "evento-giorno";
        row._appt = app;

        const oraEl = document.createElement("span");
        oraEl.className = "eg-ora";
        oraEl.textContent = `Ore ${app.ora}`;

        const iconeEl = document.createElement("span");
        iconeEl.className = "eg-icone";
        app.trattamenti.slice(0, 6).forEach(t => {
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
    }
  }

  // ——— Aggiorna vista giorno ———
  function aggiornaVistaGiorno(nuovaData, animazione) {
    dataCorrente = nuovaData;
    const dataStr = nuovaData.toISOString().split("T")[0];

    history.replaceState(null, "", `giorno.html?data=${dataStr}`);
    document.getElementById("meseCorrente").textContent = nuovaData.toLocaleDateString("it-IT", { month: 'long' });
    document.getElementById("annoCorrente").textContent = nuovaData.getFullYear();
    document.getElementById("btnTornaOggi").textContent = new Date().getDate();

    const titolo = document.getElementById("titoloData");
    titolo.textContent = nuovaData.toLocaleDateString("it-IT", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });

    contenuto.classList.add(animazione);
    setTimeout(() => contenuto.classList.remove(animazione), 300);

    contenuto.innerHTML = "";
    contenuto.appendChild(titolo);

    caricaAppuntamentiGiornoDaData(dataStr);

    if (miniCalendario.style.display === "block") {
      mostraMiniCalendario(nuovaData.getFullYear(), nuovaData.getMonth());
      mesiBar.classList.add("visibile");
      mesiBar.style.display = "flex";
      miniCalendario.style.display = "block";
    }
  }

  // ——— Carica appuntamenti per data ———
  async function caricaAppuntamentiGiornoDaData(dataStr) {
    const q = query(collection(db, "appuntamenti"), where("data", "==", dataStr));
    const snapshot = await getDocs(q);
    const contenuto = document.getElementById("contenutoGiorno");
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

    appuntamenti.sort((a, b) => a.ora.localeCompare(b.ora));

    if (appuntamenti.length === 0) {
      contenuto.innerHTML += "<p>Nessun appuntamento per questo giorno.</p>";
    } else {
      appuntamenti.forEach(app => {
        const row = document.createElement("div");
        row.className = "evento-giorno";
        row._appt = app;

        const oraEl = document.createElement("span");
        oraEl.className = "eg-ora";
        oraEl.textContent = `Ore ${app.ora}`;

        const iconeEl = document.createElement("span");
        iconeEl.className = "eg-icone";
        app.trattamenti.slice(0, 6).forEach(t => {
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
    }
  }

  function mostraMiniCalendario(anno, mese) {
    const container = document.getElementById("miniCalendario");
    container.innerHTML = "";
    meseMiniCorrente = mese;
    annoMiniCorrente = anno;

    const oggiStr = new Date().toISOString().split("T")[0];
    const giornoVisualizzato = dataCorrente.toISOString().split("T")[0];
    const primaGiorno = new Date(anno, mese, 1).getDay();
    const ultimoGiorno = new Date(anno, mese + 1, 0).getDate();

    const giorniSettimana = ["L", "M", "M", "G", "V", "S", "D"];
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

    for (let i = 1; i < (primaGiorno === 0 ? 7 : primaGiorno); i++) {
      tr.appendChild(document.createElement("td"));
      dayCount++;
    }

    for (let giorno = 1; giorno <= ultimoGiorno; giorno++) {
      if (dayCount % 7 === 0) {
        tbody.appendChild(tr);
        tr = document.createElement("tr");
      }

      const td = document.createElement("td");
      const dataStr = `${anno}-${String(mese + 1).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;
      td.textContent = giorno;

      if (dataStr === oggiStr) td.classList.add("oggi");
      if (dataStr === giornoVisualizzato) td.classList.add("selezionato");

      td.addEventListener("click", () => {
        const nuovaData = new Date(dataStr);
        aggiornaVistaGiorno(nuovaData, "");
      });

      tr.appendChild(td);
      dayCount++;
    }

    tbody.appendChild(tr);
    table.appendChild(tbody);
    container.appendChild(table);
    container.style.display = "block";

    document.querySelectorAll("#mesiBar span").forEach(s => {
      const sm = parseInt(s.dataset.mese);
      const sa = parseInt(s.dataset.anno);
      s.classList.toggle("attivo", sm === mese && sa === anno);
    });

    import("./swipe.js").then(({ abilitaSwipe }) => {
      abilitaSwipe(container, () => {
        const next = new Date(anno, mese + 1);
        mostraMiniCalendario(next.getFullYear(), next.getMonth());
      }, () => {
        const prev = new Date(anno, mese - 1);
        mostraMiniCalendario(prev.getFullYear(), prev.getMonth());
      }, true);
    });
  }

  document.getElementById("meseSwitch").addEventListener("click", () => {
    const mini = document.getElementById("miniCalendario");
    const visibile = mesiBar.classList.contains("visibile");

    if (visibile) {
      mesiBar.classList.remove("visibile");
      mesiBar.style.display = "none";
      mini.style.display = "none";
    } else {
      mesiBar.classList.add("visibile");
      mesiBar.style.display = "flex";
      mini.style.display = "block";

      const attivo = mesiBar.querySelector(".attivo");
      if (attivo) {
        attivo.scrollIntoView({ behavior: "smooth", inline: "center" });
        const anno = parseInt(attivo.dataset.anno);
        const mese = parseInt(attivo.dataset.mese);
        mostraMiniCalendario(anno, mese);
      }
    }
  });

  function generaBarraMesiCompleta() {
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

        if (mese === dataCorrente.getMonth() && anno === dataCorrente.getFullYear()) {
          span.classList.add("attivo");
          currentSpan = span;
        }

        span.addEventListener("click", () => {
          mostraMiniCalendario(anno, mese);
          mesiBar.querySelectorAll("span").forEach(s => s.classList.remove("attivo"));
          span.classList.add("attivo");
        });

        mesiBar.appendChild(span);
      }
    }

    setTimeout(() => {
      if (currentSpan) currentSpan.scrollIntoView({ behavior: "smooth", inline: "center" });
    }, 50);
  }

  generaBarraMesiCompleta();
  await caricaAppuntamentiGiorno();

  // Swipe orizzontale tra giorni (invariato)
  abilitaSwipe(contenuto, () => {
    const nuovaData = new Date(dataCorrente);
    nuovaData.setDate(nuovaData.getDate() + 1);
    aggiornaVistaGiorno(nuovaData, "slide-left");
  }, () => {
    const nuovaData = new Date(dataCorrente);
    nuovaData.setDate(nuovaData.getDate() - 1);
    aggiornaVistaGiorno(nuovaData, "slide-right");
  });
});