// calendario.js — versione corretta: riusa app da auth.js (no doppia init), 10.12.2
import { app } from "./auth.js";
import {
  getFirestore, collection, query, where, getDocs, doc, getDoc,
  orderBy, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { abilitaSwipe } from "./swipe.js";

const db = getFirestore(app);

document.addEventListener("DOMContentLoaded", () => {
  // ---- DOM ----
  const griglia       = document.getElementById("grigliaCalendario");
  const meseCorrente  = document.getElementById("meseCorrente");
  const annoCorrente  = document.getElementById("annoCorrente");
  const mesiBar       = document.getElementById("mesiBar");

  // Pulsante “oggi” nella top-bar (occhio: se in HTML esiste già, evita doppio bottone)
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

  // ---- Helpers DATE (tutte in locale!) ----
  function pad2(n){ return String(n).padStart(2, "0"); }
  function isoFromDateLocal(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
  function startOfDay(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  const tsFromDate = (d) => Timestamp.fromDate(d);
  function parseIsoLocal(iso){ const [y,m,day] = iso.split("-").map(n => parseInt(n,10)); return new Date(y, (m-1), day); }

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

  // ==== CARICAMENTO EVENTI ===================================================
  async function caricaEventiDaFirebase(anno, mese){
    eventi = {};
    const { start, end, inizioGriglia } = monthGridRange(anno, mese);

    const appuntamentiRef = collection(db, "appuntamenti");
    const qy = query(appuntamentiRef, where("data", ">=", start), where("data", "<",  end), orderBy("data", "asc"));

    const snapshot     = await getDocs(qy);
    const clientiCache = {};

    for (const docSnap of snapshot.docs){
      const dati = docSnap.data();

      let dateObj;
      if (dati.data && typeof dati.data.toDate === "function"){
        dateObj = dati.data.toDate();
      } else if (typeof dati.data === "string"){
        dateObj = parseIsoLocal(dati.data);
      } else {
        continue;
      }

      const key = isoFromDateLocal(dateObj);
      if (!eventi[key]) eventi[key] = [];

      // 👇 Gestione appuntamenti orfani (senza clienteId)
      const idCliente = dati.clienteId;
      let nomeCliente = "Cliente eliminato"; // fallback di default

      if (idCliente) {
        nomeCliente = clientiCache[idCliente];
        if (!nomeCliente){
          try {
            const clienteDoc = await getDoc(doc(db, "clienti", idCliente));
            nomeCliente = clienteDoc.exists() ? (clienteDoc.data().nome || "") : "Cliente eliminato";
          } catch {
            nomeCliente = "Cliente eliminato";
          }
          clientiCache[idCliente] = nomeCliente;
        }
      }

      eventi[key].push({ ora: dati.ora || "", nome: nomeCliente });
    }

    generaGriglia(inizioGriglia);
  }

  // ==== BARRA MESI ===========================================================
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

  // ==== GRIGLIA CALENDARIO ===================================================
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

  // ==== UI ==================================================================
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
    () => { dataCorrente.setMonth(dataCorrente.getMonth() + 1); aggiornaHeader(); evidenziaMeseAttivo(); caricaEventiDaFirebase(dataCorrente.getFullYear(), dataCorrente.getMonth()); },
    () => { dataCorrente.setMonth(dataCorrente.getMonth() - 1); aggiornaHeader(); evidenziaMeseAttivo(); caricaEventiDaFirebase(dataCorrente.getFullYear(), dataCorrente.getMonth()); }
  );

  // ---- Avvio ----
  aggiornaHeader();
  generaBarraMesiCompleta();
  caricaEventiDaFirebase(dataCorrente.getFullYear(), dataCorrente.getMonth());
});