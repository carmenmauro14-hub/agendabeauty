import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, getDocs, addDoc, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// [ADD] Swipe verticale dalla maniglia
import { abilitaSwipeVerticale } from "./swipe.js";

// ─── Firebase config (allineata al resto dell'app) ────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyD0tDQQepdvj_oZPcQuUrEKpoNOd4zF0nE",
  authDomain: "agenda-carmenmauro.firebaseapp.com",
  projectId: "agenda-carmenmauro",
  storageBucket: "agenda-carmenmauro.appspot.com",
  messagingSenderId: "959324976221",
  appId: "1:959324976221:web:780c8e9195965cea0749b4"
};

// Evita doppia inizializzazione (auth.js può aver già inizializzato)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db  = getFirestore(app);

// ─── Riferimenti DOM ───────────────────────────────────────────────────────────
const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const step3 = document.getElementById("step3");

const btnToStep2     = document.getElementById("toStep2");
const btnBackToStep1 = document.getElementById("backToStep1");
const btnToStep3     = document.getElementById("toStep3");
const btnBackToStep2 = document.getElementById("backToStep2");
const btnSalva       = document.getElementById("salvaAppuntamento");

const inpData = document.getElementById("dataAppuntamento");
const inpOra  = document.getElementById("oraAppuntamento");
const wrapperTratt = document.getElementById("trattamentiWrapper");

// Picker cliente (rubrica embedded in modal)
const clienteIdHidden     = document.getElementById("clienteId");
const clienteSelezionato  = document.getElementById("clienteSelezionato");
const openRubrica         = document.getElementById("openRubrica");
const rubricaModal        = document.getElementById("rubricaModal");
const searchCliente       = document.getElementById("searchCliente");
const clientListPicker    = document.getElementById("clientListPicker");
const letterNavPicker     = document.getElementById("letterNavPicker");
// [ADD] Riferimenti per swipe verticale
const rubricaPanel = document.querySelector("#rubricaModal .rubrica-container");
const rubricaGrabber = document.getElementById("rubricaGrabber");

// ─── Helpers ──────────────────────────────────────────────────────────────────
function showModal(m) { m.style.display = "flex"; }
function closeModal(m) { m.style.display = "none"; }

function updateNavState() {
  if (btnToStep2) btnToStep2.disabled = !clienteIdHidden.value;
  if (btnToStep3) btnToStep3.disabled = !(inpData.value && inpOra.value);
}
[inpData, inpOra].forEach(el => el.addEventListener("input", updateNavState));

// Chiudi modale toccando l'overlay
rubricaModal.addEventListener("click", (e) => {
  if (e.target === rubricaModal) closeModal(rubricaModal);
});

// [ADD] Chiudi modale con swipe verso il basso dalla maniglia
function chiudiRubricaConAnimazioneVert() {
  if (!rubricaPanel) return;
  rubricaPanel.classList.add("swipe-out-down");
  rubricaPanel.addEventListener("transitionend", () => {
    rubricaPanel.classList.remove("swipe-out-down");
    closeModal(rubricaModal);
  }, { once: true });
}
if (rubricaGrabber) {
  abilitaSwipeVerticale(
    rubricaGrabber,
    () => {}, // swipe verso l'alto → niente
    () => chiudiRubricaConAnimazioneVert(),
    true,
    80 // soglia alta per evitare chiusure involontarie
  );
}

// ─── Rubrica (caricamento e rendering identici) ───────────────────────────────
let clientiCache = null;

openRubrica.addEventListener("click", async () => {
  if (!clientiCache) {
    const snap = await getDocs(collection(db, "clienti"));
    clientiCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    clientiCache.sort((a,b) => (a.nome || "").localeCompare(b.nome || ""));
  }
  renderRubrica(clientiCache);
  searchCliente.value = "";
  letterNavPicker.style.display = "flex";
  showModal(rubricaModal);
});

function renderRubrica(clienti) {
  // Raggruppa per iniziale
  const groups = {};
  clienti.forEach(c => {
    const L = (c.nome ? c.nome.charAt(0) : "#").toUpperCase();
    (groups[L] = groups[L] || []).push(c);
  });
  const letters = Object.keys(groups).sort();

  // Lista
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
        closeModal(rubricaModal);
        updateNavState();
      };
      clientListPicker.appendChild(li);
    });
  });

  // A–Z nav
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

// Ricerca live nella rubrica
searchCliente.addEventListener("input", () => {
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

// ─── Trattamenti ──────────────────────────────────────────────────────────────
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

async function caricaTrattamenti() {
  wrapperTratt.innerHTML = "";
  try {
    const snap = await getDocs(collection(db, "trattamenti"));
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    lista.sort((a,b) => (a.nome || "").localeCompare(b.nome || ""));
    for (const t of lista) {
      const icona = t.icona || trovaIcona(t.nome);
      const row = document.createElement("div");
      row.classList.add("trattamento-row");
      row.innerHTML = `
        <label>
          <input type="checkbox" class="trattamento-checkbox"
                 data-nome="${t.nome}" data-prezzo="${t.prezzo}" data-icona="${icona}">
          <img src="${icona}" alt="${t.nome}" class="icona-trattamento">
          ${t.nome}
        </label>
        <input type="number" class="prezzo-input" placeholder="€${t.prezzo}" value="${t.prezzo}" min="0" step="0.01">
      `;
      wrapperTratt.appendChild(row);
    }
  } catch (e) {
    console.error("Errore caricamento trattamenti:", e);
    alert("Errore nel caricamento dei trattamenti.");
  }
}

// ─── Navigazione step ─────────────────────────────────────────────────────────
btnToStep2.addEventListener("click", () => {
  if (!clienteIdHidden.value) return alert("Seleziona un cliente");
  step1.style.display = "none";
  step2.style.display = "block";
});
btnBackToStep1.addEventListener("click", () => {
  step2.style.display = "none";
  step1.style.display = "block";
});
btnToStep3.addEventListener("click", () => {
  if (!(inpData.value && inpOra.value)) return alert("Inserisci data e ora");
  step2.style.display = "none";
  step3.style.display = "block";
});
btnBackToStep2.addEventListener("click", () => {
  step3.style.display = "none";
  step2.style.display = "block";
});

// ─── Salvataggio appuntamento ────────────────────────────────────────────────
btnSalva.addEventListener("click", async () => {
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
    const prezzoVal = parseFloat(prezzoInput.value);
    return {
      nome: cb.dataset.nome,
      prezzo: Number.isFinite(prezzoVal) ? prezzoVal : 0,
      icona: cb.dataset.icona || trovaIcona(cb.dataset.nome)
    };
  });
  const [y, m, d] = data.split("-").map(n => parseInt(n, 10));
  const [hh, mm]  = ora.split(":").map(n => parseInt(n, 10));
  const localDate = new Date(y, m - 1, d, hh, mm, 0, 0);
  const dateTime  = Timestamp.fromDate(localDate);
  try {
    await addDoc(collection(db, "appuntamenti"), {
      clienteId,
      date: data,
      time: ora,
      dateTime,
      trattamenti
    });
    alert("Appuntamento salvato con successo!");
    location.href = "calendario.html";
  } catch (err) {
    console.error("Errore salvataggio:", err);
    alert("Errore durante il salvataggio.");
  }
});

// ─── Avvio ────────────────────────────────────────────────────────────────────
caricaTrattamenti();
updateNavState();