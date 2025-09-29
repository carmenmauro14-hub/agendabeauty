// nuovo-appuntamento.js

// ─── Firebase: riuso dell'app inizializzata in auth.js ────────────
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

// ─── Rubrica (apertura e rendering) ────────────────────────────────
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

// ─── Trattamenti ───────────────────────────────────────────────────
const iconeDisponibili = [
  "makeup_sposa", "makeup", "microblading", "extension_ciglia",
  "laminazione_ciglia", "filo_arabo", "architettura_sopracciglia",
  "airbrush_sopracciglia", "laser"
];
function trovaIcona(nome) {
  const norm = (nome || "").toLowerCase().replace(/\s+/g, "_");
  for (const base of iconeDisponibili) {
    if (norm.includes(base)) return `icones_trattamenti/${base}.png`;
  }
  return "icone_uniformate_colore/setting.png";
}

async function caricaTrattamenti(selectedMap = null) {
  wrapperTratt.innerHTML = "";
  try {
    const snap = await getDocs(collection(db, "trattamenti"));
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    lista.sort((a,b) => (a.nome || "").localeCompare(b.nome || ""));
    for (const t of lista) {
      const icona = t.icona || trovaIcona(t.nome);
      const prezzoListino = Number(t.prezzo) || 0;

      const row = document.createElement("div");
      row.classList.add("trattamento-row");

      const checked   = selectedMap ? selectedMap.has(t.nome) : false;
      const prezzoSel = selectedMap && selectedMap.has(t.nome)
                        ? Number(selectedMap.get(t.nome)) || 0
                        : prezzoListino;
      const quantitaSel = selectedMap && selectedMap.has(t.nome)
                        ? (selectedMap.get(t.nome+"_qta") || 1)
                        : 1;

      row.innerHTML = `
        <label>
          <input type="checkbox" class="trattamento-checkbox"
                 ${checked ? "checked" : ""}
                 data-nome="${t.nome}" data-prezzo="${prezzoListino}" data-icona="${icona}">
          <img src="${icona}" alt="${t.nome}" class="icona-trattamento">
          ${t.nome}
        </label>
        <div class="trattamento-extra" style="display:${checked ? "flex" : "none"}; gap:8px; align-items:center;">
          <input type="number" class="prezzo-input"
                 placeholder="€${prezzoListino}"
                 value="${prezzoSel}"
                 min="0" step="0.01"
                 inputmode="decimal">
          <input type="number" class="quantita-input"
                 value="${quantitaSel}" min="1" step="1"
                 style="width:60px;">
        </div>
      `;

      const cb = row.querySelector(".trattamento-checkbox");
      cb.addEventListener("change", (e) => {
        const extra = row.querySelector(".trattamento-extra");
        extra.style.display = e.target.checked ? "flex" : "none";
      });

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

// ─── Salvataggio appuntamento ──────────────────────────────────────
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

  const selected = [...document.querySelectorAll(".trattamento-checkbox:checked")];
  if (!selected.length) return alert("Seleziona almeno un trattamento");

  const trattamenti = selected.map(cb => {
    const row = cb.closest(".trattamento-row");
    const prezzoInput = row.querySelector(".prezzo-input");
    const quantitaInput = row.querySelector(".quantita-input");
    const prezzoVal = parseFloat(prezzoInput.value);
    const quantitaVal = parseInt(quantitaInput.value, 10) || 1;
    return {
      nome: cb.dataset.nome,
      prezzo: Number.isFinite(prezzoVal) ? prezzoVal : 0,
      icona: cb.dataset.icona || trovaIcona(cb.dataset.nome),
      quantita: quantitaVal
    };
  });

  const appuntamentiSnap = await getDocs(collection(db, "appuntamenti"));
  const appuntamenti = appuntamentiSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const esiste = appuntamenti.some(app => {
    return (
      app.dataISO === dataISO &&
      app.ora === ora &&
      (!editId || app.id !== editId)
    );
  });
  if (esiste) {
    alert(`Hai già un appuntamento alle ${ora} del ${dataISO}`);
    return;
  }

  const dateMidnight = new Date(dataISO + "T00:00:00");
  const dataTs = Timestamp.fromDate(dateMidnight);

  const [hhNum, mmNum] = ora.split(":").map(n => parseInt(n,10));
  const dateWithTime = new Date(dateMidnight);
  dateWithTime.setHours(hhNum || 0, mmNum || 0, 0, 0);
  const dateTime = Timestamp.fromDate(dateWithTime);

  try {
    if (editId) {
      await updateDoc(doc(db, "appuntamenti", editId), {
        clienteId,
        data: dataTs,
        dataISO,
        ora,
        dateTime,
        trattamenti
      });
      alert("Appuntamento aggiornato!");
    } else {
      await addDoc(collection(db, "appuntamenti"), {
        clienteId,
        data: dataTs,
        dataISO,
        ora,
        dateTime,
        trattamenti
      });
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

  if (!editId) {
    await caricaTrattamenti();
  }

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
        if (inpData) inpData.value = iso;

        if (apptData.ora) {
          const [hh, mm] = apptData.ora.split(":");
          if (inpOraHH) inpOraHH.value = hh;
          if (inpOraMM) inpOraMM.value = mm;
        }

        const selectedMap = new Map();
        (Array.isArray(apptData.trattamenti) ? apptData.trattamenti : []).forEach(t => {
          selectedMap.set(t.nome, Number(t.prezzo) || 0);
          selectedMap.set(t.nome+"_qta", t.quantita || 1);
        });
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

  updateNavState();
})();