import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getFirestore, collection, query, where, getDocs, doc, getDoc, 
  orderBy, Timestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { abilitaSwipe, abilitaSwipeVerticale } from './swipe.js';

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

  // ---- Formattazione date (da "YYYY-MM-DD")
  function formattaDataBreve(iso) {
    if (!iso) return "";
    const [y,m,d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  function formattaDataLunga(iso) {
    if (!iso) return "";
    const mesi = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno",
                  "Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
    const [y,m,d] = iso.split("-");
    return `${parseInt(d,10)} ${mesi[parseInt(m,10)-1]} ${y}`;
  }

  // 🔹 Helper per Timestamp
  function dayRangeFromISO(iso) {
    const startDate = new Date(iso + "T00:00:00");
    const endDate   = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    return {
      start: Timestamp.fromDate(startDate),
      end:   Timestamp.fromDate(endDate),
    };
  }
  function pickDate(d) {
    if (d && typeof d.toDate === "function") {
      const dateObj = d.toDate();
      return { dateObj, iso: dateObj.toISOString().slice(0,10) };
    }
    if (typeof d === "string") {
      const dateObj = new Date(d + (d.length === 10 ? "T00:00:00" : ""));
      return { dateObj, iso: d.slice(0,10) };
    }
    return { dateObj: null, iso: "" };
  }

  // ——— Modale appuntamento (rimasto uguale, tolgo per brevità) ———
  // ... (qui lasci tutto come nel tuo file attuale: ensureModal, openModal, closeModal)

  // ——— Carica appuntamenti (iniziale) ———
  async function caricaAppuntamentiGiorno() {
    const { start, end } = dayRangeFromISO(dataParamFinale);

    const q = query(
      collection(db, "appuntamenti"),
      where("data", ">=", start),
      where("data", "<",  end),
      orderBy("data", "asc")
    );
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

      const { dateObj, iso } = pickDate(dati.data);

      appuntamenti.push({
        id:   docSnap.id,
        data: iso,
        dataObj: dateObj,
        ora:  dati.ora || "",
        nome: nomeCliente,
        trattamenti: Array.isArray(dati.trattamenti) ? dati.trattamenti : []
      });
    }

    appuntamenti.sort((a, b) => (a.ora || "").localeCompare(b.ora || ""));

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
    const { start, end } = dayRangeFromISO(dataStr);

    const q = query(
      collection(db, "appuntamenti"),
      where("data", ">=", start),
      where("data", "<",  end),
      orderBy("data", "asc")
    );
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

      const { dateObj, iso } = pickDate(dati.data);

      appuntamenti.push({
        id:   docSnap.id,
        data: iso,
        dataObj: dateObj,
        ora:  dati.ora || "",
        nome: nomeCliente,
        trattamenti: Array.isArray(dati.trattamenti) ? dati.trattamenti : []
      });
    }

    appuntamenti.sort((a, b) => (a.ora || "").localeCompare(b.ora || ""));

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

  // ——— Mini calendario & swipe restano invariati (tuoi già ok) ———
  // ...
  generaBarraMesiCompleta();
  await caricaAppuntamentiGiorno();

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