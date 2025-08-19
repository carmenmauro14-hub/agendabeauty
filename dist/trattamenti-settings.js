import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, getDocs, addDoc, deleteDoc, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const db = getFirestore(getApp());

const btnNuovo = document.getElementById("btn-nuovo-trattamento");
const form = document.getElementById("form-trattamento");
const inputNome = document.getElementById("nuovoTrattamento");
const inputPrezzo = document.getElementById("prezzoTrattamento");
const selettoreIcone = document.getElementById("selettore-icone");
const inputIconaSelezionata = document.getElementById("iconaSelezionata");
const listaTrattamenti = document.getElementById("lista-trattamenti");

const azioniAggiunta = document.getElementById("azioni-form-aggiunta");
const azioniModifica = document.getElementById("azioni-form-modifica");
const btnAnnullaAggiunta = document.getElementById("btn-annulla-aggiunta");
const btnAnnullaModifica = document.getElementById("btn-annulla-modifica");
const btnSalvaModifiche = document.getElementById("btn-salva-modifiche");

let idModifica = null;

const iconeDisponibili = [
  "makeup_sposa", "makeup", "microblading", "extension_ciglia",
  "laminazione_ciglia", "filo_arabo", "architettura_sopracciglia", "airbrush_sopracciglia"
];

/* ————— Helpers € ————— */
function parseEuro(str) {
  if (typeof str !== "string") return Number(str) || 0;
  const n = str.replace(/\s/g, "").replace("€", "").replace(/\./g, "").replace(",", ".");
  const v = parseFloat(n);
  return Number.isFinite(v) ? v : 0;
}
function formatEuroCompact(n) {
  const v = Number(n || 0);
  return "€" + v.toFixed(2).replace(".", ",");
}

/* ————— Icone ————— */
function mostraIcone(container, onSelect, iconaPredefinita = "") {
  container.innerHTML = "";
  iconeDisponibili.forEach(nome => {
    const img = document.createElement("img");
    img.src = `icones_trattamenti/${nome}.png`;
    img.alt = nome;
    img.classList.add("icona-selezionabile");
    if (iconaPredefinita && img.src === iconaPredefinita) img.classList.add("selezionata");
    img.addEventListener("click", () => {
      container.querySelectorAll(".icona-selezionabile").forEach(i => i.classList.remove("selezionata"));
      img.classList.add("selezionata");
      onSelect(img.src);
    });
    container.appendChild(img);
  });
}

/* ————— Nuovo trattamento ————— */
btnNuovo.addEventListener("click", () => {
  form.style.display = "flex";
  form.reset();
  inputIconaSelezionata.value = "";
  mostraIcone(selettoreIcone, src => (inputIconaSelezionata.value = src));
  azioniAggiunta.style.display = "flex";
  azioniModifica.style.display = "none";
  idModifica = null;
});
btnAnnullaAggiunta.addEventListener("click", () => {
  form.reset();
  form.style.display = "none";
});

/* ————— Modifica trattamento ————— */
btnAnnullaModifica.addEventListener("click", () => {
  form.reset();
  form.style.display = "none";
  idModifica = null;
});
btnSalvaModifiche.addEventListener("click", async () => {
  const nome = inputNome.value.trim();
  const prezzo = parseEuro(inputPrezzo.value);
  const icona = inputIconaSelezionata.value;
  if (!nome || !Number.isFinite(prezzo) || prezzo < 0 || !icona) {
    return alert("Compila tutti i campi e seleziona un’icona.");
  }
  try {
    await updateDoc(doc(db, "trattamenti", idModifica), { nome, prezzo, icona });
  } catch (err) { console.error(err); }
  await caricaTrattamenti();
  form.reset();
  form.style.display = "none";
  idModifica = null;
});

/* ————— Submit nuovo ————— */
form.addEventListener("submit", async e => {
  e.preventDefault();
  const nome = inputNome.value.trim();
  const prezzo = parseEuro(inputPrezzo.value);
  const icona = inputIconaSelezionata.value;
  if (!nome || !Number.isFinite(prezzo) || prezzo < 0 || !icona) {
    return alert("Compila tutti i campi e seleziona un’icona.");
  }
  try {
    await addDoc(collection(db, "trattamenti"), { nome, prezzo, icona });
  } catch (err) { console.error(err); }
  await caricaTrattamenti();
  form.reset();
  form.style.display = "none";
});

/* ————— Carica lista ————— */
async function caricaTrattamenti() {
  listaTrattamenti.innerHTML = "";
  const snapshot = await getDocs(collection(db, "trattamenti"));

  snapshot.forEach(docSnap => {
    const { nome, prezzo, icona } = docSnap.data();

    // Riga come <div> (niente <li>), 3 colonne in CSS Grid
    const row = document.createElement("div");
    row.className = "trattamento-item";
    row.dataset.id = docSnap.id;

    row.innerHTML = `
      <div class="trattamento-info">
        <img src="${icona}" class="icona-trattamento" alt="">
        <span class="nome-trattamento">${nome}</span>
      </div>
      <span class="prezzo-trattamento">${formatEuroCompact(prezzo)}</span>
      <div class="azioni-trattamento">
        <i class="fas fa-pen btn-edit" title="Modifica" role="button" tabindex="0" aria-label="Modifica"></i>
        <i class="fas fa-trash btn-delete" title="Elimina" role="button" tabindex="0" aria-label="Elimina"></i>
      </div>
    `;
    listaTrattamenti.appendChild(row);
  });
}

/* ————— Azioni (edit/delete) ————— */
listaTrattamenti.addEventListener("click", async e => {
  const row = e.target.closest(".trattamento-item");
  if (!row) return;
  const id = row.dataset.id;

  // elimina
  if (e.target.classList.contains("btn-delete")) {
    if (confirm("Eliminare questo trattamento?")) {
      await deleteDoc(doc(db, "trattamenti", id));
      await caricaTrattamenti();
    }
    return;
  }

  // modifica
  if (e.target.classList.contains("btn-edit")) {
    const nome = row.querySelector(".nome-trattamento").textContent.trim();
    const prezzoText = row.querySelector(".prezzo-trattamento").textContent.trim();
    const prezzo = parseEuro(prezzoText);
    const icona = row.querySelector("img.icona-trattamento").src;

    inputNome.value = nome;
    inputPrezzo.value = String(prezzo).replace(".", ",");
    inputIconaSelezionata.value = icona;
    mostraIcone(selettoreIcone, src => (inputIconaSelezionata.value = src), icona);

    form.style.display = "flex";
    azioniAggiunta.style.display = "none";
    azioniModifica.style.display = "flex";
    idModifica = id;
  }
});

// Accessibilità tastiera su icone azione
listaTrattamenti.addEventListener("keydown", async e => {
  if (e.key !== "Enter" && e.key !== " ") return;
  if (e.target.classList.contains("btn-edit") || e.target.classList.contains("btn-delete")) {
    e.preventDefault();
    e.target.click();
  }
});

/* ————— Init ————— */
mostraIcone(selettoreIcone, src => (inputIconaSelezionata.value = src));
caricaTrattamenti();