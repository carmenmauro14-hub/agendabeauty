// nuovo-appuntamento.js

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

// ─── Utils ────────────────────────────────────────────────────────
function setPageTitle(text) {
  if (wizardTitle) wizardTitle.textContent = text;
  document.title = text;
}

// ─── Riferimenti DOM ──────────────────────────────────────────────
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

// Mini-modal nuovo cliente
const btnOpenAddCliente  = document.getElementById("openAddClienteWizard");
const addClienteModal    = document.getElementById("addClienteModal");
const btnCloseAddCliente = document.getElementById("closeAddCliente");
const addClienteForm     = document.getElementById("addClienteForm");
const inpNomeCliente     = document.getElementById("addClienteNome");
const inpTelCliente      = document.getElementById("addClienteTel");

// ─── Stato ────────────────────────────────────────────────────────
let apptData     = null;
let clientiCache = null;

// ─── Abilitazioni UI ──────────────────────────────────────────────
function updateNavState() {
  if (btnToStep2) btnToStep2.disabled = !clienteIdHidden.value;
  if (btnToStep3) btnToStep3.disabled = !(inpData.value && inpOraHH.value !== "" && inpOraMM.value !== "");
}
[inpData, inpOraHH, inpOraMM].forEach(el => el?.addEventListener("input", updateNavState));

// ─── Overlay chiusura ─────────────────────────────────────────────
function chiudiSheet() {
  if (!sheetEl) {
    btnCancel?.click();
    return;
  }
  sheetEl.classList.add("swipe-out-down");
  sheetEl.addEventListener("transitionend", () => {
    btnCancel?.click();
  }, { once: true });
}
sheetClose?.addEventListener("click", chiudiSheet);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") chiudiSheet(); });
pageModal?.addEventListener("click", (e) => { if (e.target === pageModal) chiudiSheet(); });
if (sheetHeader) { abilitaSwipeVerticale(sheetHeader, null, chiudiSheet, true, 45); }

// ─── Rubrica ──────────────────────────────────────────────────────
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
btnRubricaClose?.addEventListener("click", () => {
  rubricaModal.style.display = "none";
});

// 🔽 SWIPE su grabber rubrica per chiudere
const rubricaGrabber = document.getElementById("rubricaGrabber");
if (rubricaGrabber) {
  abilitaSwipeVerticale(rubricaGrabber, null, () => {
    rubricaPanel.classList.add("swipe-out-down");
    rubricaPanel.addEventListener("transitionend", () => {
      rubricaPanel.classList.remove("swipe-out-down");
      rubricaModal.style.display = "none";
      rubricaPanel.style.transform = "translateY(0)";
    }, { once: true });
  }, true, 45);
}

// rendering rubrica
function renderRubrica(clienti) {
  const groups = {};
  clienti.forEach(c => {
    const L = (c.nome ? c.nome.charAt(0) : "#").toUpperCase();
    (groups[L] = groups[L] || []).push(c);
  });
  const letters = Object.keys(groups).sort();

  clientListPicker.innerHTML = "";
  letters.forEach(L => {
    const sec = document.createElement("li");
    sec.textContent = L;
    sec.className = "section";
    sec.id = "picker-letter-" + L;
    clientListPicker.appendChild(sec);

    groups[L].forEach(c => {
      const li = document.createElement("li");
      li.className = "item";
      li.textContent = c.nome || "(senza nome)";
      li.onclick = () => {
        selezionaCliente(c.id, c.nome);
      };
      clientListPicker.appendChild(li);
    });
  });

  letterNavPicker.innerHTML = "";
  letters.forEach(L => {
    const el = document.createElement("span");
    el.textContent = L;
    el.onclick = () => {
      const target = document.getElementById("picker-letter-" + L);
      target && target.scrollIntoView({ behavior: "smooth" });
    };
    letterNavPicker.appendChild(el);
  });
}

