import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { abilitaSwipe } from './swipe.js';

document.addEventListener("DOMContentLoaded", () => {
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

  const griglia = document.getElementById("grigliaCalendario");
  const meseCorrente = document.getElementById("meseCorrente");
  const annoCorrente = document.getElementById("annoCorrente");
  const mesiBar = document.getElementById("mesiBar");

  const btnOggi = document.createElement("button");
  const oggi = new Date();
  btnOggi.textContent = oggi.getDate();
  btnOggi.classList.add("btn-oggi");
  document.querySelector(".top-bar").appendChild(btnOggi);

  let dataCorrente = new Date();
  let eventi = {};

  async function caricaEventiDaFirebase(anno, mese) {
    eventi = {};

    const inizio = new Date(anno, mese, 1);
    const giorniTotali = 42;
    const inizioSettimana = inizio.getDay() === 0 ? 6 : inizio.getDay() - 1;
    const giornoInizioGriglia = new Date(inizio);
    giornoInizioGriglia.setDate(giornoInizioGriglia.getDate() - inizioSettimana);

    const giornoFineGriglia = new Date(giornoInizioGriglia);
    giornoFineGriglia.setDate(giornoFineGriglia.getDate() + giorniTotali - 1);

    const appuntamentiRef = collection(db, "appuntamenti");
    const q = query(
      appuntamentiRef,
      where("data", ">=", giornoInizioGriglia.toISOString().split("T")[0]),
      where("data", "<=", giornoFineGriglia.toISOString().split("T")[0])
    );

    const snapshot = await getDocs(q);
    const clientiCache = {};

    for (const docSnap of snapshot.docs) {
      const dati = docSnap.data();
      const key = dati.data;
      if (!eventi[key]) eventi[key] = [];

      let nomeCliente = "";
      const idCliente = dati.clienteId;

      if (clientiCache[idCliente]) {
        nomeCliente = clientiCache[idCliente];
      } else {
        const clienteDoc = await getDoc(doc(db, "clienti", idCliente));
        if (clienteDoc.exists()) {
          nomeCliente = clienteDoc.data().nome || "";
          clientiCache[idCliente] = nomeCliente;
        }
      }

      eventi[key].push({ ora: dati.ora, nome: nomeCliente });
    }

    generaGriglia();
  }

  function aggiornaHeader() {
    const opzioni = { month: 'long' };
    meseCorrente.textContent = dataCorrente.toLocaleDateString('it-IT', opzioni);
    annoCorrente.textContent = dataCorrente.getFullYear();
  }

  function generaBarraMesiCompleta() {
    mesiBar.innerHTML = "";
    let annoPrecedente = null;
    let currentSpan = null;

    for (let anno = 2020; anno <= 2050; anno++) {
      for (let mese = 0; mese < 12; mese++) {
        if (anno !== annoPrecedente) {
          const separatore = document.createElement("span");
          separatore.textContent = anno;
          separatore.classList.add("separatore-anno");
          mesiBar.appendChild(separatore);
          annoPrecedente = anno;
        }

        const data = new Date(anno, mese);
        const span = document.createElement("span");
        span.textContent = data.toLocaleDateString('it-IT', { month: 'short' });
        span.dataset.mese = mese;
        span.dataset.anno = anno;

        if (mese === dataCorrente.getMonth() && anno === dataCorrente.getFullYear()) {
          span.classList.add("attivo");
          currentSpan = span;
        }

        span.addEventListener("click", () => {
          dataCorrente = new Date(anno, mese);
          aggiornaHeader();
          evidenziaMeseAttivo();
          caricaEventiDaFirebase(anno, mese);
        });

        mesiBar.appendChild(span);
      }
    }

    setTimeout(() => {
      if (currentSpan) {
        currentSpan.scrollIntoView({ behavior: "smooth", inline: "center" });
      }
    }, 50);
  }

  function evidenziaMeseAttivo() {
    const spans = mesiBar.querySelectorAll("span");
    spans.forEach(s => s.classList.remove("attivo"));
    const attivo = [...spans].find(s =>
      s.dataset.mese == dataCorrente.getMonth() &&
      s.dataset.anno == dataCorrente.getFullYear()
    );
    if (attivo) {
      attivo.classList.add("attivo");
      attivo.scrollIntoView({ behavior: "smooth", inline: "center" });
    }
  }

  function generaGriglia() {
    griglia.innerHTML = "";

    const anno = dataCorrente.getFullYear();
    const mese = dataCorrente.getMonth();
    const primoGiorno = new Date(anno, mese, 1);
    const inizioSettimana = primoGiorno.getDay() === 0 ? 6 : primoGiorno.getDay() - 1;
    const giornoInizioGriglia = new Date(anno, mese, 1 - inizioSettimana);

    for (let i = 0; i < 42; i++) {
      const dataCella = new Date(giornoInizioGriglia);
      dataCella.setDate(giornoInizioGriglia.getDate() + i);

      const giorno = dataCella.getDate();
      const meseCella = dataCella.getMonth();
      const annoCella = dataCella.getFullYear();

      const cella = document.createElement("div");
      cella.className = "cella";
      if (meseCella !== mese) cella.style.backgroundColor = "#f2f2f2";

      if (
        dataCella.getFullYear() === oggi.getFullYear() &&
        dataCella.getMonth() === oggi.getMonth() &&
        dataCella.getDate() === oggi.getDate()
      ) {
        cella.classList.add("oggi");
      }

      const giornoSpan = document.createElement("div");
      giornoSpan.className = "giorno";
      giornoSpan.textContent = giorno;
      cella.appendChild(giornoSpan);

      const chiaveData = `${annoCella}-${String(meseCella + 1).padStart(2, "0")}-${String(giorno).padStart(2, "0")}`;
      const appuntamenti = eventi[chiaveData] || [];

      appuntamenti
        .sort((a, b) => a.ora.localeCompare(b.ora))
        .slice(0, 4)
        .forEach(ev => {
          const div = document.createElement("div");
          div.className = "evento";
          div.textContent = `Ore ${ev.ora} ${ev.nome}`;
          cella.appendChild(div);
        });

      if (appuntamenti.length > 4) {
        const extra = document.createElement("div");
        extra.className = "evento";
        extra.textContent = `+${appuntamenti.length - 4} altri`;
        cella.appendChild(extra);
      }

      // ✅ CLICK SU CELLA PER APRIRE GIORNO
      cella.addEventListener("click", () => {
        window.location.href = `giorno.html?data=${chiaveData}`;
      });

      griglia.appendChild(cella);
    }
  }

  document.getElementById("meseSwitch").addEventListener("click", () => {
    mesiBar.classList.toggle("visibile");
    if (mesiBar.classList.contains("visibile")) {
      evidenziaMeseAttivo();
    }
  });

  document.getElementById("aggiungiAppuntamentoBtn").addEventListener("click", () => {
    window.location.href = "nuovo-appuntamento.html";
  });

  btnOggi.addEventListener("click", () => {
    dataCorrente = new Date();
    aggiornaHeader();
    evidenziaMeseAttivo();
    caricaEventiDaFirebase(dataCorrente.getFullYear(), dataCorrente.getMonth());
  });

  abilitaSwipe(
    griglia,
    () => {
      dataCorrente.setMonth(dataCorrente.getMonth() + 1);
      aggiornaHeader();
      evidenziaMeseAttivo();
      caricaEventiDaFirebase(dataCorrente.getFullYear(), dataCorrente.getMonth());
    },
    () => {
      dataCorrente.setMonth(dataCorrente.getMonth() - 1);
      aggiornaHeader();
      evidenziaMeseAttivo();
      caricaEventiDaFirebase(dataCorrente.getFullYear(), dataCorrente.getMonth());
    }
  );

  aggiornaHeader();
  generaBarraMesiCompleta();
  caricaEventiDaFirebase(dataCorrente.getFullYear(), dataCorrente.getMonth());
});
