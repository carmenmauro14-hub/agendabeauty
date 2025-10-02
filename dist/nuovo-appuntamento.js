// ─── Firebase: riuso dell'app inizializzata in auth.js ────────────
import { app } from "./auth.js";
import {
  getFirestore, collection, getDocs, addDoc, updateDoc, getDoc, doc, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { abilitaSwipeVerticale } from "./swipe.js";

const db = getFirestore(app);

// ─── Parametri URL ────────────────────────────────────────────────
const urlParams        = new URLSearchParams(location.search);
const editId           = urlParams.get("edit");
const presetClienteId  = urlParams.get("cliente");
const presetDataISO    = urlParams.get("data");

// ─── Utils ─────────────────────────────────────────────────────────
function setPageTitle(text) {
  if (wizardTitle) wizardTitle.textContent = text;
  document.title = text;
}
function lockBodyScroll(lock) {
  document.documentElement.style.overflow = lock ? "hidden" : "";
  document.body.style.overflow = lock ? "hidden" : "";
}

// ─── Riferimenti DOM ───────────────────────────────────────────────
const wizardTitle        = document.getElementById("wizardTitle");
const step1              = document.getElementById("step1");
const step2              = document.getElementById("step2");
const step3              = document.getElementById("step3");

const btnToStep2         = document.getElementById("toStep2");
const btnBackToStep1     = document.getElementById("backToStep1");
const btnToStep3         = document.getElementById("toStep3");
const btnBackToStep2     = document.getElementById("backToStep2");
const btnSalva           = document.getElementById("salvaAppuntamento");
const btnCancel          = document.getElementById("cancelWizard");

const inpData            = document.getElementById("dataAppuntamento");
const inpOraHH           = document.getElementById("oraAppuntamentoHH");
const inpOraMM           = document.getElementById("oraAppuntamentoMM");
const wrapperTratt       = document.getElementById("trattamentiWrapper");

const clienteIdHidden    = document.getElementById("clienteId");
const clienteSelezionato = document.getElementById("clienteSelezionato");
const openRubrica        = document.getElementById("openRubrica");
const rubricaModal       = document.getElementById("rubricaModal");
const clientListPicker   = document.getElementById("clientListPicker");
const letterNavPicker    = document.getElementById("letterNavPicker");
const rubricaPanel       = document.querySelector("#rubricaModal .rubrica-container");
const btnRubricaClose    = document.getElementById("rubricaClose");
const rubricaGrabber     = document.getElementById("rubricaGrabber");
const rubricaScroll      = document.getElementById("rubricaScroll");

const openRubricaField   = document.getElementById("openRubricaField");
const pickerValue        = document.getElementById("pickerValue");
const pickerPlaceholder  = document.getElementById("pickerPlaceholder");

const pageModal   = document.querySelector(".page-modal");
const sheetEl     = document.getElementById("wizardSheet");
const sheetHeader = document.querySelector(".sheet-header");
const sheetClose  = document.getElementById("sheetClose");

// Mini-modal nuovo cliente
const btnOpenAddCliente  = document.getElementById("openAddClienteWizard");
const addClienteModal    = document.getElementById("addClienteModal");
const btnCloseAddCliente = document.getElementById("closeAddCliente");
const addClienteForm     = document.getElementById("addClienteForm");
const inpNomeCliente     = document.getElementById("addClienteNome");
const inpTelCliente      = document.getElementById("addClienteTel");

// ─── Chiusura wizard (X, Annulla, swipe maniglia) ─────────────────
function chiudiWizard() {
  // se per caso la rubrica fosse aperta, chiudila prima
  if (rubricaModal && rubricaModal.style.display === "flex") {
    rubricaModal.style.display = "none";
  }
  // poi esci dal wizard
  if (history.length > 1) history.back();
  else location.href = "calendario.html";
}

// X in alto a destra
sheetClose?.addEventListener("click", chiudiWizard);

// Bottone "Annulla"
btnCancel?.addEventListener("click", chiudiWizard);

// Swipe down dalla maniglia della sheet
if (sheetHeader) {
  // chiudi sullo swipe verso il basso
  abilitaSwipeVerticale(sheetHeader, null, chiudiWizard, true, 45);
}

// ─── Stato ─────────────────────────────────────────────────────────
let apptData     = null;
let clientiCache = null;
let rubricaCloseTimer = null; // fallback per chiusura modale rubrica

// ─── Rubrica (apri/chiudi) ─────────────────────────────────────────
function apriRubrica() {
  (async () => {
    if (!clientiCache) {
      const snap = await getDocs(collection(db, "clienti"));
      clientiCache = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a,b) => (a.nome || "").localeCompare(b.nome || "", "it"));
    }
    renderRubrica(clientiCache);

    // ✅ reset eventuali classi pendenti
    if (rubricaPanel?.classList.contains("swipe-out-down")) {
      rubricaPanel.classList.remove("swipe-out-down");
      rubricaPanel.style.transform = "translateY(0)";
    }
    // pulisci eventuale timeout pendente
    if (rubricaCloseTimer) {
      clearTimeout(rubricaCloseTimer);
      rubricaCloseTimer = null;
    }
    pageModal.style.display = "none"; // nasconde il wizard sotto
    rubricaModal.style.display = "flex";
    if (rubricaScroll) rubricaScroll._lastY = undefined;
    lockBodyScroll(true);
  })();
}