// funzione per selezionare cliente
function selezionaCliente(id, nome) {
  clienteIdHidden.value = id;
  clienteSelezionato.textContent = nome;
  if (pickerValue) pickerValue.textContent = nome;
  if (pickerPlaceholder) pickerPlaceholder.style.display = "none";
  if (openRubricaField) openRubricaField.classList.remove("empty");
  rubricaModal.style.display = "none";
  updateNavState();
}

// ─── Mini-modal nuovo cliente ─────────────────────────────────────
btnOpenAddCliente?.addEventListener("click", () => {
  addClienteModal.style.display = "flex";
  inpNomeCliente.focus();
});
btnCloseAddCliente?.addEventListener("click", () => {
  addClienteModal.style.display = "none";
});
addClienteForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = inpNomeCliente.value.trim();
  const telefono = inpTelCliente.value.trim();
  if (!nome) {
    alert("Inserisci il nome del cliente");
    return;
  }
  try {
    const docRef = await addDoc(collection(db, "clienti"), { nome, telefono });

    // preseleziona subito il nuovo cliente
    selezionaCliente(docRef.id, nome);

    // reset form e chiudi modal
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

      row.innerHTML = `
        <label>
          <input type="checkbox" class="trattamento-checkbox"
                 ${checked ? "checked" : ""}
                 data-nome="${t.nome}" data-prezzo="${prezzoListino}" data-icona="${icona}">
          <img src="${icona}" alt="${t.nome}" class="icona-trattamento">
          ${t.nome}
        </label>
        <input type="number" class="prezzo-input"
               placeholder="€${prezzoListino}"
               value="${prezzoSel}"
               min="0" step="0.01"
               inputmode="decimal">
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

  // 🔍 Controlla duplicati
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

  // Preimpostazioni se URL ?cliente= o ?data=
  if (!editId && presetDataISO && inpData && !inpData.value) {
    inpData.value = presetDataISO;
  }

  updateNavState();

  // Tasto ANNULLA → torna indietro o al calendario
  btnCancel?.addEventListener("click", () => {
    if (history.length > 1) {
      history.back();
    } else {
      location.href = "calendario.html";
    }
  });
  // ─── Aggiunta rapida cliente dal wizard ──────────────────────────────
const btnOpenAddCliente = document.getElementById("openAddClienteWizard");
const formAddCliente    = document.getElementById("addClienteWizardForm");
const btnSalvaCliente   = document.getElementById("salvaAddCliente");
const btnAnnullaCliente = document.getElementById("annullaAddCliente");
const inpNomeCliente    = document.getElementById("addClienteNome");
const inpTelCliente     = document.getElementById("addClienteTel");

btnOpenAddCliente?.addEventListener("click", () => {
  formAddCliente.style.display = "block";
  inpNomeCliente.focus();
});

btnAnnullaCliente?.addEventListener("click", () => {
  formAddCliente.style.display = "none";
  inpNomeCliente.value = "";
  inpTelCliente.value = "";
});

btnSalvaCliente?.addEventListener("click", async () => {
  const nome = inpNomeCliente.value.trim();
  const telefono = inpTelCliente.value.trim();
  if (!nome) {
    alert("Inserisci il nome del cliente");
    return;
  }

  try {
    const docRef = await addDoc(collection(db, "clienti"), { nome, telefono });

    // preseleziona subito il nuovo cliente nello step 1
    clienteIdHidden.value = docRef.id;
    if (pickerValue) pickerValue.textContent = nome;
    if (pickerPlaceholder) pickerPlaceholder.style.display = "none";
    if (openRubricaField) openRubricaField.classList.remove("empty");
    clienteSelezionato.textContent = nome;

    // chiudi il modale rubrica
    rubricaModal.style.display = "none";

    // reset form
    formAddCliente.style.display = "none";
    inpNomeCliente.value = "";
    inpTelCliente.value = "";

    updateNavState();

  } catch (err) {
    console.error("Errore durante salvataggio cliente:", err);
    alert("Errore nel salvataggio del cliente.");
  }
});
})();