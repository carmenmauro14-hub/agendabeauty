import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, getDoc, updateDoc, deleteDoc, collection, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const db = getFirestore(getApp());

// === ELEMENTI DOM ===
const backBtn = document.getElementById("backBtn");
const editBtnTop = document.getElementById("editBtnTop");

const avatarIniziali = document.getElementById("avatarIniziali");
const displayName = document.getElementById("displayName");
const displayPhone = document.getElementById("displayPhone");
const infoPhone = document.getElementById("infoPhone");
const infoEmail = document.getElementById("infoEmail");
const rowEmail = document.getElementById("rowEmail");

const yearSelect = document.getElementById("yearSelect");
const valAnno = document.getElementById("valAnno");
const valTotale = document.getElementById("valTotale");
const barAnno = document.getElementById("barAnno");
const barTotale = document.getElementById("barTotale");
const yearByTreatment = document.getElementById("yearByTreatment");

const historyList = document.getElementById("historyList");

const editSheet = document.getElementById("editSheet");
const closeEdit = document.getElementById("closeEdit");
const editForm = document.getElementById("editForm");
const editNome = document.getElementById("editNome");
const editTelefono = document.getElementById("editTelefono");
const editEmail = document.getElementById("editEmail");
const cancelEdit = document.getElementById("cancelEdit");

// Bottoni quick actions
const btnSms = document.getElementById("btnSms");
const btnCall = document.getElementById("btnCall");
const btnWa = document.getElementById("btnWa");
const btnApp = document.getElementById("btnApp");
const btnRem = document.getElementById("btnRem");

// === DATI ===
let clienteId = null;
let clienteData = null;

// === FUNZIONI ===
function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

