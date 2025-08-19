import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs,
  doc, deleteDoc, setDoc, query, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ─── Firebase ────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyD0tDQQepdvj_oZPcQuUrEKpoNOd4zF0nE",
  authDomain: "agenda-carmenmauro.firebaseapp.com",
  projectId: "agenda-carmenmauro",
  storageBucket: "agenda-carmenmauro.appspot.com",
  messagingSenderId: "959324976221",
  appId: "1:959324976221:web:780c8e9195965cea0749b4"
};

// ✅ Protezione contro doppia inizializzazione
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

// ─── Elementi DOM ────────────────────────────────────
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

// Statistiche DOM
const statTotale = document.getElementById("statTotale");
const statUltimo = document.getElementById("statUltimo");
const statSpeso  = document.getElementById("statSpeso");
const statTop    = document.getElementById("statTop");

let currentId = null;

// ─── Helper: apri/chiudi modal ───────────────────────
function showModal(m) { m.style.display = "flex"; }
function closeModal(m) { m.style.display = "none"; }

// ─── Load & render rubrica ───────────────────────────
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

// ─── Aggiungi cliente ────────────────────────────────
openAddModal.onclick = () => {
  addForm.reset();
  showModal(addModal);
};
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

// ─── Statistiche per cliente ─────────────────────────
async function caricaStatisticheCliente(clienteId) {
  // Legge tutti gli appuntamenti del cliente
  const q = query(collection(db, "appuntamenti"), where("clienteId", "==", clienteId));
  const snap = await getDocs(q);

  let totale = 0;
  let ultimo = null;
  let speso = 0;
  const freq = {}; // { nomeTrattamento: conteggio }

  snap.forEach(d => {
    const app = d.data();
    totale++;

    // data ultimo appuntamento
    const dataApp = app.data ? new Date(app.data) : null;
    if (dataApp && (!ultimo || dataApp > ultimo)) ultimo = dataApp;

    // totale speso
    speso += Number(app.totale || 0);

    // conteggio per trattamento
    (app.trattamenti || []).forEach(t => {
      const nome = (t && t.nome) ? t.nome : "Trattamento";
      freq[nome] = (freq[nome] || 0) + 1;
    });
  });

  // aggiorna UI
  if (statTotale) statTotale.textContent = String(totale);
  if (statUltimo) statUltimo.textContent = ultimo ? ultimo.toLocaleDateString("it-IT") : "—";
  if (statSpeso)  statSpeso.textContent  = speso.toFixed(2);

  if (statTop) {
    const list = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([nome, count]) => `<li>${nome}: <strong>${count}</strong></li>`)
      .join("");
    statTop.innerHTML = list || "<li>—</li>";
  }
}

// ─── Dettaglio cliente ───────────────────────────────
function openDetail(cliente) {
  currentId = cliente.id;
  detailNome.textContent = cliente.nome || "";
  detailTelefono.textContent = cliente.telefono || "—";
  editForm.classList.add("hidden");
  viewMode.style.display = "block";
  showModal(detailModal);

  // carica statistiche senza toccare il resto
  caricaStatisticheCliente(cliente.id).catch(console.error);
}
closeDetail.onclick = () => closeModal(detailModal);

// Elimina
deleteBtn.onclick = async () => {
  if (!confirm("Elimina questo cliente?")) return;
  await deleteDoc(doc(db, "clienti", currentId));
  closeModal(detailModal);
  caricaClienti();
};

// Modifica
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

// ─── Avvio iniziale ──────────────────────────────────
caricaClienti();