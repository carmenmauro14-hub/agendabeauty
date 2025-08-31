import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection, addDoc, deleteDoc, doc,
  query, where, orderBy, onSnapshot, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ✅ Config Firebase corretta
const firebaseConfig = {
  apiKey: "AIzaSyD0tDQQepdvj_oZPcQuUrEKpoNOd4zF0nE",
  authDomain: "agenda-carmenmauro.firebaseapp.com",
  projectId: "agenda-carmenmauro",
  storageBucket: "agenda-carmenmauro.appspot.com",   // ← fix qui
  messagingSenderId: "959324976221",
  appId: "1:959324976221:web:780c8e9195965cea0749b4"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db  = getFirestore(app);

const listaTrattamenti = document.getElementById("lista-trattamenti");
const form             = document.getElementById("form-trattamento");
const input            = document.getElementById("nuovoTrattamento");

// UI helpers
function setLoading(on) {
  if (on) {
    listaTrattamenti.innerHTML = `<li style="opacity:.7">Caricamento…</li>`;
  }
}

function renderList(snapshot) {
  listaTrattamenti.innerHTML = "";
  if (snapshot.empty) {
    listaTrattamenti.innerHTML = `<li style="opacity:.7">Nessun trattamento</li>`;
    return;
  }
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const li = document.createElement("li");
    li.style.display = "flex";
    li.style.alignItems = "center";
    li.style.justifyContent = "space-between";
    li.style.gap = "10px";
    li.style.padding = "10px 0";
    li.style.borderBottom = "1px solid #e6d9d0";

    const name = document.createElement("span");
    name.textContent = data.nome || "—";
    name.style.fontWeight = "600";
    name.style.color = "#a07863";

    const btn = document.createElement("button");
    btn.textContent = "❌";
    btn.setAttribute("aria-label", "Elimina trattamento");
    btn.style.border = "1px solid #e6d9d0";
    btn.style.borderRadius = "8px";
    btn.style.background = "#fff";
    btn.style.cursor = "pointer";
    btn.style.padding = "4px 8px";
    btn.onclick = async () => {
      if (confirm(`Rimuovere "${data.nome}"?`)) {
        await deleteDoc(doc(db, "trattamenti", docSnap.id));
      }
    };

    li.appendChild(name);
    li.appendChild(btn);
    listaTrattamenti.appendChild(li);
  });
}

// 🔁 Realtime + ordinamento A→Z
function startRealtime() {
  setLoading(true);
  const qRef = query(collection(db, "trattamenti"), orderBy("nomeLower", "asc"));
  return onSnapshot(qRef, (snap) => {
    renderList(snap);
  }, (err) => {
    console.error("Errore realtime:", err);
    listaTrattamenti.innerHTML = `<li style="color:#b00020">Errore nel caricamento.</li>`;
  });
}

// ❌ Evita duplicati (case-insensitive)
async function esisteGia(nome) {
  const nomeLower = nome.trim().toLowerCase();
  const qRef = query(collection(db, "trattamenti"), where("nomeLower", "==", nomeLower));
  const snap = await getDocs(qRef);
  return !snap.empty;
}

// ➕ Aggiunta nuovo trattamento
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = (input.value || "").trim();
  if (!nome) return;

  if (await esisteGia(nome)) {
    alert("Questo trattamento esiste già.");
    return;
  }

  await addDoc(collection(db, "trattamenti"), {
    nome,
    nomeLower: nome.toLowerCase()
  });

  input.value = "";
  input.focus();
});

// Avvio
const stop = startRealtime();
// (opzionale) puoi chiamare stop() quando esci dalla pagina per staccare il listener