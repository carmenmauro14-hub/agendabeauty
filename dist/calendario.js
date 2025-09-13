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
  let dataCorrente = new Date();
  let eventi = {};
  let clientiCache = {};

  // ---- Helpers ----
  const pad2 = n => String(n).padStart(2, "0");
  const isoFromDateLocal = d => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;

  function aggiornaHeader(){
    meseCorrente.textContent = dataCorrente.toLocaleDateString("it-IT", { month: "long" });
    annoCorrente.textContent = dataCorrente.getFullYear();
  }

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
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        await putMany("appuntamenti", docs);
        docs.forEach(d => inserisciEvento(d));
      } catch {
        await caricaDaCache();
      }
    } else {
      await caricaDaCache();
    }

    generaGriglia(start);
  }

  // ---- Inserimento evento con supporto data.seconds e dataISO ----
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
      const giornoSpan = document.createElement("div");
      giornoSpan.className = "giorno";
      giornoSpan.textContent = dataCella.getDate();
      cella.appendChild(giornoSpan);

      const iso = isoFromDateLocal(dataCella);
      const lista = eventi[iso] || [];
      lista.forEach(ev => {
        const div = document.createElement("div");
        div.className = "evento";
        div.textContent = `Ore ${ev.ora} ${ev.nome}`;
        cella.appendChild(div);
      });

      cella.addEventListener("click", () => {
        window.location.href = `giorno.html?data=${iso}`;
      });

      griglia.appendChild(cella);
    }
  }

  // ---- UI ----
  btnOggi.addEventListener("click", () => {
    dataCorrente = new Date();
    aggiornaHeader();
    caricaEventi(dataCorrente.getFullYear(), dataCorrente.getMonth());
  });

  abilitaSwipe(
    griglia,
    () => { dataCorrente.setMonth(dataCorrente.getMonth() + 1); aggiornaHeader(); caricaEventi(dataCorrente.getFullYear(), dataCorrente.getMonth()); },
    () => { dataCorrente.setMonth(dataCorrente.getMonth() - 1); aggiornaHeader(); caricaEventi(dataCorrente.getFullYear(), dataCorrente.getMonth()); }
  );

  // ---- Avvio ----
  (async () => {
    await caricaClientiCache();
    aggiornaHeader();
    await caricaEventi(dataCorrente.getFullYear(), dataCorrente.getMonth());
  })();
}

// Avvio
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCalendario, { once:true });
} else {
  initCalendario();
}