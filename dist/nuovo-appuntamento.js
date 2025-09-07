// nuovo-appuntamento.js — offline-first con sync_queue
import { db } from "./auth.js";
import {
  collection, getDocs, addDoc, updateDoc, doc, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { putOne, getAll, queueChange } from "./storage.js";

// ─── Parametri URL ───────────────
const urlParams        = new URLSearchParams(location.search);
const editId           = urlParams.get("edit");
const presetClienteId  = urlParams.get("cliente");
const presetDataISO    = urlParams.get("data");

// ─── DOM ───────────────
const step1              = document.getElementById("step1");
const step2              = document.getElementById("step2");
const step3              = document.getElementById("step3");

const btnToStep2         = document.getElementById("toStep2");
const btnBackToStep1     = document.getElementById("backToStep1");
const btnToStep3         = document.getElementById("toStep3");
const btnBackToStep2     = document.getElementById("backToStep2");
const btnSalva           = document.getElementById("salvaAppuntamento");

const inpData            = document.getElementById("dataAppuntamento");
const inpOra             = document.getElementById("oraAppuntamento");
const wrapperTratt       = document.getElementById("trattamentiWrapper");

// Picker cliente (step 1)
const clienteIdHidden    = document.getElementById("clienteId");
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
  document.getElementById("rubricaModal").style.display = "none";
}

// ─── Trattamenti ──────────
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
      // 🔹 Offline → salva in cache e accoda sync
      const tempId = "temp-"+Date.now();
      const payload = { clienteId, data:dataTs, dataISO, ora, dateTime, trattamenti };
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

// ─── Avvio ───────────────
(async function init(){
  if (presetDataISO) inpData.value = presetDataISO;
  if (presetClienteId) clienteIdHidden.value = presetClienteId;

  await caricaTrattamenti();
  updateNavState();
})();