async function caricaCliente() {
  clienteId = getQueryParam("id");
  if (!clienteId) return;

  const ref = doc(db, "clienti", clienteId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  clienteData = snap.data();

  // Mostra dati
  displayName.textContent = clienteData.nome || "—";
  displayPhone.textContent = clienteData.telefono || "—";

  infoPhone.href = "tel:" + (clienteData.telefono || "");
  infoPhone.textContent = clienteData.telefono || "—";

  if (clienteData.email) {
    rowEmail.style.display = "";
    infoEmail.textContent = clienteData.email;
    infoEmail.href = "mailto:" + clienteData.email;
  } else {
    rowEmail.style.display = "none";
  }

  // Avatar iniziali
  avatarIniziali.textContent = (clienteData.nome || "??")
    .split(" ")
    .map(w => w.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");

  // Imposta quick actions
  if (clienteData.telefono) {
    btnSms.href = `sms:${clienteData.telefono}`;
    btnCall.href = `tel:${clienteData.telefono}`;
    btnWa.href = `https://wa.me/${clienteData.telefono}`;
  } else {
    btnSms.removeAttribute("href");
    btnCall.removeAttribute("href");
    btnWa.removeAttribute("href");
  }

  // (Nuovo App.) → già ha href a nuovo-appuntamento.html, ma possiamo passare id cliente
  btnApp.href = `nuovo-appuntamento.html?cliente=${clienteId}`;

  // Promemoria (non implementato ancora)
  btnRem.addEventListener("click", () => {
    alert("Funzione promemoria WhatsApp in sviluppo");
  });

  // Carica storico e statistiche
  await caricaStorico();
  popolaAnni();
}

async function caricaStorico() {
  historyList.innerHTML = "";

  const q = query(collection(db, "appuntamenti"), where("clienteId", "==", clienteId));
  const qs = await getDocs(q);

  let totaleSempre = 0;
  let appuntamenti = [];

  qs.forEach(docSnap => {
    const data = docSnap.data();
    appuntamenti.push(data);

    if (data.prezzo) totaleSempre += Number(data.prezzo);
  });

  // Ordina per data discendente
  appuntamenti.sort((a,b) => (b.data?.seconds||0) - (a.data?.seconds||0));

  appuntamenti.forEach(app => {
    const li = document.createElement("li");

    const dataObj = app.data?.toDate ? app.data.toDate() : null;
    const dataStr = dataObj
      ? dataObj.toLocaleDateString("it-IT", { day:"2-digit", month:"2-digit", year:"2-digit" })
      : "—";

    const tratt = Array.isArray(app.trattamenti) ? app.trattamenti.join(", ") : (app.trattamento || "");
    const prezzo = app.prezzo ? `€ ${Number(app.prezzo).toFixed(2)}` : "";

    li.innerHTML = `
      <div>
        <div class="h-date">${dataStr}</div>
        <div class="h-tratt">${tratt}</div>
      </div>
      <div class="h-amt">${prezzo}</div>
    `;
    historyList.appendChild(li);
  });

  // Totale di sempre
  valTotale.textContent = `€ ${totaleSempre.toFixed(2)}`;
  barTotale.style.width = "100%"; // sempre pieno come baseline
}

function popolaAnni() {
  const annoCorrente = new Date().getFullYear();
  yearSelect.innerHTML = "";

  for (let a = annoCorrente; a >= annoCorrente - 5; a--) {
    const opt = document.createElement("option");
    opt.value = a;
    opt.textContent = a;
    yearSelect.appendChild(opt);
  }

  yearSelect.value = annoCorrente;
  aggiornaStatistiche(annoCorrente);

  yearSelect.addEventListener("change", () => {
    aggiornaStatistiche(Number(yearSelect.value));
  });
}

async function aggiornaStatistiche(anno) {
  if (!clienteId) return;

  const q = query(collection(db, "appuntamenti"), where("clienteId", "==", clienteId));
  const qs = await getDocs(q);

  let totaleAnno = 0;
  let perTratt = {};

  qs.forEach(docSnap => {
    const app = docSnap.data();
    if (!app.data?.toDate) return;

    const d = app.data.toDate();
    if (d.getFullYear() === anno) {
      if (app.prezzo) totaleAnno += Number(app.prezzo);

      if (Array.isArray(app.trattamenti)) {
        app.trattamenti.forEach(t => {
          perTratt[t] = (perTratt[t] || 0) + Number(app.prezzo || 0);
        });
      } else if (app.trattamento) {
        perTratt[app.trattamento] = (perTratt[app.trattamento] || 0) + Number(app.prezzo || 0);
      }
    }
  });

  valAnno.textContent = `€ ${totaleAnno.toFixed(2)}`;
  // barra: percentuale rispetto al totale di sempre
  const totaleSempre = parseFloat(valTotale.textContent.replace(/[^\d,.-]/g,"").replace(",","."));
  let perc = totaleSempre > 0 ? (totaleAnno / totaleSempre) * 100 : 0;
  barAnno.style.width = perc.toFixed(0) + "%";

  // Dettaglio per trattamento
  yearByTreatment.innerHTML = "";
  if (Object.keys(perTratt).length === 0) {
    yearByTreatment.innerHTML = "<li>—</li>";
  } else {
    for (let [nome, spesa] of Object.entries(perTratt)) {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="qta-nome">${nome}</div>
        <div class="totale">€ ${spesa.toFixed(2)}</div>
      `;
      yearByTreatment.appendChild(li);
    }
  }
}

// === EVENTI HEADER ===
backBtn.addEventListener("click", () => {
  window.history.back();
});

editBtnTop.addEventListener("click", () => {
  if (!clienteData) return;
  editNome.value = clienteData.nome || "";
  editTelefono.value = clienteData.telefono || "";
  editEmail.value = clienteData.email || "";
  editSheet.classList.remove("hidden");
});

// === EDIT FORM ===
closeEdit.addEventListener("click", () => editSheet.classList.add("hidden"));
cancelEdit.addEventListener("click", () => editSheet.classList.add("hidden"));

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!clienteId) return;

  const ref = doc(db, "clienti", clienteId);
  await updateDoc(ref, {
    nome: editNome.value.trim(),
    telefono: editTelefono.value.trim(),
    email: editEmail.value.trim()
  });

  editSheet.classList.add("hidden");
  caricaCliente();
});

// === AVVIO ===
caricaCliente();