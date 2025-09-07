// nuovo-appuntamento.js — offline-first con pending sync
import { db } from "./auth.js";
import {
  collection, getDocs, addDoc, updateDoc, doc, Timestamp,
  query, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { putOne, getAll } from "./storage.js";
import { abilitaSwipeVerticale } from "./swipe.js";

// ─── Parametri URL ───────────────
const urlParams        = new URLSearchParams(location.search);
const editId           = urlParams.get("edit");
const presetClienteId  = urlParams.get("cliente");
const presetDataISO    = urlParams.get("data");

// ─── DOM ───────────────
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
const btnRubricaClose    = document.getElementById("rubricaClose");
const openRubricaField   = document.getElementById("openRubricaField");
const pickerValue        = document.getElementById("pickerValue");
const pickerPlaceholder  = document.getElementById("pickerPlaceholder");

// ─── Stato ───────────────
let clientiCache = null;

// ─── Helpers ───────────────
function updateNavState() {
  btnToStep2.disabled = !clienteIdHidden.value;
  btnToStep3.disabled = !(inpData.value && inpOra.value);
}
[inpData, inpOra].forEach(el => el?.addEventListener("input", updateNavState));

function setCliente(c) {
  clienteIdHidden.value = c.id;
  pickerValue.textContent = c.nome;
  pickerPlaceholder.style.display = "none";
  updateNavState();
  rubricaModal.style.display = "none";
}

// ─── Rubrica ───────────────
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
  searchCliente.value = "";
  letterNavPicker.style.display = "flex";
  rubricaModal.style.display = "flex";
}

function renderRubrica(clienti) {
  clientListPicker.innerHTML = "";
  const groups = {};
  clienti.forEach(c => {
    const first = (c.nome || "#").charAt(0).toUpperCase();
    (groups[first] = groups[first] || []).push(c);
  });
  const letters = Object.keys(groups).sort();

  letters.forEach(L => {
    const sec = document.createElement("li");
    sec.textContent = L;
    sec.className = "section";
    clientListPicker.appendChild(sec);

    groups[L].forEach(c => {
      const li = document.createElement("li");
      li.className = "item";
      li.textContent = c.nome;
      li.onclick = () => setCliente(c);
      clientListPicker.appendChild(li);
    });
  });

  // letter nav
  letterNavPicker.innerHTML = "";
  letters.forEach(L => {
    const span = document.createElement("span");
    span.textContent = L;
    span.onclick = () => {
      const target = [...clientListPicker.querySelectorAll(".section")].find(s=>s.textContent===L);
      target && target.scrollIntoView({behavior:"smooth"});
    };
    letterNavPicker.appendChild(span);
  });
}

searchCliente?.addEventListener("input", () => {
  const f = searchCliente.value.toLowerCase();
  document.querySelectorAll("#clientListPicker li.item").forEach(li => {
    li.style.display = li.textContent.toLowerCase().includes(f) ? "" : "none";
  });
});

openRubrica?.addEventListener("click", apriRubrica);
openRubricaField?.addEventListener("click", apriRubrica);
btnRubricaClose?.addEventListener("click", () => rubricaModal.style.display = "none");

// ─── Trattamenti (mock — aggiungi tu i tuoi trattamenti) ──────────
async function caricaTrattamenti() {
  wrapperTratt.innerHTML = "";
  let trattamenti = [];
  try {
    const snap = await getDocs(collection(db, "trattamenti"));
    trattamenti = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    trattamenti = await getAll("trattamenti");
  }

  trattamenti.forEach(t => {
    const row = document.createElement("div");
    row.className = "trattamento-row";
    row.innerHTML = `
      <label>
        <input type="checkbox" class="trattamento-checkbox"
          data-nome="${t.nome}" data-icona="${t.icona || ""}">
        ${t.nome}
      </label>
      <input type="number" class="prezzo-input" value="${t.prezzo || 0}">
    `;
    wrapperTratt.appendChild(row);
  });
}

// ─── Salvataggio appuntamento ───────────────
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

  try {
    if (navigator.onLine) {
      if (editId) {
        await updateDoc(doc(db,"appuntamenti",editId), {
          clienteId, data:dataTs, dataISO, ora, dateTime, trattamenti
        });
        await putOne("appuntamenti",{ id:editId, clienteId, data:dataTs, dataISO, ora, dateTime, trattamenti });
        alert("Appuntamento aggiornato!");
      } else {
        const ref = await addDoc(collection(db,"appuntamenti"), {
          clienteId, data:dataTs, dataISO, ora, dateTime, trattamenti
        });
        await putOne("appuntamenti",{ id:ref.id, clienteId, data:dataTs, dataISO, ora, dateTime, trattamenti });
        alert("Appuntamento salvato con successo!");
      }
    } else {
      const tempId = "temp-"+Date.now();
      await putOne("appuntamenti",{
        id: tempId,
        clienteId, data:dataTs, dataISO, ora, dateTime, trattamenti,
        __pending:true
      });
      alert("Appuntamento salvato offline (sarà sincronizzato)");
    }
    location.href="calendario.html";
  } catch(err) {
    console.error("Errore salvataggio:", err);
    alert("Errore durante il salvataggio.");
  }
});

// ─── Avvio ───────────────
(async function init(){
  if (presetDataISO) inpData.value = presetDataISO;
  if (presetClienteId) clienteIdHidden.value = presetClienteId;

  await caricaTrattamenti();
  updateNavState();
})();