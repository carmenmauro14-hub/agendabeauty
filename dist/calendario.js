// calendario.js — offline-first con Firestore + IndexedDB
import { db } from "./auth.js";
import {
  collection, query, where, getDocs, orderBy, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { abilitaSwipe } from "./swipe.js";
import { getAll, putMany } from "./storage.js";

function initCalendario() {
  console.log("[calendario] init"); // debug

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
  let dataCorrente = new Date(); // mese visualizzato
  let eventi = {};               // {"YYYY-MM-DD": [{ora, nome}, ...]}
  let clientiCache = {};         // cache {id: nome}

  // ---- Helpers ----
  const pad2 = n => String(n).padStart(2, "0");
  const isoFromDateLocal = d => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const tsFromDate = d => Timestamp.fromDate(d);

  function monthGridRange(anno, mese){
    const primo = new Date(anno, mese, 1);
    const dow = primo.getDay() === 0 ? 7 : primo.getDay();
    const inizioGriglia = new Date(primo);
    inizioGriglia.setDate(1 - (dow - 1));
    const fineGriglia = new Date(inizioGriglia);
    fineGriglia.setDate(fineGriglia.getDate() + 42);
    return { start: tsFromDate(startOfDay(inizioGriglia)), end: tsFromDate(startOfDay(fineGriglia)), inizioGriglia };
  }

  function aggiornaHeader(){
    meseCorrente.textContent = dataCorrente.toLocaleDateString("it-IT", { month: "long" });
    annoCorrente.textContent = dataCorrente.getFullYear();
  }

  // ---- pickDate (allineato a giorno.js) ----
  function pickDate(d) {
    if (d && typeof d.toDate === "function") {
      const dateObj = d.toDate();
      return { dateObj, iso: dateObj.toISOString().slice(0,10) };
    }
    if (typeof d === "string") {
      const dateObj = new Date(d.length === 10 ? d + "T00:00:00" : d);
      return { dateObj, iso: dateObj.toISOString().slice(0,10) };
    }
    if (d instanceof Date) {
      return { dateObj: d, iso: d.toISOString().slice(0,10) };
    }
    return { dateObj: null, iso: "" };
  }

  // ---- Caricamento clienti ----
  async function caricaClientiCache() {
    const clienti = await getAll("clienti");
    clienti.forEach(c => {
      clientiCache[c.id] = c.nome || "";
    });
  }

  // ---- Caricamento appuntamenti ----
  async function caricaEventiDaFirebase(anno, mese){
    eventi = {};
    const { start, end, inizioGriglia } = monthGridRange(anno, mese);

    try {
      // 🔹 Firestore
      const qy = query(
        collection(db, "appuntamenti"),
        where("data", ">=", start),
        where("data", "<",  end),
        orderBy("data","asc")
      );
      const snapshot = await getDocs(qy);
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      // aggiorna cache
      await putMany("appuntamenti", docs);

      // prepara eventi
      docs.forEach(dati => {
        const { dateObj, iso } = pickDate(dati.data);
        if (!dateObj) return;
        if (!eventi[iso]) eventi[iso] = [];
        const nomeCliente = clientiCache[dati.clienteId] || "";
        eventi[iso].push({ ora: dati.ora || "", nome: nomeCliente });
      });

      generaGriglia(inizioGriglia);
    } catch (err) {
      console.warn("[calendario] offline, uso cache:", err);

      // 🔹 Offline: prendi da IndexedDB
      const tutti = await getAll("appuntamenti");
      tutti.forEach(dati => {
        const { dateObj, iso } = pickDate(dati.data);
        if (!dateObj) return;
        if (!eventi[iso]) eventi[iso] = [];
        const nomeCliente = clientiCache[dati.clienteId] || "";
        eventi[iso].push({ ora: dati.ora || "", nome: nomeCliente });
      });

      generaGriglia(inizioGriglia);
    }
  }

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

  function generaGriglia(inizioGrigliaOpt){
    griglia.innerHTML = "";
    const anno = dataCorrente.getFullYear();
    const mese = dataCorrente.getMonth();

    const primoGiorno     = new Date(anno, mese, 1);
    const inizioSettimana = (primoGiorno.getDay() === 0 ? 6 : primoGiorno.getDay() - 1);
    const giornoInizioGriglia = inizioGrigliaOpt ? new Date(inizioGrigliaOpt) : new Date(anno, mese, 1 - inizioSettimana);

    for (let i = 0; i < 42; i++){
      const dataCella = new Date(giornoInizioGriglia);
      dataCella.setDate(giornoInizioGriglia.getDate() + i);

      const giorno    = dataCella.getDate();
      const meseCella = dataCella.getMonth();

      const cella = document.createElement("div");
      cella.className = "cella";
      if (meseCella !== mese) cella.style.backgroundColor = "#f2f2f2";

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
  document.getElementById("meseSwitch")?.addEventListener("click", () => {
    mesiBar.classList.toggle("visibile");
    if (mesiBar.classList.contains("visibile")) evidenziaMeseAttivo();
  });

  document.getElementById("aggiungiAppuntamentoBtn")?.addEventListener("click", () => {
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
    () => { dataCorrente.setMonth(dataCorrente.getMonth() + 1); aggiornaHeader(); evidenziaMeseAttivo(); caricaEventiDaFirebase(dataCorrente.getFullYear(), dataCorrente.getMonth()); },
    () => { dataCorrente.setMonth(dataCorrente.getMonth() - 1); aggiornaHeader(); evidenziaMeseAttivo(); caricaEventiDaFirebase(dataCorrente.getFullYear(), dataCorrente.getMonth()); }
  );

  // ---- Avvio ----
  (async () => {
    await caricaClientiCache(); // carica clienti in cache
    aggiornaHeader();
    generaBarraMesiCompleta();
    caricaEventiDaFirebase(dataCorrente.getFullYear(), dataCorrente.getMonth());
  })();
}

// 👇 Avvio robusto: se il DOM è già pronto, parte subito
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCalendario, { once: true });
} else {
  initCalendario();
}