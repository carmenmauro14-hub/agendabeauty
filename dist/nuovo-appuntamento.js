// nuovo-appuntamento.js — UI completa + offline-first + edit mode

// ─── Firebase: riuso dell'app inizializzata in auth.js ────────────
import { db } from "./auth.js";
import {
  collection, getDocs, addDoc, updateDoc, getDoc, doc, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ─── Utility swipe ────────────────────────────────────────────────
import { abilitaSwipeVerticale } from "./swipe.js";

// ─── Offline storage helpers ──────────────────────────────────────
import { putOne, getAll, queueChange } from "./storage.js";

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
const inpOra             = document.getElementById("oraAppuntamento");
const wrapperTratt       = document.getElementById("trattamentiWrapper");

// Picker cliente
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

// Sheet wrapper
const pageModal   = document.querySelector(".page-modal");
const sheetEl     = document.getElementById("wizardSheet");
const sheetHeader = document.querySelector(".sheet-header");
const sheetClose  = document.getElementById("sheetClose");

// ─── Stato ────────────────────────────────────────────────────────
let apptData       = null;
let clientiCache   = null;

// ─── Abilitazioni UI ──────────────────────────────────────────────
function updateNavState() {
  if (btnToStep2) btnToStep2.disabled = !clienteIdHidden.value;
  if (btnToStep3) btnToStep3.disabled = !(inpData.value && inpOra.value);
}
[inpData, inpOra].forEach(el => el?.addEventListener("input", updateNavState));

// ─── Overlay / Sheet controlli ────────────────────────────────────
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

// ─── Rubrica ──────────────────────────────────────────────────────
async function apriRubrica() {
  if (!clientiCache) {
    try {
      const snap = await getDocs(collection(db, "clienti"));
      clientiCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch {
      clientiCache = await getAll("clienti");
    }
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
btnRubricaClose?.addEventListener("click", () => chiudiRubricaConAnimazione());

function chiudiRubricaConAnimazione() {
  if (!rubricaPanel) return (rubricaModal.style.display = "none");
  rubricaPanel.classList.add("swipe-out-down");
  rubricaPanel.addEventListener("transitionend", () => {
    rubricaPanel.classList.remove("swipe-out-down");
    rubricaModal.style.display = "none";
  }, { once: true });
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
        pickerValue.textContent = nome;
        pickerPlaceholder.style.display = "none";
        openRubricaField.classList.remove("empty");
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
  letterNavPicker.style.display = f ? "none" : "flex";
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

// ─── Trattamenti ──────────────────────────────────────────────────
async function caricaTrattamenti(selectedMap = null) {
  wrapperTratt.innerHTML = "";
  let lista = [];
  try {
    const snap = await getDocs(collection(db, "trattamenti"));
    lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    lista = await getAll("trattamenti");
  }
  lista.sort((a,b) => (a.nome || "").localeCompare(b.nome || ""));

  for (const t of lista) {
    const icona = t.icona || "icone_uniformate_colore/setting.png";
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
}

// ─── Navigazione step ─────────────────────────────────────────────
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

// ─── Salvataggio appuntamento con sync ────────────────────────────
btnSalva?.addEventListener("click", async () => {
  const clienteId = clienteIdHidden.value;
  const dataISO   = inpData.value;
  const ora       = inpOra.value;

  if (!clienteId) return alert("Seleziona un cliente");
  if (!(dataISO && ora)) return alert("Inserisci data e ora");

  const selected = [...document.querySelectorAll(".trattamento-checkbox:checked")];
  if (!selected.length) return alert("Seleziona almeno un trattamento");

  const trattamenti = selected.map(cb => {
    const row = cb.closest(".trattamento-row");
    const prezzoInput = row.querySelector(".prezzo-input");
    const prezzoVal = parseFloat(prezzoInput.value);
    return {
      nome: cb.dataset.nome,
      prezzo: Number.isFinite(prezzoVal) ? prezzoVal : 0,
      icona: cb.dataset.icona || ""
    };
  });

  const dateMidnight = new Date(dataISO + "T00:00:00");
  const dataTs = Timestamp.fromDate(dateMidnight);

  const [hh, mm] = ora.split(":").map(n => parseInt(n,10));
  const dateWithTime = new Date(dateMidnight);
  dateWithTime.setHours(hh||0, mm||0, 0, 0);
  const dateTime = Timestamp.fromDate(dateWithTime);

  const payload = { clienteId, data:dataTs, dataISO, ora, dateTime, trattamenti };

  try {
    if (navigator.onLine) {
      if (editId) {
        await updateDoc(doc(db,"appuntamenti",editId), payload);
        await putOne("appuntamenti",{ id:editId, ...payload });
        alert("Appuntamento aggiornato!");
      } else {
        const ref = await addDoc(collection(db,"appuntamenti"), payload);
        await putOne("appuntamenti",{ id:ref.id, ...payload });
        alert("Appuntamento salvato con successo!");
      }
    } else {
      const tempId = "temp-"+Date.now();
      await putOne("appuntamenti",{ id: tempId, ...payload });
      await queueChange({ collezione:"appuntamenti", op:"add", id: tempId, payload });
      alert("Appuntamento salvato offline (sarà sincronizzato)");
    }
    location.href="calendario.html";
  } catch(err) {
    console.error("Errore salvataggio:", err);
    alert("Errore durante il salvataggio.");
  }
});

// ─── Avvio ────────────────────────────────────────────────────────
(async function init() {
  setPageTitle(editId ? "Modifica Appuntamento" : "Nuovo Appuntamento");

  // Modalità Nuovo
  if (!editId) {
    await caricaTrattamenti();

    // Preimposta cliente se passato in URL
    if (presetClienteId) {
      try {
        const snap = await getDoc(doc(db, "clienti", presetClienteId));
        if (snap.exists()) {
          const c = snap.data();
          const nome = c.nome || "(senza nome)";
          clienteIdHidden.value = presetClienteId;
          pickerValue.textContent = nome;
          pickerPlaceholder.style.display = "none";
          openRubricaField.classList.remove("empty");
        }
      } catch {
        // fallback da cache
        const lista = await getAll("clienti");
        const c = lista.find(x => x.id === presetClienteId);
        if (c) {
          clienteIdHidden.value = presetClienteId;
          pickerValue.textContent = c.nome || "(senza nome)";
          pickerPlaceholder.style.display = "none";
          openRubricaField.classList.remove("empty");
        }
      }
    }

    // Preimposta data se passata in URL
    if (presetDataISO && inpData && !inpData.value) {
      inpData.value = presetDataISO;
    }
  }

  // Modalità Edit
  if (editId) {
    try {
      let apptDoc;
      if (navigator.onLine) {
        apptDoc = await getDoc(doc(db, "appuntamenti", editId));
      }
      if (!apptDoc || !apptDoc.exists()) {
        // fallback da cache
        const lista = await getAll("appuntamenti");
        apptData = lista.find(x => x.id === editId);
      } else {
        apptData = apptDoc.data();
      }

      if (apptData) {
        // Data
        let iso = "";
        if (apptData.data && typeof apptData.data.toDate === "function") {
          const d = apptData.data.toDate();
          iso = d.toISOString().slice(0,10);
        } else if (typeof apptData.dataISO === "string") {
          iso = apptData.dataISO.slice(0,10);
        }
        if (inpData) inpData.value = iso || "";
        if (inpOra)  inpOra.value  = apptData.ora || "";

        // Cliente
        if (apptData.clienteId) {
          clienteIdHidden.value = apptData.clienteId;
          try {
            const cliDoc = await getDoc(doc(db, "clienti", apptData.clienteId));
            const nomeCli = cliDoc.exists() ? (cliDoc.data().nome || "(senza nome)") : "(senza nome)";
            pickerValue.textContent = nomeCli;
            pickerPlaceholder.style.display = "none";
            openRubricaField.classList.remove("empty");
          } catch {
            const lista = await getAll("clienti");
            const c = lista.find(x => x.id === apptData.clienteId);
            if (c) {
              pickerValue.textContent = c.nome || "(senza nome)";
              pickerPlaceholder.style.display = "none";
              openRubricaField.classList.remove("empty");
            }
          }
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

  updateNavState();

  // Tasto ANNULLA
  btnCancel?.addEventListener("click", () => {
    if (history.length > 1) {
      history.back();
    } else {
      location.href = "calendario.html";
    }
  });
})();