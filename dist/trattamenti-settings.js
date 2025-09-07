// trattamenti-settings.js — offline-first con pending sync
import { db } from "./auth.js";
import {
  collection, getDocs, addDoc, deleteDoc, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { getAll, putOne } from "./storage.js";

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
  "laminazione_ciglia", "filo_arabo", "architettura_sopracciglia", "airbrush_sopracciglia", "laser"
];

/* ===== Helpers ===== */
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

/* ===== Icone ===== */
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

/* ===== Nuovo ===== */
btnNuovo.addEventListener("click", () => {
  form.style.display = "flex";
  form.reset();
  inputIconaSelezionata.value = "";
  mostraIcone(selettoreIcone, src => (inputIconaSelezionata.value = src));
  azioniAggiunta.style.display = "flex";
  azioniModifica.style.display = "none";
  idModifica = null;
  setTimeout(() => window.setListMaxHeight?.(), 0);
});
btnAnnullaAggiunta.addEventListener("click", () => {
  form.reset();
  form.style.display = "none";
  window.setListMaxHeight?.();
});

/* ===== Modifica ===== */
btnAnnullaModifica.addEventListener("click", () => {
  form.reset();
  form.style.display = "none";
  idModifica = null;
  window.setListMaxHeight?.();
});
btnSalvaModifiche.addEventListener("click", async () => {
  const nome = inputNome.value.trim();
  const prezzo = parseEuro(inputPrezzo.value);
  const icona = inputIconaSelezionata.value;
  if (!nome || !Number.isFinite(prezzo) || prezzo < 0 || !icona) {
    return alert("Compila tutti i campi e seleziona un’icona.");
  }

  try {
    if (navigator.onLine) {
      await updateDoc(doc(db, "trattamenti", idModifica), { nome, prezzo, icona });
      await putOne("trattamenti", { id: idModifica, nome, prezzo, icona });
    } else {
      await putOne("trattamenti", { id: idModifica, nome, prezzo, icona, __pending: true, __action: "update" });
      alert("Modifica salvata offline (sarà sincronizzata)");
    }
  } catch (err) { console.error(err); }

  await caricaTrattamenti();
  form.reset();
  form.style.display = "none";
  idModifica = null;
  window.setListMaxHeight?.();
});

/* ===== Submit nuovo ===== */
form.addEventListener("submit", async e => {
  e.preventDefault();
  const nome = inputNome.value.trim();
  const prezzo = parseEuro(inputPrezzo.value);
  const icona = inputIconaSelezionata.value;
  if (!nome || !Number.isFinite(prezzo) || prezzo < 0 || !icona) {
    return alert("Compila tutti i campi e seleziona un’icona.");
  }

  try {
    if (navigator.onLine) {
      const ref = await addDoc(collection(db, "trattamenti"), { nome, prezzo, icona });
      await putOne("trattamenti", { id: ref.id, nome, prezzo, icona });
    } else {
      const tempId = "temp-" + Date.now();
      await putOne("trattamenti", { id: tempId, nome, prezzo, icona, __pending: true, __action: "add" });
      alert("Trattamento salvato offline (sarà sincronizzato)");
    }
  } catch (err) { console.error(err); }

  await caricaTrattamenti();
  form.reset();
  form.style.display = "none";
  window.setListMaxHeight?.();
});

/* ===== Carica lista ===== */
async function caricaTrattamenti() {
  listaTrattamenti.innerHTML = "";

  let data = [];
  try {
    const snapshot = await getDocs(collection(db, "trattamenti"));
    data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    for (const t of data) await putOne("trattamenti", t);
  } catch (err) {
    console.warn("[trattamenti] offline, uso cache", err);
    data = await getAll("trattamenti");
  }

  data.forEach(({ id, nome, prezzo, icona }) => {
    const row = document.createElement("div");
    row.classList.add("trattamento-item");
    row.dataset.id = id;
    row.innerHTML = `
      <div class="trattamento-info">
        <img src="${icona}" class="icona-trattamento" alt="">
        <span class="nome-trattamento">${nome}</span>
      </div>
      <span class="prezzo-trattamento">${formatEuroCompact(prezzo)}</span>
      <div class="azioni-trattamento">
        <i class="fas fa-pen btn-edit" title="Modifica" role="button"></i>
        <i class="fas fa-trash btn-delete" title="Elimina" role="button"></i>
      </div>`;
    listaTrattamenti.appendChild(row);
  });

  window.setListMaxHeight?.();
}

/* ===== Actions ===== */
listaTrattamenti.addEventListener("click", async e => {
  const row = e.target.closest(".trattamento-item");
  if (!row) return;
  const id = row.dataset.id;

  if (e.target.classList.contains("btn-delete")) {
    if (confirm("Eliminare questo trattamento?")) {
      if (navigator.onLine) {
        await deleteDoc(doc(db, "trattamenti", id));
      } else {
        await putOne("trattamenti", { id, __pending: true, __action: "delete" });
        alert("Eliminazione salvata offline (sarà sincronizzata)");
      }
      await caricaTrattamenti();
    }
    return;
  }

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
    setTimeout(() => window.setListMaxHeight?.(), 0);
  }
});

/* ===== Init ===== */
mostraIcone(selettoreIcone, src => (inputIconaSelezionata.value = src));
caricaTrattamenti();