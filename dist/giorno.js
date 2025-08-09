import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { abilitaSwipe } from './swipe.js';

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
  const db = getFirestore(app);

  const params = new URLSearchParams(window.location.search);
  const dataParam = params.get("data");
  const oggi = new Date();
  dataCorrente = dataParam ? new Date(dataParam) : oggi;
  const dataParamFinale = dataParam || oggi.toISOString().split("T")[0];

  const contenuto = document.getElementById("contenutoGiorno");
  const mesiBar = document.getElementById("mesiBar");
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
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  titolo.style.textTransform = "capitalize";
  contenuto.appendChild(titolo);

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
        nomeCliente = clienteDoc.exists() ? clienteDoc.data().nome || "" : "";
        clientiCache[idCliente] = nomeCliente;
      }
      appuntamenti.push({ ora: dati.ora, nome: nomeCliente });
    }

    appuntamenti.sort((a, b) => a.ora.localeCompare(b.ora));

    if (appuntamenti.length === 0) {
      contenuto.innerHTML += "<p>Nessun appuntamento per questo giorno.</p>";
    } else {
      appuntamenti.forEach(app => {
        const div = document.createElement("div");
        div.className = "evento-giorno";
        div.textContent = `Ore ${app.ora} - ${app.nome}`;
        contenuto.appendChild(div);
      });
    }
  }

  function aggiornaVistaGiorno(nuovaData, animazione) {
    dataCorrente = nuovaData;
    const dataStr = nuovaData.toISOString().split("T")[0];

    history.replaceState(null, "", `giorno.html?data=${dataStr}`);
    document.getElementById("meseCorrente").textContent = nuovaData.toLocaleDateString("it-IT", { month: 'long' });
    document.getElementById("annoCorrente").textContent = nuovaData.getFullYear();
    document.getElementById("btnTornaOggi").textContent = new Date().getDate();

    const titolo = document.getElementById("titoloData");
    titolo.textContent = nuovaData.toLocaleDateString("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });

    contenuto.classList.add(animazione);
    setTimeout(() => contenuto.classList.remove(animazione), 300);

    contenuto.innerHTML = "";
    contenuto.appendChild(titolo);

    caricaAppuntamentiGiornoDaData(dataStr);

if (miniCalendario.style.display === "block") {
  mostraMiniCalendario(nuovaData.getFullYear(), nuovaData.getMonth());

  // Mantieni sincronizzati classi e display
  mesiBar.classList.add("visibile");
  mesiBar.style.display = "flex";
  miniCalendario.style.display = "block";
}


  }

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
        nomeCliente = clienteDoc.exists() ? clienteDoc.data().nome || "" : "";
        clientiCache[idCliente] = nomeCliente;
      }
      appuntamenti.push({ ora: dati.ora, nome: nomeCliente });
    }

    appuntamenti.sort((a, b) => a.ora.localeCompare(b.ora));

    if (appuntamenti.length === 0) {
      contenuto.innerHTML += "<p>Nessun appuntamento per questo giorno.</p>";
    } else {
      appuntamenti.forEach(app => {
        const div = document.createElement("div");
        div.className = "evento-giorno";
        div.textContent = `Ore ${app.ora} - ${app.nome}`;
        contenuto.appendChild(div);
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