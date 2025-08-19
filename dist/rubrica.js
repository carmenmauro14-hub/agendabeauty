import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs,
  doc, deleteDoc, setDoc, query, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ─── Firebase ─────────────────────────────────────── */
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

/* ─── DOM ──────────────────────────────────────────── */
const clientList     = document.getElementById("clientList");
const letterNav      = document.getElementById("letterNav");
const searchInput    = document.getElementById("searchInput");

const openAddModal   = document.getElementById("openAddModal");
const addModal       = document.getElementById("addModal");
const closeAddModal  = document.getElementById("closeAddModal");
const addForm        = document.getElementById("addForm");
const addNome        = document.getElementById("addNome");
const addTelefono    = document.getElementById("addTelefono");

const detailModal    = document.getElementById("detailModal");
const closeDetail    = document.getElementById("closeDetailModal");
const detailNome     = document.getElementById("detailNome");
const detailTelefono = document.getElementById("detailTelefono");
const editBtn        = document.getElementById("editBtn");
const deleteBtn      = document.getElementById("deleteBtn");
const editForm       = document.getElementById("editForm");
const editNome       = document.getElementById("editNome");
const editTelefono   = document.getElementById("editTelefono");
const cancelEdit     = document.getElementById("cancelEdit");
const viewMode       = document.getElementById("viewMode");

/* ─── Stats (nuovi elementi) ───────────────────────── */
const yearSelect            = document.getElementById("yearSelect");
const yearTreatmentsCountEl = document.getElementById("yearTreatmentsCount");
const yearSpentEl           = document.getElementById("yearSpent");
const lifetimeSpentEl       = document.getElementById("lifetimeSpent");
const yearByTreatmentEl     = document.getElementById("yearByTreatment");

/* ─── Stato ────────────────────────────────────────── */
let currentId = null;
let currentClientAppointments = []; // cache appuntamenti del cliente aperto

/* ─── Helpers ──────────────────────────────────────── */
function showModal(m) { m.style.display = "flex"; }
function closeModal(m) { m.style.display = "none"; }

function toNumberSafe(v) {
  if (v == null) return 0;
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const clean = v.replace(/[€\s]/g, "").replace(",", ".");
    const n = parseFloat(clean);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}
function toDateSafe(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === "function") return v.toDate();
  if (typeof v === "number") return new Date(v);
  if (typeof v === "string") return new Date(v);
  return null;
}

/* ─── Lista clienti ────────────────────────────────── */
async function caricaClienti() {
  const snapshot = await getDocs(collection(db, "clienti"));
  const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  renderList(data);
}

function renderList(clienti) {
  const groups = {};
  clienti.forEach(c => {
    const L = (c.nome || "").charAt(0).toUpperCase() || "#";
    (groups[L] = groups[L] || []).push(c);
  });

  clientList.innerHTML = "";
  Object.keys(groups).sort().forEach(L => {
    const sec = document.createElement("li");
    sec.textContent = L;
    sec.className = "section";
    sec.id = "letter-" + L;
    clientList.appendChild(sec);

    groups[L]
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
      .forEach(c => {
        const li = document.createElement("li");
        li.textContent = `${c.nome}`;
        li.className = "item";
        li.onclick = () => openDetail(c);
        clientList.appendChild(li);
      });
  });
  renderLetterNav(Object.keys(groups).sort());
}

function renderLetterNav(letters) {
  letterNav.innerHTML = "";
  letters.forEach(L => {
    const el = document.createElement("span");
    el.textContent = L;
    el.onclick = () => {
      const target = document.getElementById("letter-" + L);
      target && target.scrollIntoView({ behavior: "smooth" });
    };
    letterNav.appendChild(el);
  });
}

/* ─── Ricerca live ─────────────────────────────────── */
searchInput.oninput = () => {
  const f = searchInput.value.toLowerCase();
  letterNav.style.display = f ? "none" : "flex";

  document.querySelectorAll("#clientList li.item").forEach(li => {
    li.style.display = li.textContent.toLowerCase().includes(f) ? "" : "none";
  });

  document.querySelectorAll("#clientList li.section").forEach(sec => {
    const nextItems = [];
    let el = sec.nextElementSibling;
    while (el && !el.classList.contains("section")) {
      if (el.style.display !== "none") nextItems.push(el);
      el = el.nextElementSibling;
    }
    sec.style.display = nextItems.length > 0 ? "" : "none";
  });
};

/* ─── Aggiungi cliente ─────────────────────────────── */
openAddModal.onclick = () => { addForm.reset(); showModal(addModal); };
closeAddModal.onclick = () => closeModal(addModal);

addForm.onsubmit = async e => {
  e.preventDefault();
  await addDoc(collection(db, "clienti"), {
    nome: addNome.value.trim(),
    telefono: addTelefono.value.trim()
  });
  closeModal(addModal);
  caricaClienti();
};