function chiudiRubricaAnimata() {
  if (!rubricaPanel) {
    rubricaModal.style.display = "none";
    lockBodyScroll(false);
    if (rubricaScroll) rubricaScroll._lastY = undefined;
    return;
  }

  const reset = () => {
    rubricaPanel.removeEventListener("transitionend", reset);
    if (rubricaCloseTimer) {
      clearTimeout(rubricaCloseTimer);
      rubricaCloseTimer = null;
    }
    rubricaPanel.classList.remove("swipe-out-down");
    rubricaPanel.style.transform = "translateY(0)";
    rubricaModal.style.display = "none";
    pageModal.style.display = "flex"; // riattiva il wizard
    if (rubricaScroll) rubricaScroll._lastY = undefined;
    lockBodyScroll(false);
  };

  // forza reflow per sicurezza
  rubricaPanel.offsetHeight;

  rubricaPanel.addEventListener("transitionend", reset, { once: true });
  rubricaPanel.classList.add("swipe-out-down");

  // fallback timeout se transitionend non arriva
  rubricaCloseTimer = setTimeout(reset, 400);
}

openRubricaField?.addEventListener("click", apriRubrica);
btnRubricaClose?.addEventListener("click", chiudiRubricaAnimata);
rubricaModal?.addEventListener("click", (e) => { if (e.target === rubricaModal) chiudiRubricaAnimata(); });

if (rubricaGrabber) {
  abilitaSwipeVerticale(rubricaGrabber, null, chiudiRubricaAnimata, true, 45);
}

// ─── Render rubrica ────────────────────────────────────────────────
function renderRubrica(clienti) {
  const groups = {};
  clienti.forEach(c => {
    const L = (c.nome ? c.nome.charAt(0) : "#").toUpperCase();
    (groups[L] = groups[L] || []).push(c);
  });
  const letters = Object.keys(groups).sort((a,b)=>a.localeCompare(b,"it"));

  clientListPicker.innerHTML = "";
  letters.forEach(L => {
    const sec = document.createElement("li");
    sec.textContent = L; sec.className = "section"; sec.id = "picker-letter-" + L;
    clientListPicker.appendChild(sec);

    groups[L].forEach(c => {
      const li = document.createElement("li");
      li.className = "item";
      li.textContent = c.nome || "(senza nome)";
      li.onclick = () => selezionaCliente(c.id, c.nome || "(senza nome)");
      clientListPicker.appendChild(li);
    });
  });

  letterNavPicker.innerHTML = "";
  letters.forEach(L => {
    const el = document.createElement("span");
    el.textContent = L;
    el.onclick = () => document.getElementById("picker-letter-" + L)?.scrollIntoView({ behavior:"smooth" });
    letterNavPicker.appendChild(el);
  });
}

