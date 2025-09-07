// nuovo-appuntamento.js

// ─── Firebase: riuso dell'app inizializzata in auth.js ────────────
import { db } from "./auth.js";
import {
  collection, getDocs, addDoc, updateDoc, getDoc, doc, Timestamp,
  query, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 🔥 IndexedDB per offline-first
import { putOne } from "./storage.js";

// ─── Utility swipe (già tua) ───────────────────────────────────────
import { abilitaSwipeVerticale } from "./swipe.js";

// ─── Parametri URL (preset cliente e data opzionali) ───────────────
const urlParams        = new URLSearchParams(location.search);
const editId           = urlParams.get("edit");         // se presente → modalità MODIFICA
const presetClienteId  = urlParams.get("cliente");      // se presente → pre-seleziona cliente
const presetDataISO    = urlParams.get("data");         // opzionale per preimpostare la data

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
const inpOra             = document.getElementById("oraAppuntamento");
const wrapperTratt       = document.getElementById("trattamentiWrapper");

// Picker cliente (step 1)
const clienteIdHidden    = document.getElementById("clienteId");
const clienteSelezionato = document.getElementById("clienteSelezionato");
const openRubrica        = document.getElementById("openRubrica");
const rubricaModal       = document.getElementById("rubricaModal");
const searchCliente      = document.getElementById("searchCliente");
const clientListPicker   = document.getElementById("clientListPicker");
const letterNavPicker    = document.getElementById("letterNavPicker");
const rubricaPanel       = document.querySelector("#rubricaModal .rubrica-container");
const btnRubricaClose    = document.getElementById("rubricaClose");

// Campo “finto input” che apre rubrica
const openRubricaField   = document.getElementById("openRubricaField");
const pickerValue        = document.getElementById("pickerValue");
const pickerPlaceholder  = document.getElementById("pickerPlaceholder");

// Sheet wrapper (overlay)
const pageModal   = document.querySelector(".page-modal");
const sheetEl     = document.getElementById("wizardSheet");
const sheetHeader = document.querySelector(".sheet-header");
const sheetClose  = document.getElementById("sheetClose");

// ─── Stato ─────────────────────────────────────────────────────────
let apptData       = null;   // dati appuntamento se in modifica
let clientiCache   = null;   // rubrica in cache

// ─── Abilitazioni UI ───────────────────────────────────────────────
function updateNavState() {
  if (btnToStep2) btnToStep2.disabled = !clienteIdHidden.value;
  if (btnToStep3) btnToStep3.disabled = !(inpData.value && inpOra.value);
}
[inpData, inpOra].forEach(el => el?.addEventListener("input", updateNavState));

// ─── Overlay / Sheet controlli ─────────────────────────────────────
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

// ─── Rubrica ───────────────────────────────────────────────────────
async function apriRubrica() {
  if (!clientiCache) {
    const snap = await getDocs(collection(db, "clienti"));
    clientiCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    clientiCache.sort((a,b) => (a.nome || "").localeCompare(b.nome || ""));
  }
  renderRubrica(clientiCache);
  if (searchCliente) searchCliente.value = "";
  if (letterNavPicker) letterNavPicker.style.display = "flex";
  rubricaModal.style.display = "flex";
}
openRubrica?.addEventListener("click", apriRubrica);
if (openRubricaField) {
  openRubricaField.addEventListener("click", apriRubrica);
  openRubricaField.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); apriRubrica(); }
  });
}
rubricaModal?.addEventListener("click", (e) => {
  if (e.target === rubricaModal) rubricaModal.style.display = "none";
});
btnRubricaClose?.addEventListener("click", () => {
  if (!rubricaPanel) return (rubricaModal.style.display = "none");
  rubricaPanel.classList.add("swipe-out-down");
  rubricaPanel.addEventListener("transitionend", () => {
    rubricaPanel.classList.remove("swipe-out-down");
    rubricaModal.style.display = "none";
  }, { once: true });
});