/* ─── Statistiche cliente con selezione anno ──────── */
async function caricaStatisticheCliente(clienteId) {
  // 1) leggi tutti gli appuntamenti del cliente
  const q = query(collection(db, "appuntamenti"), where("clienteId", "==", clienteId));
  const snap = await getDocs(q);

  currentClientAppointments = snap.docs.map(d => d.data());

  // 2) calcola lifetime e anni disponibili
  let lifetimeSpent = 0;
  const yearsSet = new Set();

  currentClientAppointments.forEach(app => {
    const tratt = Array.isArray(app.trattamenti) ? app.trattamenti : [];
    const apptTotal = tratt.reduce((sum, t) => sum + toNumberSafe(t?.prezzo ?? t?.costo ?? t?.price), 0);
    lifetimeSpent += apptTotal;

    const dt = toDateSafe(app.data || app.date || app.dateTime);
    if (dt) yearsSet.add(dt.getFullYear());
  });

  // aggiorna lifetime
  lifetimeSpentEl.textContent = lifetimeSpent.toFixed(2);

  // 3) popola select anni (desc). default: anno corrente se presente, altrimenti il max
  const years = Array.from(yearsSet).sort((a,b)=>b-a);
  yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join("") || `<option value="">—</option>`;
  const currentYear = (new Date()).getFullYear();
  if (years.includes(currentYear)) {
    yearSelect.value = String(currentYear);
  } else if (years.length) {
    yearSelect.value = String(years[0]);
  }

  // 4) render iniziale per l'anno selezionato
  renderStatsForYear(Number(yearSelect.value || years[0] || currentYear));

  // 5) change handler
  yearSelect.onchange = () => renderStatsForYear(Number(yearSelect.value));
}

function renderStatsForYear(year) {
  if (!year || !currentClientAppointments.length) {
    yearTreatmentsCountEl.textContent = "0";
    yearSpentEl.textContent = "0.00";
    yearByTreatmentEl.innerHTML = "<li>—</li>";
    return;
  }

  const freq = {}; // { nome: {count, spend} }
  let totalTreatments = 0;
  let totalSpentYear = 0;

  currentClientAppointments.forEach(app => {
    const dt = toDateSafe(app.data || app.date || app.dateTime);
    if (!dt || dt.getFullYear() !== year) return;

    const tratt = Array.isArray(app.trattamenti) ? app.trattamenti : [];
    tratt.forEach(t => {
      const nome = t?.nome || t?.titolo || t?.trattamento || "Trattamento";
      const prezzo = toNumberSafe(t?.prezzo ?? t?.costo ?? t?.price);
      if (!freq[nome]) freq[nome] = { count: 0, spend: 0 };
      freq[nome].count += 1;
      freq[nome].spend += prezzo;
      totalTreatments += 1;
      totalSpentYear += prezzo;
    });
  });

  // aggiorna UI
  yearTreatmentsCountEl.textContent = String(totalTreatments);
  yearSpentEl.textContent = totalSpentYear.toFixed(2);

  const items = Object.entries(freq)
    .sort((a,b)=> b[1].count - a[1].count || b[1].spend - a[1].spend)
    .map(([nome, v]) => `<li>${nome}: <strong>${v.count}</strong> × — €${v.spend.toFixed(2)}</li>`)
    .join("");

  yearByTreatmentEl.innerHTML = items || "<li>—</li>";
}

/* ─── Dettaglio cliente ────────────────────────────── */
function openDetail(cliente) {
  currentId = cliente.id;
  detailNome.textContent = cliente.nome || "";
  detailTelefono.textContent = cliente.telefono || "—";
  editForm.classList.add("hidden");
  viewMode.style.display = "block";
  showModal(detailModal);

  caricaStatisticheCliente(cliente.id).catch(console.error);
}
closeDetail.onclick = () => closeModal(detailModal);

/* ─── Elimina / Modifica ───────────────────────────── */
deleteBtn.onclick = async () => {
  if (!confirm("Elimina questo cliente?")) return;
  await deleteDoc(doc(db, "clienti", currentId));
  closeModal(detailModal);
  caricaClienti();
};

editBtn.onclick = () => {
  viewMode.style.display = "none";
  editForm.classList.remove("hidden");
  editNome.value = detailNome.textContent;
  editTelefono.value = detailTelefono.textContent;
};

cancelEdit.onclick = () => {
  editForm.classList.add("hidden");
  viewMode.style.display = "block";
};

editForm.onsubmit = async e => {
  e.preventDefault();
  await setDoc(doc(db, "clienti", currentId), {
    nome: editNome.value.trim(),
    telefono: editTelefono.value.trim()
  });
  closeModal(detailModal);
  caricaClienti();
};

/* ─── Avvio ────────────────────────────────────────── */
caricaClienti();