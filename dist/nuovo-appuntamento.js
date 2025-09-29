// nuovo-appuntamento.js

import { app } from "./auth.js";
import {
  getFirestore, collection, getDocs, addDoc, updateDoc, getDoc, doc, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { abilitaSwipeVerticale } from "./swipe.js";

const db = getFirestore(app);

// ─── Parametri URL ─────────────────────────────────────────────────
const urlParams        = new URLSearchParams(location.search);
const editId           = urlParams.get("edit");
const presetClienteId  = urlParams.get("cliente");
const presetDataISO    = urlParams.get("data");

// ─── Utils ─────────────────────────────────────────────────────────
function setPageTitle(text) {
  if (wizardTitle) wizardTitle.textContent = text;
  document.title = text;
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
const searchCliente      = document.getElementById("searchCliente");
const clientListPicker   = document.getElementById("clientListPicker");
const letterNavPicker    = document.getElementById("letterNavPicker");
const rubricaPanel       = document.querySelector("#rubricaModal .rubrica-container");
const btnRubricaClose    = document.getElementById("rubricaClose");

const openRubricaField   = document.getElementById("openRubricaField");
const pickerValue        = document.getElementById("pickerValue");
const pickerPlaceholder  = document.getElementById("pickerPlaceholder");

const pageModal   = document.querySelector(".page-modal");
const sheetEl     = document.getElementById("wizardSheet");
const sheetHeader = document.querySelector(".sheet-header");
const sheetClose  = document.getElementById("sheetClose");

// ─── Stato ─────────────────────────────────────────────────────────
let apptData     = null;
let clientiCache = null;

// ─── Abilitazioni UI ───────────────────────────────────────────────
function updateNavState() {
  if (btnToStep2) btnToStep2.disabled = !clienteIdHidden.value;
  if (btnToStep3) btnToStep3.disabled = !(inpData.value && inpOraHH.value !== "" && inpOraMM.value !== "");
}
[inpData, inpOraHH, inpOraMM].forEach(el => el?.addEventListener("input", updateNavState));

// ─── Overlay chiusura ─────────────────────────────────────────────
function chiudiSheet() {
  const doClose = () => document.getElementById("cancelWizard")?.click();
  if (!sheetEl) return doClose();
  sheetEl.classList.add("swipe-out-down");
  sheetEl.addEventListener("transitionend", doClose, { once: true });
}
sheetClose?.addEventListener("click", chiudiSheet);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") chiudiSheet(); });
pageModal?.addEventListener("click", (e) => { if (e.target === pageModal) chiudiSheet(); });
if (sheetHeader) { abilitaSwipeVerticale(sheetHeader, null, chiudiSheet, true, 45); }

// … [qui lasciamo invariata la parte della rubrica e dei trattamenti] …

// ─── Navigazione step ──────────────────────────────────────────────
btnToStep2?.addEventListener("click", () => {
  if (!clienteIdHidden.value) return alert("Seleziona un cliente");
  step1.style.display = "none";
  step2.style.display = "block";
});
btnBackToStep1?.addEventListener("click", () => {
  step2.style.display = "none";
  step1.style.display = "block";
});
btnToStep3?.addEventListener("click", () => {
  if (!(inpData.value && inpOraHH.value !== "" && inpOraMM.value !== "")) {
    return alert("Inserisci data e ora");
  }
  step2.style.display = "none";
  step3.style.display = "block";
});
btnBackToStep2?.addEventListener("click", () => {
  step3.style.display = "none";
  step2.style.display = "block";
});

// ─── Salvataggio ───────────────────────────────────────────────────
btnSalva?.addEventListener("click", async () => {
  const clienteId = clienteIdHidden.value;
  const dataISO   = inpData.value;

  if (!clienteId) return alert("Seleziona un cliente");
  if (!(dataISO && inpOraHH.value !== "" && inpOraMM.value !== "")) {
    return alert("Inserisci data e ora");
  }

  const hh = String(Math.min(parseInt(inpOraHH.value || "0", 10), 23)).padStart(2, "0");
  const mm = String(Math.min(parseInt(inpOraMM.value || "0", 10), 59)).padStart(2, "0");
  const ora = `${hh}:${mm}`;

  // … [qui rimane invariata la parte di controllo duplicati e salvataggio su Firestore] …
});

// ─── Avvio ─────────────────────────────────────────────────────────
(async function init() {
  setPageTitle(editId ? "Modifica Appuntamento" : "Nuovo Appuntamento");

  if (!editId) {
    await caricaTrattamenti();
  }

  if (editId) {
    try {
      const apptDoc = await getDoc(doc(db, "appuntamenti", editId));
      if (apptDoc.exists()) {
        apptData = apptDoc.data();

        // Data
        let iso = "";
        if (apptData.data && typeof apptData.data.toDate === "function") {
          const d = apptData.data.toDate();
          iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
        } else if (typeof apptData.dataISO === "string") {
          iso = apptData.dataISO.slice(0,10);
        }
        if (inpData) inpData.value = iso;

        // Ora
        if (apptData.ora) {
          const [hh, mm] = apptData.ora.split(":");
          if (inpOraHH) inpOraHH.value = hh;
          if (inpOraMM) inpOraMM.value = mm;
        }

        // Cliente
        if (apptData.clienteId) {
          clienteIdHidden.value = apptData.clienteId;
          // … caricamento nome cliente …
        }

        // Trattamenti preselezionati
        const selectedMap = new Map(
          (Array.isArray(apptData.trattamenti) ? apptData.trattamenti : [])
            .map(t => [t.nome, Number(t.prezzo) || 0])
        );
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

  // Preimpostazioni se ?cliente= o ?data=
  if (!editId && presetDataISO && inpData && !inpData.value) {
    inpData.value = presetDataISO;
  }

  updateNavState();
})();