// calendario.js — offline-first con Firestore + IndexedDB
import { db } from "./auth.js";
import {
  collection, query, where, getDocs, orderBy, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { abilitaSwipe } from "./swipe.js";
import { getAll, putMany } from "./storage.js";

function initCalendario() {
  // ---- DOM ----
  const griglia       = document.getElementById("grigliaCalendario");
  const meseCorrente  = document.getElementById("meseCorrente");
  const annoCorrente  = document.getElementById("annoCorrente");
  const mesiBar       = document.getElementById("mesiBar");
  const meseSwitch    = document.getElementById("meseSwitch");

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
  let dataCorrente = new Date(); // mese visualizzato
  let eventi = {};               // {"YYYY-MM-DD": [{ora, nome}, ...]}
  let clientiCache = {};         // cache {id: nome}

  // ---- Helpers ----
  const pad2 = n => String(n).padStart(2, "0");
  const isoFromDateLocal = d => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;

  function aggiornaHeader(){
    meseCorrente.textContent = dataCorrente.toLocaleDateString("it-IT", { month: "long" });
    annoCorrente.textContent = dataCorrente.getFullYear();
  }

  // ---- Barra mesi (ripristinata) ----
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

        const label = new Date(anno, mese, 1).toLocaleDateString("it-IT", { month: "short" });
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
          caricaEventi(dataCorrente.getFullYear(), dataCorrente.getMonth());
        });

        mesiBar.appendChild(span);
      }
    }

    // centra il mese attivo
    setTimeout(() => { currentSpan?.scrollIntoView({ behavior: "smooth", inline: "center" }); }, 50);
  }

  function evidenziaMeseAttivo(){
    const spans = mesiBar.querySelectorAll("span:not(.separatore-anno)");
    spans.forEach(s => s.classList.remove("attivo"));
    const attivo = [...spans].find(s =>
      Number(s.dataset.mese) === dataCorrente.getMonth() &&
      Number(s.dataset.anno) === dataCorrente.getFullYear()
    );
    if (attivo){
      attivo.classList.add("attivo");
      attivo.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }

  // Mostra/Nasconde barra mesi
  meseSwitch?.addEventListener("click", () => {
    mesiBar.classList.toggle("visibile");
    if (mesiBar.classList.contains("visibile")) evidenziaMeseAttivo();
  });

  // ---- Caricamento clienti ----
  async function caricaClientiCache() {
    const clienti = await getAll("clienti");
    clienti.forEach(c => { clientiCache[c.id] = c.nome || ""; });
  }

  // ---- Caricamento eventi ----
  async function caricaEventi(anno, mese){
    eventi = {};
    const start = new Date(anno, mese, 1);
    const end   = new Date(anno, mese+1, 1);

    if (navigator.onLine) {
      try {
        const qy = query(
          collection(db, "appuntamenti"),
          where("data", ">=", Timestamp.fromDate(start)),
          where("data", "<",  Timestamp.fromDate(end)),
          orderBy("data","asc")
        );
        const snapshot = await getDocs(qy);

        const docs = snapshot.docs.map(d => {
          const raw = d.data();
          let dataISO = "";
          if (raw.data?.toDate) {
            dataISO = raw.data.toDate().toISOString().slice(0,10);
          } else if (raw.data?.seconds) {
            const dd = new Date(raw.data.seconds * 1000);
            dataISO = dd.toISOString().slice(0,10);
          } else if (typeof raw.data === "string") {
            dataISO = raw.data.slice(0,10);
          }
          return {
            id: d.id,
            ...raw,
            dataISO
          };
        });

        await putMany("appuntamenti", docs);
        docs.forEach(d => inserisciEvento(d));
      } catch (err) {
        await caricaDaCache();
      }
    } else {
      await caricaDaCache();
    }

    generaGriglia(start);
  }

  function inserisciEvento(dati) {
    let iso = "";

    if (dati.data?.toDate) {
      iso = dati.data.toDate().toISOString().slice(0,10);
    } else if (dati.data?.seconds) {
      const d = new Date(dati.data.seconds * 1000);
      iso = d.toISOString().slice(0,10);
    } else if (typeof dati.dataISO === "string") {
      iso = dati.dataISO.slice(0,10);
    } else if (typeof dati.data === "string") {
      iso = dati.data.slice(0,10);
    } else if (dati.data instanceof Date) {
      iso = dati.data.toISOString().slice(0,10);
    }

    if (!iso) return;

    if (!eventi[iso]) eventi[iso] = [];
    const nomeCliente = clientiCache[dati.clienteId] || "";
    eventi[iso].push({ ora: dati.ora || "", nome: nomeCliente });
  }

  async function caricaDaCache() {
    const tutti = await getAll("appuntamenti");
    tutti.forEach(d => inserisciEvento(d));
  }

  function generaGriglia(start){
    griglia.innerHTML = "";

    const inizioSettimana = (start.getDay() === 0 ? 6 : start.getDay()-1);
    const inizio = new Date(start.getFullYear(), start.getMonth(), 1 - inizioSettimana);

    for (let i=0; i<42; i++) {
      const dataCella = new Date(inizio);
      dataCella.setDate(inizio.getDate() + i);

      const cella = document.createElement("div");
      cella.className = "cella";
      if (dataCella.getMonth() !== start.getMonth()) {
        cella.classList.add("fuori-mese");
      }

      if (
        dataCella.getFullYear() === oggi.getFullYear() &&
        dataCella.getMonth() === oggi.getMonth() &&
        dataCella.getDate() === oggi.getDate()
      ) {
        cella.classList.add("oggi");
      }

      const giornoSpan = document.createElement("div");
      giornoSpan.className = "giorno";
      giornoSpan.textContent = dataCella.getDate();
      cella.appendChild(giornoSpan);

      const iso = isoFromDateLocal(dataCella);
      const lista = eventi[iso] || [];
      lista.sort((a,b) => (a.ora || "").localeCompare(b.ora || ""));
      lista.slice(0, 4).forEach(ev => {
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

      cella.addEventListener("click", () => {
        window.location.href = `giorno.html?data=${iso}`;
      });

      griglia.appendChild(cella);
    }

    evidenziaMeseAttivo();
  }

  // ---- UI ----
  btnOggi.addEventListener("click", () => {
    dataCorrente = new Date();
    aggiornaHeader();
    evidenziaMeseAttivo();
    caricaEventi(dataCorrente.getFullYear(), dataCorrente.getMonth());
  });

  abilitaSwipe(
    griglia,
    () => { dataCorrente.setMonth(dataCorrente.getMonth() + 1); aggiornaHeader(); evidenziaMeseAttivo(); caricaEventi(dataCorrente.getFullYear(), dataCorrente.getMonth()); },
    () => { dataCorrente.setMonth(dataCorrente.getMonth() - 1); aggiornaHeader(); evidenziaMeseAttivo(); caricaEventi(dataCorrente.getFullYear(), dataCorrente.getMonth()); }
  );

  (async () => {
    await caricaClientiCache();
    aggiornaHeader();
    generaBarraMesiCompleta();
    evidenziaMeseAttivo();
    await caricaEventi(dataCorrente.getFullYear(), dataCorrente.getMonth());
  })();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCalendario, { once:true });
} else {
  initCalendario();
}