
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Configurazione Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD0tDQQepdvj_oZPcQuUrEKpoNOd4zF0nE",
  authDomain: "agenda-carmenmauro.firebaseapp.com",
  projectId: "agenda-carmenmauro",
  storageBucket: "agenda-carmenmauro.firebasestorage.app",
  messagingSenderId: "959324976221",
  appId: "1:959324976221:web:780c8e9195965cea0749b4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const listaTrattamenti = document.getElementById("lista-trattamenti");
const form = document.getElementById("form-trattamento");
const input = document.getElementById("nuovoTrattamento");

// Carica trattamenti da Firebase
async function caricaTrattamenti() {
  listaTrattamenti.innerHTML = "";
  const snapshot = await getDocs(collection(db, "trattamenti"));
  snapshot.forEach(docSnap => {
    const li = document.createElement("li");
    li.textContent = docSnap.data().nome;
    const btn = document.createElement("button");
    btn.textContent = "❌";
    btn.onclick = async () => {
      if (confirm("Rimuovere questo trattamento?")) {
        await deleteDoc(doc(db, "trattamenti", docSnap.id));
        caricaTrattamenti();
      }
    };
    li.appendChild(btn);
    listaTrattamenti.appendChild(li);
  });
}

// Aggiungi nuovo trattamento
form.onsubmit = async e => {
  e.preventDefault();
  const nome = input.value.trim();
  if (!nome) return;
  await addDoc(collection(db, "trattamenti"), { nome });
  input.value = "";
  caricaTrattamenti();
};

caricaTrattamenti();