// --- Drag-to-close anche per la Rubrica nello step clienti ---
const rubricaHeaderEl  = document.querySelector('#rubricaModal .rubrica-header');
const rubricaPanelEl   = rubricaPanel;

function chiudiRubricaConAnimazione() {
  if (!rubricaPanelEl) { rubricaModal.style.display = "none"; return; }
  rubricaPanelEl.classList.add('swipe-out-down');
  rubricaPanelEl.addEventListener('transitionend', () => {
    rubricaPanelEl.classList.remove('swipe-out-down');
    rubricaModal.style.display = 'none';
    rubricaPanelEl.style.transform = 'translateY(0)';
  }, { once:true });
}
if (rubricaHeaderEl && rubricaPanelEl) {
  abilitaSwipeVerticale(rubricaHeaderEl, rubricaPanelEl, chiudiRubricaConAnimazione, true, 80);
}

// ... (rubrica rendering + search invariati) ...

// ─── Trattamenti (invariato, non lo ripeto tutto) ─────────────────

// ─── Salvataggio appuntamento ──────────────────────────────────────
btnSalva?.addEventListener("click", async () => {
  const clienteId = clienteIdHidden.value;
  const dataISO   = inpData.value;
  const ora       = inpOra.value;

  if (!clienteId) return alert("Seleziona un cliente");
  if (!(dataISO && ora)) return alert("Inserisci data e ora");

  const selected = [...document.querySelectorAll(".trattamento-checkbox:checked")];
  if (!selected.length) return alert("Seleziona almeno un trattamento");

  const dupQuery = query(
    collection(db, "appuntamenti"),
    where("dataISO", "==", dataISO),
    where("ora", "==", ora)
  );
  const dupSnap = await getDocs(dupQuery);
  const esiste = dupSnap.docs.some(d => !editId || d.id !== editId);
  if (esiste) {
    alert(`Hai già un appuntamento alle ${ora} del ${dataISO}`);
    return;
  }

  const trattamenti = selected.map(cb => {
    const row = cb.closest(".trattamento-row");
    const prezzoInput = row.querySelector(".prezzo-input");
    const prezzoVal = parseFloat(prezzoInput.value);
    return {
      nome: cb.dataset.nome,
      prezzo: Number.isFinite(prezzoVal) ? prezzoVal : 0,
      icona: cb.dataset.icona || trovaIcona(cb.dataset.nome)
    };
  });

  const dateMidnight = new Date(dataISO + "T00:00:00");
  const dataTs = Timestamp.fromDate(dateMidnight);

  const [hh, mm] = ora.split(":").map(n => parseInt(n,10));
  const dateWithTime = new Date(dateMidnight);
  dateWithTime.setHours(hh || 0, mm || 0, 0, 0);
  const dateTime = Timestamp.fromDate(dateWithTime);

  try {
    let apptId = editId;

    if (editId) {
      await updateDoc(doc(db, "appuntamenti", editId), {
        clienteId, data: dataTs, dataISO, ora, dateTime, trattamenti
      });
      apptId = editId;
      await putOne("appuntamenti", { id: apptId, clienteId, data: dataTs, dataISO, ora, dateTime, trattamenti });
      alert("Appuntamento aggiornato!");
    } else {
      const ref = await addDoc(collection(db, "appuntamenti"), {
        clienteId, data: dataTs, dataISO, ora, dateTime, trattamenti
      });
      apptId = ref.id;
      await putOne("appuntamenti", { id: apptId, clienteId, data: dataTs, dataISO, ora, dateTime, trattamenti });
      alert("Appuntamento salvato con successo!");
    }

    location.href = "calendario.html";
  } catch (err) {
    console.error("Errore salvataggio:", err);
    alert("Errore durante il salvataggio.");
  }
});

// ─── Avvio (init invariato) ────────────────────────────────────────