// nuovo-appuntamento.js

// ─── Firebase: riuso dell'app inizializzata in auth.js ────────────
import { app } from "./auth.js";
import {
  getFirestore, collection, getDocs, addDoc, updateDoc, getDoc, doc, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ─── Utility swipe (già tua) ───────────────────────────────────────
import { abilitaSwipeVerticale } from "./swipe.js";

// Istanza Firestore dall'app riusata
const db = getFirestore(app);

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
  // piccola animazione in uscita
  if (!rubricaPanel) return (rubricaModal.style.display = "none");
  rubricaPanel.classList.add("swipe-out-down");
  rubricaPanel.addEventListener("transitionend", () => {
    rubricaPanel.classList.remove("swipe-out-down");
    rubricaModal.style.display = "none";
  }, { once: true });
});

// --- Drag-to-close anche per la Rubrica nello step clienti ---
const rubricaHeaderEl  = document.querySelector('#rubricaModal .rubrica-header'); // zona con la maniglia
const rubricaPanelEl   = rubricaPanel; // già definito sopra (".rubrica-container")

function chiudiRubricaConAnimazione() {
  if (!rubricaPanelEl) { rubricaModal.style.display = "none"; return; }
  rubricaPanelEl.classList.add('swipe-out-down');
  rubricaPanelEl.addEventListener('transitionend', () => {
    rubricaPanelEl.classList.remove('swipe-out-down');
    rubricaModal.style.display = 'none';
    rubricaPanelEl.style.transform = 'translateY(0)'; // reset per apertura successiva
  }, { once:true });
}

// attiva il drag verticale sulla maniglia della rubrica
if (rubricaHeaderEl && rubricaPanelEl) {
  // firma: abilitaSwipeVerticale(handleEl, panelEl, onClose, soloVersoGiu=true, sogliaPx)
  abilitaSwipeVerticale(rubricaHeaderEl, rubricaPanelEl, chiudiRubricaConAnimazione, true, 80);
}

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
        clienteIdHidden.value = c.id;
        const nome = c.nome || "(senza nome)";
        clienteSelezionato.textContent = nome;
        if (pickerValue) pickerValue.textContent = nome;
        if (pickerPlaceholder) pickerPlaceholder.style.display = "none";
        if (openRubricaField) openRubricaField.classList.remove("empty");
        rubricaModal.style.display = "none";
        updateNavState();
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

searchCliente?.addEventListener("input", () => {
  const f = searchCliente.value.toLowerCase();
  if (letterNavPicker) letterNavPicker.style.display = f ? "none" : "flex";
  clientListPicker.querySelectorAll("li.item").forEach(li => {
    li.style.display = li.textContent.toLowerCase().includes(f) ? "" : "none";
  });
  clientListPicker.querySelectorAll("li.section").forEach(sec => {
    let el = sec.nextElementSibling;
    let visible = false;
    while (el && !el.classList.contains("section")) {
      if (el.style.display !== "none") { visible = true; break; }
      el = el.nextElementSibling;
    }
    sec.style.display = visible ? "" : "none";
  });
});