function selezionaCliente(id, nome) {
  clienteIdHidden.value = id;
  clienteSelezionato.textContent = nome;
  pickerValue.textContent = nome;
  pickerPlaceholder.style.display = "none";
  openRubricaField.classList.remove("empty");
  chiudiRubricaAnimata();
}

// ─── Mini-modal nuovo cliente ─────────────────────────────────────
btnOpenAddCliente?.addEventListener("click", () => { addClienteModal.style.display = "flex"; inpNomeCliente?.focus(); });
btnCloseAddCliente?.addEventListener("click", () => { addClienteModal.style.display = "none"; });

addClienteForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = inpNomeCliente.value.trim();
  const telefono = inpTelCliente.value.trim();
  if (!nome) { alert("Inserisci il nome del cliente"); return; }
  try {
    const docRef = await addDoc(collection(db, "clienti"), { nome, telefono });
    selezionaCliente(docRef.id, nome);
    addClienteForm.reset();
    addClienteModal.style.display = "none";
  } catch (err) {
    console.error("Errore durante salvataggio cliente:", err);
    alert("Errore nel salvataggio del cliente.");
  }
});

// ─── Trattamenti ───────────────────────────────────────────────────
const iconeDisponibili = [
  "makeup_sposa", "makeup", "microblading", "extension_ciglia",
  "laminazione_ciglia", "filo_arabo", "architettura_sopracciglia",
  "airbrush_sopracciglia", "laser"
];
function trovaIcona(nome) {
  const norm = (nome || "").toLowerCase().replace(/\s+/g, "_");
  for (const base of iconeDisponibili) if (norm.includes(base)) return `icones_trattamenti/${base}.png`;
  return "icone_uniformate_colore/setting.png";
}
async function caricaTrattamenti(selectedMap = null) {
  wrapperTratt.innerHTML = "";
  try {
    const snap = await getDocs(collection(db, "trattamenti"));
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                           .sort((a,b) => (a.nome || "").localeCompare(b.nome || "", "it"));
    for (const t of lista) {
      const icona = t.icona || trovaIcona(t.nome);
      const prezzoListino = Number(t.prezzo) || 0;
      const row = document.createElement("div");
      row.classList.add("trattamento-row");
      const checked   = selectedMap ? selectedMap.has(t.nome) : false;
      const prezzoSel = selectedMap && selectedMap.has(t.nome) ? Number(selectedMap.get(t.nome)) || 0 : prezzoListino;
      row.innerHTML = `
        <label>
          <input type="checkbox" class="trattamento-checkbox" ${checked ? "checked" : ""}
                 data-nome="${t.nome}" data-prezzo="${prezzoListino}" data-icona="${icona}">
          <img src="${icona}" alt="${t.nome}" class="icona-trattamento">
          ${t.nome}
        </label>
        <input type="number" class="prezzo-input" placeholder="€${prezzoListino}" value="${prezzoSel}" min="0" step="0.01" inputmode="decimal">
      `;
      wrapperTratt.appendChild(row);
    }
  } catch (e) {
    console.error("Errore caricamento trattamenti:", e);
    alert("Errore nel caricamento dei trattamenti.");
  }
}

// ─── Navigazione step ──────────────────────────────────────────────
btnToStep2?.addEventListener("click", () => {
  if (!clienteIdHidden.value) return alert("Seleziona un cliente");
  step1.style.display = "none"; step2.style.display = "block";
});
btnBackToStep1?.addEventListener("click", () => { step2.style.display = "none"; step1.style.display = "block"; });
btnToStep3?.addEventListener("click", () => {
  if (!(inpData.value && inpOraHH.value !== "" && inpOraMM.value !== "")) return alert("Inserisci data e ora");
  step2.style.display = "none"; step3.style.display = "block";
});
btnBackToStep2?.addEventListener("click", () => { step3.style.display = "none"; step2.style.display = "block"; });

