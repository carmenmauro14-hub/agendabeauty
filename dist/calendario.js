import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, query, where, getDocs, doc, getDoc,
  orderBy, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
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
  const db  = getFirestore(app);

  const griglia       = document.getElementById("grigliaCalendario");
  const meseCorrente  = document.getElementById("meseCorrente");
  const annoCorrente  = document.getElementById("annoCorrente");
  const mesiBar       = document.getElementById("mesiBar");

  const btnOggi = document.createElement("button");
  const oggi = new Date();
  btnOggi.textContent = oggi.getDate();
  btnOggi.classList.add("btn-oggi");
  document.querySelector(".top-bar").appendChild(btnOggi);

  let dataCorrente = new Date();
  let eventi = {}; // { "YYYY-MM-DD": [{ora, nome}, ...] }

  // ---------- Helpers Timestamp / Date ----------
  const isoFromDate = (d) => d.toISOString().slice(0,10);
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const tsFromDate = (d) => Timestamp.fromDate(d);

  // [start, end) per range Firestore
  function dayRange(date) {
    const s = startOfDay(date);
    const e = new Date(s);
    e.setDate(e.getDate() + 1);
    return { start: tsFromDate(s), end: tsFromDate(e) };
  }

  function monthGridRange(anno, mese) {
    // griglia 6x7 -> 42 giorni, partenza dal lun (ISO-8601)
    const primo = new Date(anno, mese, 1);
    const dow = primo.getDay() === 0 ? 7 : primo.getDay(); // 1..7 (lun..dom)
    const inizioGriglia = new Date(primo);
    inizioGriglia.setDate(1 - (dow - 1)); // porta a lunedì precedente/uguale
    const fineGriglia = new Date(inizioGriglia);
    fineGriglia.setDate(fineGriglia.getDate() + 42); // esclusivo

    return {
      start: tsFromDate(startOfDay(inizioGriglia)),
      end:   tsFromDate(startOfDay(fineGriglia)),     // esclusivo
      inizioGriglia,
    };
  }

  // ---------- Header ----------
  function aggiornaHeader() {
    meseCorrente.textContent = dataCorrente.toLocaleDateString('it-IT', { month: 'long' });
    annoCorrente.textContent = dataCorrente.getFullYear();
  }

  // ---------- Caricamento eventi (range su Timestamp) ----------
  async function caricaEventiDaFirebase(anno, mese) {
    eventi = {};

    const { start, end, inizioGriglia } = monthGridRange(anno, mese);

    const appuntamentiRef = collection(db, "appuntamenti");
    const qy = query(
      appuntamentiRef,
      where("data", ">=", start),
      where("data", "<",  end),
      orderBy("data", "asc")
    );

    const snapshot = await getDocs(qy);
    const clientiCache = {};

    for (const docSnap of snapshot.docs) {
      const dati = docSnap.data();

      // data come Timestamp → Date → ISO
      let dateObj;
      if (dati.data && typeof dati.data.toDate === "function") {
        dateObj = dati.data.toDate();
      } else if (typeof dati.data === "string") {
        // fallback legacy: supporto stringa "YYYY-MM-DD"
        dateObj = new Date(dati.data + "T00:00:00");
      } else {
        continue;
      }
      const key = isoFromDate(dateObj);

      if (!eventi[key]) eventi[key] = [];

      // risolvi nome cliente con cache
      const idCliente = dati.clienteId;
      let nomeCliente = clientiCache[idCliente];
      if (!nomeCliente) {
        const clienteDoc = await getDoc(doc(db, "clienti", idCliente));
        nomeCliente = clienteDoc.exists() ? (clienteDoc.data().nome || "") : "";
        clientiCache[idCliente] = nomeCliente;
      }

      eventi[key].push({ ora: dati.ora || "", nome: nomeCliente });
    }

    generaGriglia(inizioGriglia);
  }

  // ---------- Barra mesi ----------
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

        const label = new Date(anno, mese).toLocaleDateString('it-IT', { month: 'short' });
        const span = document.createElement("span");
        span.textContent = label;
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
      if (currentSpan) currentSpan.scrollIntoView({ behavior: "smooth", inline: "center" });
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

  // ---------- Griglia 6x7 ----------
  function generaGriglia(inizioGrigliaOpt) {
    griglia.innerHTML = "";

    const anno = dataCorrente.getFullYear();
    const mese = dataCorrente.getMonth();

    const primoGiorno = new Date(anno, mese, 1);
    const inizioSettimana = primoGiorno.getDay() === 0 ? 6 : primoGiorno.getDay() - 1;
    const giornoInizioGriglia = inizioGrigliaOpt
      ? new Date(inizioGrigliaOpt)
      : new Date(anno, mese, 1 - inizioSettimana);

    for (let i = 0; i < 42; i++) {
      const dataCella = new Date(giornoInizioGriglia);
      dataCella.setDate(giornoInizioGriglia.getDate() + i);

      const giorno    = dataCella.getDate();
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
      const lista = eventi[chiaveData] || [];

      lista
        .sort((a, b) => (a.ora || "").localeCompare(b.ora || ""))
        .slice(0, 4)
        .forEach(ev => {
          const div = document.createElement("div");
          div.className = "evento";
          div.textContent = `Ore ${ev.ora} ${ev.nome}`;
          cella.appendChild(div);
        });

      if (lista.length > 4) {
        const extra = document.createElement("div");
        extra.className = "evento";
        extra.textContent = `+${lista.length - 4} altri`;
        cella.appendChild(extra);
      }

      // click → vai alla vista giorno
      cella.addEventListener("click", () => {
        window.location.href = `giorno.html?data=${chiaveData}`;
      });

      griglia.appendChild(cella);
    }
  }

  // ---------- UI: toggle mesi bar ----------
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

  // Swipe mese ← →
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

  // init
  aggiornaHeader();
  generaBarraMesiCompleta();
  caricaEventiDaFirebase(dataCorrente.getFullYear(), dataCorrente.getMonth());
});