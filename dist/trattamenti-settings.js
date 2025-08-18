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

/* ───────────────── helpers € ───────────────── */
function parseEuro(str) {
  if (typeof str !== "string") return Number(str) || 0;
  // rimuovi € e spazi, poi togli separatori migliaia e metti la virgola come punto
  const n = str.replace(/\s/g, "").replace("€", "").replace(/\./g, "").replace(",", ".");
  const v = parseFloat(n);
  return Number.isFinite(v) ? v : 0;
}
function formatEuroCompact(n) {
  const v = Number(n || 0);
  // forma compatta: €25,00
  try {
    // toLocaleString con currency aggiunge spazio in alcune piattaforme; scelgo manuale
    return "€" + v.toFixed(2).replace(".", ",");
  } catch {
    return "€" + (Math.round(v * 100) / 100).toFixed(2).replace(".", ",");
  }
}

/* ──────────────── icone ──────────────── */
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

/* ──────────────── form: nuovo ──────────────── */
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

/* ──────────────── form: modifica ──────────────── */
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
  } catch (err) {
    console.error(err);
  }
  await caricaTrattamenti();
  form.reset();
  form.style.display = "none";
  idModifica = null;
});

/* ──────────────── submit nuovo ──────────────── */
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
  } catch (err) {
    console.error(err);
  }
  await caricaTrattamenti();
  form.reset();
  form.style.display = "none";
});

/* ──────────────── load list ──────────────── */
async function caricaTrattamenti() {
  listaTrattamenti.innerHTML = "";
  const snapshot = await getDocs(collection(db, "trattamenti"));

  snapshot.forEach(docSnap => {
    const { nome, prezzo, icona } = docSnap.data();
    const li = document.createElement("li");
    li.classList.add("trattamento-item");
    li.dataset.id = docSnap.id;

    // ⚠️ Struttura in 3 colonne (match con CSS grid):
    // [ .trattamento-info ] [ .prezzo-trattamento ] [ .azioni-trattamento ]
    li.innerHTML = `
      <div class="trattamento-info">
        <img src="${icona}" class="icona-trattamento" alt="">
        <span class="nome-trattamento">${nome}</span>
      </div>
      <span class="prezzo-trattamento">${formatEuroCompact(prezzo)}</span>
      <div class="azioni-trattamento">
        <i class="fas fa-pen btn-edit" title="Modifica"></i>
        <i class="fas fa-trash btn-delete" title="Elimina"></i>
      </div>
    `;
    listaTrattamenti.appendChild(li);
  });
}

/* ──────────────── actions (edit/delete) ──────────────── */
listaTrattamenti.addEventListener("click", async e => {
  const li = e.target.closest("li.trattamento-item");
  if (!li) return;
  const id = li.dataset.id;

  if (e.target.classList.contains("btn-delete")) {
    if (confirm("Eliminare questo trattamento?")) {
      await deleteDoc(doc(db, "trattamenti", id));
      await caricaTrattamenti();
    }
    return;
  }

  if (e.target.classList.contains("btn-edit")) {
    const nome = li.querySelector(".nome-trattamento").textContent.trim();
    const prezzoText = li.querySelector(".prezzo-trattamento").textContent.trim();
    const prezzo = parseEuro(prezzoText);
    const icona = li.querySelector("img.icona-trattamento").src;

    inputNome.value = nome;
    inputPrezzo.value = String(prezzo).replace(".", ","); // comodità per l'utente
    inputIconaSelezionata.value = icona;
    mostraIcone(selettoreIcone, src => (inputIconaSelezionata.value = src), icona);

    form.style.display = "flex";
    azioniAggiunta.style.display = "none";
    azioniModifica.style.display = "flex";
    idModifica = id;
  }
});

/* ──────────────── init ──────────────── */
mostraIcone(selettoreIcone, src => (inputIconaSelezionata.value = src));
caricaTrattamenti();