// ─── Salvataggio appuntamento ──────────────────────────────────────
btnSalva?.addEventListener("click", async () => {
  const clienteId = clienteIdHidden.value;
  const dataISO   = inpData.value;
  if (!clienteId) return alert("Seleziona un cliente");
  if (!(dataISO && inpOraHH.value !== "" && inpOraMM.value !== "")) return alert("Inserisci data e ora");

  const hh = String(Math.min(parseInt(inpOraHH.value || "0", 10), 23)).padStart(2, "0");
  const mm = String(Math.min(parseInt(inpOraMM.value || "0", 10), 59)).padStart(2, "0");
  const ora = `${hh}:${mm}`;

  const selected = [...document.querySelectorAll(".trattamento-checkbox:checked")];
  if (!selected.length) return alert("Seleziona almeno un trattamento");

  // dup check
  const appuntamentiSnap = await getDocs(collection(db, "appuntamenti"));
  const appuntamenti = appuntamentiSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const esiste = appuntamenti.some(app => app.dataISO === dataISO && app.ora === ora && (!editId || app.id !== editId));
  if (esiste) return alert(`Hai già un appuntamento alle ${ora} del ${dataISO}`);

  const trattamenti = selected.map(cb => {
    const row = cb.closest(".trattamento-row");
    const prezzoVal = parseFloat(row.querySelector(".prezzo-input").value);
    return { nome: cb.dataset.nome, prezzo: Number.isFinite(prezzoVal) ? prezzoVal : 0,
             icona: cb.dataset.icona || trovaIcona(cb.dataset.nome) };
  });

  const dateMidnight = new Date(dataISO + "T00:00:00");
  const dataTs = Timestamp.fromDate(dateMidnight);

  const [hhNum, mmNum] = ora.split(":").map(n => parseInt(n,10));
  const dateWithTime = new Date(dateMidnight);
  dateWithTime.setHours(hhNum || 0, mmNum || 0, 0, 0);
  const dateTime = Timestamp.fromDate(dateWithTime);

  try {
    if (editId) {
      await updateDoc(doc(db, "appuntamenti", editId), { clienteId, data: dataTs, dataISO, ora, dateTime, trattamenti });
      alert("Appuntamento aggiornato!");
    } else {
      await addDoc(collection(db, "appuntamenti"), { clienteId, data: dataTs, dataISO, ora, dateTime, trattamenti });
      alert("Appuntamento salvato con successo!");
    }
    location.href = "calendario.html";
  } catch (err) {
    console.error("Errore salvataggio:", err);
    alert("Errore durante il salvataggio.");
  }
});

// ─── Avvio ─────────────────────────────────────────────────────────
(async function init() {
  setPageTitle(editId ? "Modifica Appuntamento" : "Nuovo Appuntamento");

  if (!editId) await caricaTrattamenti();

  if (editId) {
    try {
      const apptDoc = await getDoc(doc(db, "appuntamenti", editId));
      if (apptDoc.exists()) {
        apptData = apptDoc.data();
        let iso = "";
        if (apptData.data && typeof apptData.data.toDate === "function") {
          const d = apptData.data.toDate();
          iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
        } else if (typeof apptData.dataISO === "string") {
          iso = apptData.dataISO.slice(0,10);
        }
        inpData && (inpData.value = iso);
        if (apptData.ora) {
          const [hh, mm] = apptData.ora.split(":");
          inpOraHH && (inpOraHH.value = hh);
          inpOraMM && (inpOraMM.value = mm);
        }
        const selectedMap = new Map((Array.isArray(apptData.trattamenti) ? apptData.trattamenti : []).map(t => [t.nome, Number(t.prezzo) || 0]));
        await caricaTrattamenti(selectedMap);
      } else {
        alert("Appuntamento non trovato. Procedo come 'Nuovo'.");
        setPageTitle("Nuovo Appuntamento");
        await caricaTrattamenti();
      }
    } catch (e) {
      console.error("Errore caricamento appuntamento:", e);
      alert("Errore nel caricamento.");
    }
  }

  if (!editId && presetDataISO && inpData && !inpData.value) {
    inpData.value = presetDataISO;
  }

  // proteggi la chiamata a updateNavState (può non esistere)
  if (typeof updateNavState === "function") {
    try { updateNavState(); } catch (e) { 
      console.warn("updateNavState() errore:", e); 
    }
  }

})(); // fine init