// calendario.js — con salvataggio offline in IndexedDB
import { db } from "./auth.js";
import {
  collection, query, where, getDocs, doc, getDoc,
  orderBy, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { abilitaSwipe } from "./swipe.js";
import { putMany } from "./storage.js";   // 👈 aggiunto per la cache

document.addEventListener("DOMContentLoaded", () => {
  // ---- DOM ----
  const griglia       = document.getElementById("grigliaCalendario");
  const meseCorrente  = document.getElementById("meseCorrente");
  const annoCorrente  = document.getElementById("annoCorrente");
  const mesiBar       = document.getElementById("mesiBar");

  // Pulsante “oggi”
  const topBar = document.querySelector(".top-bar");
  let btnOggi = topBar?.querySelector(".btn-oggi");
  if (!btnOggi) {
    btnOggi = document.createElement("button");
    btnOggi.classList.add("btn-oggi");
    topBar?.appendChild(btnOggi);
  }
  const oggi = new Date();
  btnOggi.textContent = oggi.getDate();

  // ---- Stato ----
  let dataCorrente = new Date();         // mese visualizzato
  let eventi = {};                       // {"YYYY-MM-DD": [{ora, nome}, ...]}

  // ---- Helpers ----
  function pad2(n){ return String(n).padStart(2, "0"); }
  function isoFromDateLocal(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
  function parseIsoLocal(iso){ const [y,m,day] = iso.split("-").map(n => parseInt(n,10)); return new Date(y, (m-1), day); }

  function aggiornaHeader(){
    meseCorrente.textContent = dataCorrente.toLocaleDateString("it-IT", { month: "long" });
    annoCorrente.textContent = dataCorrente.getFullYear();
  }

  // ---- Caricamento eventi dal mese ----
  async function caricaEventiDaFirebase(anno, mese){
    eventi = {};
    const start = new Date(anno, mese, 1);
    const end   = new Date(anno, mese+1, 1);

    const appuntamentiRef = collection(db, "appuntamenti");
    const qy = query(
      appuntamentiRef,
      where("data", ">=", Timestamp.fromDate(start)),
      where("data", "<",  Timestamp.fromDate(end)),
      orderBy("data", "asc")
    );

    const snapshot = await getDocs(qy);
    const clientiCache = {};
    const docsForCache = [];   // 👈 raccolta normalizzata per IndexedDB

    for (const docSnap of snapshot.docs){
      const dati = docSnap.data();

      // normalizza data
      let dateObj;
      if (dati.data?.toDate) {
        dateObj = dati.data.toDate();
      } else if (dati.data?.seconds) {
        dateObj = new Date(dati.data.seconds * 1000);
      } else if (typeof dati.data === "string") {
        dateObj = parseIsoLocal(dati.data);
      }
      if (!dateObj) continue;

      const dataISO = dateObj.toISOString().slice(0,10);
      if (!eventi[dataISO]) eventi[dataISO] = [];

      const idCliente = dati.clienteId;
      let nomeCliente = clientiCache[idCliente];
      if (!nomeCliente && idCliente) {
        const clienteDoc = await getDoc(doc(db, "clienti", idCliente));
        nomeCliente = clienteDoc.exists() ? (clienteDoc.data().nome || "") : "";
        clientiCache[idCliente] = nomeCliente;
      }

      eventi[dataISO].push({ ora: dati.ora || "", nome: nomeCliente });

      // 🔹 Prepara oggetto coerente con giorno.js
      docsForCache.push({
        id: docSnap.id,
        ...dati,
        dataISO
      });
    }

    // 🔹 salva tutto il mese in cache
    if (docsForCache.length) {
      await putMany("appuntamenti", docsForCache);
    }

    generaGriglia(new Date(anno, mese, 1));
  }

  // ---- Barra mesi ----
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

    setTimeout(() => { currentSpan?.scrollIntoView({ behavior: "smooth", inline: "center" }); }, 50);
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

  // ---- Griglia ----
  function generaGriglia(inizioGriglia){
    griglia.innerHTML = "";

    for (let i = 0; i < 42; i++){
      const dataCella = new Date(inizioGriglia);
      dataCella.setDate(inizioGriglia.getDate() + i);

      const giorno = dataCella.getDate();
      const meseCella = dataCella.getMonth();

      const cella = document.createElement("div");
      cella.className = "cella";
      if (meseCella !== dataCorrente.getMonth()) cella.classList.add("fuori-mese");

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

      lista.sort((a,b) => (a.ora || "").localeCompare(b.ora || ""))
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

  btnOggi.addEventListener("click", () => {
    dataCorrente = new Date();
    aggiornaHeader();
    evidenziaMeseAttivo();
    caricaEventiDaFirebase(dataCorrente.getFullYear(), dataCorrente.getMonth());
  });

  // Swipe mese ← →
  abilitaSwipe(
    griglia,
    () => { dataCorrente.setMonth(dataCorrente.getMonth() + 1); aggiornaHeader(); evidenziaMeseAttivo(); caricaEventiDaFirebase(dataCorrente.getFullYear(), dataCorrente.getMonth()); },
    () => { dataCorrente.setMonth(dataCorrente.getMonth() - 1); aggiornaHeader(); evidenziaMeseAttivo(); caricaEventiDaFirebase(dataCorrente.getFullYear(), dataCorrente.getMonth()); }
  );

  // ---- Avvio ----
  aggiornaHeader();
  generaBarraMesiCompleta();
  caricaEventiDaFirebase(dataCorrente.getFullYear(), dataCorrente.getMonth());
});