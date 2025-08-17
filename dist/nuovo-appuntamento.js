import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, getDocs, addDoc, updateDoc, getDoc, doc, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { abilitaSwipeVerticale } from "./swipe.js";

// ─── Firebase config ───────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyD0tDQQepdvj_oZPcQuUrEKpoNOd4zF0nE",
  authDomain: "agenda-carmenmauro.firebaseapp.com",
  projectId: "agenda-carmenmauro",
  storageBucket: "agenda-carmenmauro.appspot.com",
  messagingSenderId: "959324976221",
  appId: "1:959324976221:web:780c8e9195965cea0749b4"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db  = getFirestore(app);

// ─── Lettura modalità (nuovo / modifica) ───────────────────────────
const params  = new URLSearchParams(location.search);
const editId  = params.get("edit");
let apptData  = null;

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

// Picker cliente
const clienteIdHidden    = document.getElementById("clienteId");
const clienteSelezionato = document.getElementById("clienteSelezionato");
const openRubrica        = document.getElementById("openRubrica");
const rubricaModal       = document.getElementById("rubricaModal");
const searchCliente      = document.getElementById("searchCliente");
const clientListPicker   = document.getElementById("clientListPicker");
const letterNavPicker    = document.getElementById("letterNavPicker");
const rubricaPanel       = document.querySelector("#rubricaModal .rubrica-container");
const rubricaGrabber     = document.getElementById("rubricaGrabber");
const btnRubricaClose    = document.getElementById("rubricaClose");

// Campo finto input che apre la rubrica
const openRubricaField   = document.getElementById("openRubricaField");
const pickerValue        = document.getElementById("pickerValue");
const pickerPlaceholder  = document.getElementById("pickerPlaceholder");

// ─── Helpers ───────────────────────────────────────────────────────
function setPageTitle(text) {
  if (wizardTitle) wizardTitle.textContent = text;
  document.title = text;
}

function showModal(m) { m.style.display = "flex"; }
function closeModal(m) { m.style.display = "none"; }

function updateNavState() {
  if (btnToStep2) btnToStep2.disabled = !clienteIdHidden.value;
  if (btnToStep3) btnToStep3.disabled = !(inpData.value && inpOra.value);
}
[inpData, inpOra].forEach(el => el?.addEventListener("input", updateNavState));

// ─── Rubrica ───────────────────────────────────────────────────────
let clientiCache = null;

async function apriRubrica() {
  if (!clientiCache) {
    const snap = await getDocs(collection(db, "clienti"));
    clientiCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    clientiCache.sort((a,b) => (a.nome || "").localeCompare(b.nome || ""));
  }
  renderRubrica(clientiCache);
  if (searchCliente) searchCliente.value = "";
  if (letterNavPicker) letterNavPicker.style.display = "flex";
  showModal(rubricaModal);
}

openRubrica?.addEventListener("click", apriRubrica);
if (openRubricaField) {
  openRubricaField.addEventListener("click", apriRubrica);
  openRubricaField.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); apriRubrica(); }
  });
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
        clienteSelezionato.textContent = c.nome || "(senza nome)";
        if (pickerValue) pickerValue.textContent = c.nome || "(senza nome)";
        if (pickerPlaceholder) pickerPlaceholder.style.display = "none";
        if (openRubricaField) openRubricaField.classList.remove("empty");
        closeModal(rubricaModal);
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
  "laminazione_ciglia", "filo_arabo", "architettura_sopracciglia", "airbrush_sopracciglia"
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

      // 🔹 formatto sempre con due decimali e virgola
      const prezzoFormatted = prezzoSel.toFixed(2).replace(".", ",");

      row.innerHTML = `
        <label>
          <input type="checkbox" class="trattamento-checkbox"
                 ${checked ? "checked" : ""}
                 data-nome="${t.nome}" data-prezzo="${prezzoListino}" data-icona="${icona}">
          <img src="${icona}" alt="${t.nome}" class="icona-trattamento">
          ${t.nome}
        </label>
        <input type="text" class="prezzo-input"
               value="${prezzoFormatted}"
               inputmode="decimal">
      `;
      wrapperTratt.appendChild(row);
    }
  } catch (e) {
    console.error("Errore caricamento trattamenti:", e);
    alert("Errore nel caricamento dei trattamenti.");
  }
}

