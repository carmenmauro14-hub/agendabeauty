// calendario.js — versione completa (fix date locali allineate con giorno.js)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, query, where, getDocs, doc, getDoc,
  orderBy, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { abilitaSwipe } from "./swipe.js";

document.addEventListener("DOMContentLoaded", () => {
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
  const griglia       = document.getElementById("grigliaCalendario");
  const meseCorrente  = document.getElementById("meseCorrente");
  const annoCorrente  = document.getElementById("annoCorrente");
  const mesiBar       = document.getElementById("mesiBar");

  // Pulsante “oggi” nella top-bar
  const btnOggi = document.createElement("button");
  const oggi    = new Date();
  btnOggi.textContent = oggi.getDate();
  btnOggi.classList.add("btn-oggi");
  document.querySelector(".top-bar").appendChild(btnOggi);

  // ---- Stato ----
  let dataCorrente = new Date();         // mese visualizzato
  let eventi = {};                       // {"YYYY-MM-DD": [{ora, nome}, ...]}

  // ---- Helpers DATE (tutte in locale!) ----
  function pad2(n){ return String(n).padStart(2, "0"); }

  /** ISO locale YYYY-MM-DD dalla Date (senza toISOString: evita shift di fuso) */
  function isoFromDateLocal(d){
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  }

  /** Inizio giorno (locale) */
  function startOfDay(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

  /** Timestamp da Date */
  const tsFromDate = (d) => Timestamp.fromDate(d);

  /** Parsing sicuro di "YYYY-MM-DD" in Date locale */
  function parseIsoLocal(iso){
    const [y,m,day] = iso.split("-").map(n => parseInt(n,10));
    return new Date(y, (m-1), day);
  }

  /** Range della griglia mese [start, end) con step 42 giorni, in locale */
  function monthGridRange(anno, mese){
    // primo giorno del mese
    const primo = new Date(anno, mese, 1);
    // getDay(): 0=dom → convertiamo a 1..7 (lun..dom)
    const dow = primo.getDay() === 0 ? 7 : primo.getDay();
    // inizio griglia (lunedì precedente/uguale)
    const inizioGriglia = new Date(primo);
    inizioGriglia.setDate(1 - (dow - 1));
    // fine griglia esclusiva
    const fineGriglia = new Date(inizioGriglia);
    fineGriglia.setDate(fineGriglia.getDate() + 42);

    return {
      start: tsFromDate(startOfDay(inizioGriglia)),
      end:   tsFromDate(startOfDay(fineGriglia)),   // esclusivo
      inizioGriglia
    };
  }

  // ---- Header ----
  function aggiornaHeader(){
    meseCorrente.textContent = dataCorrente.toLocaleDateString("it-IT", { month: "long" });
    annoCorrente.textContent = dataCorrente.getFullYear();
  }

  // ---- Caricamento eventi (range Timestamp, date coerenti locali) ----
  async function caricaEventiDaFirebase(anno, mese){
    eventi = {};

    const { start, end, inizioGriglia } = monthGridRange(anno, mese);

    const appuntamentiRef = collection(db, "appuntamenti");
    const qy = query(
      appuntamentiRef,
      where("data", ">=", start),
      where("data", "<",  end),
      orderBy("data", "asc")
    );

    const snapshot     = await getDocs(qy);
    const clientiCache = {};

    for (const docSnap of snapshot.docs){
      const dati = docSnap.data();

      // 1) Normalizza la data in Date (locale)
      let dateObj;
      if (dati.data && typeof dati.data.toDate === "function"){
        dateObj = dati.data.toDate();                 // Timestamp → Date (locale)
      } else if (typeof dati.data === "string"){
        // legacy: "YYYY-MM-DD"
        dateObj = parseIsoLocal(dati.data);           // evita interpretazioni UTC
      } else {
        continue;
      }

      // 2) Chiave locale coerente (YYYY-MM-DD)
      const key = isoFromDateLocal(dateObj);
      if (!eventi[key]) eventi[key] = [];

      // 3) Risolvi nome cliente (cache)
      const idCliente = dati.clienteId;
      let nomeCliente = clientiCache[idCliente];
      if (!nomeCliente){
        const clienteDoc = await getDoc(doc(db, "clienti", idCliente));
        nomeCliente = clienteDoc.exists() ? (clienteDoc.data().nome || "") : "";
        clientiCache[idCliente] = nomeCliente;
      }

      eventi[key].push({ ora: dati.ora || "", nome: nomeCliente });
    }

    generaGriglia(inizioGriglia);
  }

  // ---- Barra mesi (orizzontale) ----
  function generaBarraMesiCompleta(){
    mesiBar.innerHTML = "";
    let annoPrecedente = null;
    let currentSpan = null;

    for (let anno = 2020; anno <= 2050; anno++){
      for (let mese = 0; mese < 12; mese++){
        if (anno !== annoPrecedente){
          const separatore = document.createElement("span");
          separatore.textContent = anno;
          separatore.classList.add("separatore-anno");
          mesiBar.appendChild(separatore);
          annoPrecedente = anno;
        }

        const label = new Date(anno, mese).toLocaleDateString("it-IT", { month: "short" });
        const span  = document.createElement("span");
        span.textContent = label;
        span.dataset.mese = mese;
        span.dataset.anno = anno;

        if (mese === dataCorrente.getMonth() && anno === dataCorrente.getFullYear()){
          span.classList.add("attivo");
          currentSpan = span;
        }

        span.addEventListener("click", () => {
          dataCorrente = new Date(anno, mese, 1);
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

  function evidenziaMeseAttivo(){
    const spans = mesiBar.querySelectorAll("span");
    spans.forEach(s => s.classList.remove("attivo"));
    const attivo = [...spans].find(s =>
      s.dataset.mese == dataCorrente.getMonth() &&
      s.dataset.anno == dataCorrente.getFullYear()
    );
    if (attivo){
      attivo.classList.add("attivo");
      attivo.scrollIntoView({ behavior: "smooth", inline: "center" });
    }
  }

  // ---- Griglia 6×7 ----
  function generaGriglia(inizioGrigliaOpt){
    griglia.innerHTML = "";

    const anno = dataCorrente.getFullYear();
    const mese = dataCorrente.getMonth();

    const primoGiorno     = new Date(anno, mese, 1);
    const inizioSettimana = (primoGiorno.getDay() === 0 ? 6 : primoGiorno.getDay() - 1); // lun=0
    const giornoInizioGriglia = inizioGrigliaOpt
      ? new Date(inizioGrigliaOpt)
      : new Date(anno, mese, 1 - inizioSettimana);

    for (let i = 0; i < 42; i++){
      const dataCella = new Date(giornoInizioGriglia);
      dataCella.setDate(giornoInizioGriglia.getDate() + i);

      const giorno    = dataCella.getDate();
      const meseCella = dataCella.getMonth();
      const annoCella = dataCella.getFullYear();

      const cella = document.createElement("div");
      cella.className = "cella";
      if (meseCella !== mese) cella.style.backgroundColor = "#f2f2f2";

      // evidenzia oggi
      if (
        dataCella.getFullYear() === oggi.getFullYear() &&
        dataCella.getMonth() === oggi.getMonth() &&
        dataCella.getDate() === oggi.getDate()
      ){
        cella.classList.add("oggi");
      }

      const giornoSpan = document.createElement("div");
      giornoSpan.className = "giorno";
      giornoSpan.textContent = giorno;
      cella.appendChild(giornoSpan);

      const chiaveData = isoFromDateLocal(dataCella);
      const lista = eventi[chiaveData] || [];

      lista
        .sort((a,b) => (a.ora || "").localeCompare(b.ora || ""))
        .slice(0, 4)
        .forEach(ev => {
          const div = document.createElement("div");
          div.className = "evento";
          div.textContent = `Ore ${ev.ora} ${ev.nome}`;
          cella.appendChild(div);
        });

      if (lista.length > 4){
        const extra = document.createElement("div");
        extra.className = "evento";
        extra.textContent = `+${lista.length - 4} altri`;
        cella.appendChild(extra);
      }

      // click → apre vista giorno
      cella.addEventListener("click", () => {
        window.location.href = `giorno.html?data=${chiaveData}`;
      });

      griglia.appendChild(cella);
    }
  }

  // ---- UI ----
  document.getElementById("meseSwitch").addEventListener("click", () => {
    mesiBar.classList.toggle("visibile");
    if (mesiBar.classList.contains("visibile")) evidenziaMeseAttivo();
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
    () => { // verso sinistra → mese successivo
      dataCorrente.setMonth(dataCorrente.getMonth() + 1);
      aggiornaHeader();
      evidenziaMeseAttivo();
      caricaEventiDaFirebase(dataCorrente.getFullYear(), dataCorrente.getMonth());
    },
    () => { // verso destra → mese precedente
      dataCorrente.setMonth(dataCorrente.getMonth() - 1);
      aggiornaHeader();
      evidenziaMeseAttivo();
      caricaEventiDaFirebase(dataCorrente.getFullYear(), dataCorrente.getMonth());
    }
  );

  // ---- Avvio ----
  aggiornaHeader();
  generaBarraMesiCompleta();
  caricaEventiDaFirebase(dataCorrente.getFullYear(), dataCorrente.getMonth());
});