// ─── Trattamenti ───────────────────────────────────────────────────
const iconeDisponibili = [
  "makeup_sposa", "makeup", "microblading", "extension_ciglia",
  "laminazione_ciglia", "filo_arabo", "architettura_sopracciglia", "airbrush_sopracciglia", "laser"
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
  if (!(inpData.value && inpOra.value)) return alert("Inserisci data e ora");
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
  const dataISO   = inpData.value;            // "YYYY-MM-DD"
  const ora       = inpOra.value;             // "HH:mm"

  if (!clienteId) return alert("Seleziona un cliente");
  if (!(dataISO && ora)) return alert("Inserisci data e ora");

  const selected = [...document.querySelectorAll(".trattamento-checkbox:checked")];
  if (!selected.length) return alert("Seleziona almeno un trattamento");

  // 🔍 Controlla se esiste già un appuntamento con stessa data e ora
  const appuntamentiSnap = await getDocs(collection(db, "appuntamenti"));
  const appuntamenti = appuntamentiSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const esiste = appuntamenti.some(app => {
    return (
      app.dataISO === dataISO &&
      app.ora === ora &&
      (!editId || app.id !== editId) // in modifica esclude se stesso
    );
  });

  if (esiste) {
    alert(`Hai già un appuntamento alle ${ora} del ${dataISO}`);
    return; // blocca salvataggio
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

  // Timestamp giorno (mezzanotte locale)
  const dateMidnight = new Date(dataISO + "T00:00:00");
  const dataTs = Timestamp.fromDate(dateMidnight);

  // Timestamp completo (data+ora) opzionale
  const [hh, mm] = ora.split(":").map(n => parseInt(n,10));
  const dateWithTime = new Date(dateMidnight);
  dateWithTime.setHours(hh || 0, mm || 0, 0, 0);
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
  // Titolo base
  setPageTitle(editId ? "Modifica Appuntamento" : "Nuovo Appuntamento");

  // Precarica trattamenti (se in edit, poi aggiorno con i selezionati)
  if (!editId) {
    await caricaTrattamenti();
  }

  // Modalità MODIFICA: carica appuntamento e precompila tutto
  if (editId) {
    try {
      const apptDoc = await getDoc(doc(db, "appuntamenti", editId));
      if (!apptDoc.exists()) {
        alert("Appuntamento non trovato. Procedo come 'Nuovo'.");
        setPageTitle("Nuovo Appuntamento");
        await caricaTrattamenti();
      } else {
        apptData = apptDoc.data();

        // Data (da Timestamp o stringa fallback)
        let iso = "";
        if (apptData.data && typeof apptData.data.toDate === "function") {
          const d = apptData.data.toDate();
          const y = d.getFullYear();
          const m = String(d.getMonth()+1).padStart(2,"0");
          const da= String(d.getDate()).padStart(2,"0");
          iso = `${y}-${m}-${da}`;
        } else if (typeof apptData.data === "string") {
          iso = apptData.data.slice(0,10);
        } else if (typeof apptData.dataISO === "string") {
          iso = apptData.dataISO.slice(0,10);
        }
        if (inpData) inpData.value = iso || "";
        if (inpOra)  inpOra.value  = apptData.ora || "";

        // Client preselect (da appuntamento)
        if (apptData.clienteId) {
          clienteIdHidden.value = apptData.clienteId;
          try {
            const cliDoc = await getDoc(doc(db, "clienti", apptData.clienteId));
            const nomeCli = cliDoc.exists() ? (cliDoc.data().nome || "(senza nome)") : "(senza nome)";
            if (pickerValue) pickerValue.textContent = nomeCli;
            if (pickerPlaceholder) pickerPlaceholder.style.display = "none";
            if (openRubricaField) openRubricaField.classList.remove("empty");
          } catch {}
        }

        // Trattamenti preselezionati
        const selectedMap = new Map(
          (Array.isArray(apptData.trattamenti) ? apptData.trattamenti : [])
            .map(t => [t.nome, Number(t.prezzo) || 0])
        );
        await caricaTrattamenti(selectedMap);
      }
    } catch (e) {
      console.error("Errore caricamento appuntamento:", e);
      alert("Errore nel caricamento. Procedo come 'Nuovo'.");
      setPageTitle("Nuovo Appuntamento");
      await caricaTrattamenti();
    }
  }

  // Se arrivo con ?cliente=... → preimposta cliente (SOLO in modalità NUOVO)
  if (!editId && presetClienteId) {
    try {
      const snap = await getDoc(doc(db, "clienti", presetClienteId));
      if (snap.exists()) {
        const c = snap.data();
        const nome = c.nome || "(senza nome)";
        clienteIdHidden.value = presetClienteId;
        if (pickerValue) pickerValue.textContent = nome;
        if (pickerPlaceholder) pickerPlaceholder.style.display = "none";
        if (openRubricaField) openRubricaField.classList.remove("empty");
      } else {
        // id non valido → stato vuoto
        clienteIdHidden.value = "";
      }
    } catch {
      clienteIdHidden.value = "";
    }
  }

  // Se NON c’è ?cliente=... (apertura da “+”) → stato vuoto garantito
  if (!editId && !presetClienteId) {
    clienteIdHidden.value = "";
    if (pickerValue) pickerValue.textContent = "";
    if (pickerPlaceholder) pickerPlaceholder.style.display = "";
    if (openRubricaField) openRubricaField.classList.add("empty");
  }

  // Preimposta data se passata in URL (solo Nuovo)
  if (!editId && presetDataISO && inpData && !inpData.value) {
    inpData.value = presetDataISO;
  }

  updateNavState();

  // Tasto ANNULLA
  btnCancel?.addEventListener("click", () => {
    if (history.length > 1) {
      history.back();
    } else {
      location.href = "calendario.html";
    }
  });
  btnRubricaClose?.addEventListener("click", chiudiRubricaConAnimazione);
})();