// ─── Salvataggio appuntamento ──────────────────────────────────────
btnSalva?.addEventListener("click", async () => {
  const clienteId = clienteIdHidden.value;
  const data = inpData.value;
  const ora  = inpOra.value;

  if (!clienteId) return alert("Seleziona un cliente");
  if (!(data && ora)) return alert("Inserisci data e ora");

  const selected = [...document.querySelectorAll(".trattamento-checkbox:checked")];
  if (!selected.length) return alert("Seleziona almeno un trattamento");

  const trattamenti = selected.map(cb => {
    const row = cb.closest(".trattamento-row");
    const prezzoInput = row.querySelector(".prezzo-input");

    let prezzoVal = parseFloat(prezzoInput.value.replace(",", "."));
    if (!Number.isFinite(prezzoVal)) prezzoVal = 0;

    return {
      nome: cb.dataset.nome,
      prezzo: prezzoVal,
      icona: cb.dataset.icona || trovaIcona(cb.dataset.nome)
    };
  });

  const [y, m, d] = data.split("-").map(n => parseInt(n, 10));
  const [hh, mm]  = ora.split(":").map(n => parseInt(n, 10));
  const localDate = new Date(y, m - 1, d, hh, mm, 0, 0);
  const dateTime  = Timestamp.fromDate(localDate);

  try {
    if (editId) {
      await updateDoc(doc(db, "appuntamenti", editId), {
        clienteId,
        data,
        ora,
        dateTime,
        trattamenti
      });
      alert("Appuntamento aggiornato!");
    } else {
      await addDoc(collection(db, "appuntamenti"), {
        clienteId,
        data,
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
  if (editId) {
    setPageTitle("Modifica Appuntamento");
    try {
      const apptDoc = await getDoc(doc(db, "appuntamenti", editId));
      if (!apptDoc.exists()) {
        alert("Appuntamento non trovato.");
        setPageTitle("Nuovo Appuntamento");
        await caricaTrattamenti();
        updateNavState();
        return;
      }
      apptData = apptDoc.data();

      if (inpData) inpData.value = apptData.data || "";
      if (inpOra)  inpOra.value  = apptData.ora  || "";

      if (apptData.clienteId) {
        clienteIdHidden.value = apptData.clienteId;
        try {
          const cliDoc = await getDoc(doc(db, "clienti", apptData.clienteId));
          const nomeCli = cliDoc.exists() ? (cliDoc.data().nome || "(senza nome)") : "(senza nome)";
          if (clienteSelezionato) clienteSelezionato.textContent = nomeCli;
          if (pickerValue) pickerValue.textContent = nomeCli;
          if (pickerPlaceholder) pickerPlaceholder.style.display = "none";
          if (openRubricaField) openRubricaField.classList.remove("empty");
        } catch {}
      }

      const selectedMap = new Map(
        (Array.isArray(apptData.trattamenti) ? apptData.trattamenti : [])
          .map(t => [t.nome, Number(t.prezzo) || 0])
      );
      await caricaTrattamenti(selectedMap);

    } catch (e) {
      console.error("Errore caricamento appuntamento:", e);
      alert("Errore nel caricamento. Procedo come 'Nuovo'.");
      setPageTitle("Nuovo Appuntamento");
      await caricaTrattamenti();
    }
  } else {
    setPageTitle("Nuovo Appuntamento");
    await caricaTrattamenti();
  }

  updateNavState();

  const fromDate = new URLSearchParams(location.search).get("data");
  if (!editId && fromDate && inpData && !inpData.value) {
    inpData.value = fromDate;
    updateNavState();
  }

  if (clienteIdHidden.value && pickerValue && openRubricaField) {
    openRubricaField.classList.remove("empty");
    if (pickerPlaceholder) pickerPlaceholder.style.display = "none";
  }
})();