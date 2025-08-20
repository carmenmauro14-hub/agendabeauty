// ================== Firebase setup (autonomo) ==================
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, getDoc, updateDoc, collection, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD0tDQQepdvj_oZPcQuUrEKpoNOd4zF0nE",
  authDomain: "agenda-carmenmauro.firebaseapp.com",
  projectId: "agenda-carmenmauro",
  storageBucket: "agenda-carmenmauro.appspot.com",
  messagingSenderId: "959324976221",
  appId: "1:959324976221:web:780c8e9195965cea0749b4"
};
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ================== Utility ==================
const € = (n) => Number(n || 0).toLocaleString("it-IT", { style:"currency", currency:"EUR" });

function getClienteId() {
  const url = new URLSearchParams(location.search);
  return url.get("id") || sessionStorage.getItem("clienteId") || null;
}
function safeDate(d) {
  if (!d) return null;
  if (d.toDate) return d.toDate();
  if (typeof d === "number") return new Date(d);
  if (typeof d === "string") return new Date(d);
  return d instanceof Date ? d : null;
}

// ================== DOM ==================
const backBtn       = document.getElementById("backBtn");
const editBtnTop    = document.getElementById("editBtnTop");

const avatarIniziali= document.getElementById("avatarIniziali");
const displayName   = document.getElementById("displayName");
const displayPhone  = document.getElementById("displayPhone");
const infoPhone     = document.getElementById("infoPhone");
const infoEmail     = document.getElementById("infoEmail");
const rowEmail      = document.getElementById("rowEmail");

const yearSelect    = document.getElementById("yearSelect");
const valAnno       = document.getElementById("valAnno");
const valTotale     = document.getElementById("valTotale");
const barAnno       = document.getElementById("barAnno");
const barTotale     = document.getElementById("barTotale");
const yearByTreatment = document.getElementById("yearByTreatment");

const historyList   = document.getElementById("historyList");

const editSheet     = document.getElementById("editSheet");
const closeEdit     = document.getElementById("closeEdit");
const editForm      = document.getElementById("editForm");
const editNome      = document.getElementById("editNome");
const editTelefono  = document.getElementById("editTelefono");
const editEmail     = document.getElementById("editEmail");
const cancelEdit    = document.getElementById("cancelEdit");

// Quick actions
const btnSms        = document.getElementById("btnSms");
const btnCall       = document.getElementById("btnCall");
const btnWa         = document.getElementById("btnWa");
const btnApp        = document.getElementById("btnApp");
const btnRem        = document.getElementById("btnRem");

// ================== Stato ==================
let clienteId   = null;
let clienteData = null;

// ================== Caricamento Cliente ==================
async function caricaCliente() {
  clienteId = getClienteId();
  if (!clienteId) {
    console.warn("Nessun id cliente nell’URL o in sessionStorage.");
    return;
  }

  const ref  = doc(db, "clienti", clienteId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    console.warn("Cliente non trovato:", clienteId);
    return;
  }
  clienteData = snap.data();

  // Nome, telefono, email
  const nome = clienteData.nome || "—";
  const tel  = (clienteData.telefono || "").toString().trim();
  const mail = (clienteData.email || "").toString().trim();

  displayName.textContent = nome;
  displayPhone.textContent = tel || "—";

  infoPhone.textContent = tel || "—";
  infoPhone.href = tel ? `tel:${tel}` : "#";

  if (mail) {
    rowEmail.style.display = "";
    infoEmail.textContent = mail;
    infoEmail.href = `mailto:${mail}`;
  } else {
    rowEmail.style.display = "none";
  }

  // Avatar iniziali
  const iniziali = nome
    .split(" ")
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .slice(0,2)
    .join("") || "AA";
  avatarIniziali.textContent = iniziali;

  // Quick actions
  if (tel) {
    btnSms.href = `sms:${tel}`;
    btnCall.href = `tel:${tel}`;
    // rimuovo spazi/simboli dal tel per wa.me
    const waNumber = tel.replace(/[^\d]/g, "");
    btnWa.href = `https://wa.me/${waNumber}`;
  } else {
    btnSms.removeAttribute("href");
    btnCall.removeAttribute("href");
    btnWa.removeAttribute("href");
  }
  // Nuovo appuntamento: passa id cliente
  btnApp.href = `nuovo-appuntamento.html?cliente=${encodeURIComponent(clienteId)}`;

  // Promemoria (placeholder)
  btnRem.onclick = (e) => {
    e.preventDefault();
    alert("Promemoria WhatsApp: funzione in sviluppo.");
  };

  // Storico + Statistiche
  await caricaStoricoETotale();
  await popolaAnniERender();
}

// ================== Storico & Totale ==================
async function caricaStoricoETotale() {
  historyList.innerHTML = "";

  const q  = query(collection(db, "appuntamenti"), where("clienteId", "==", clienteId));
  const qs = await getDocs(q);

  const items = [];
  let totaleSempre = 0;

  qs.forEach(s => {
    const a = s.data();
    const dt = safeDate(a.data || a.date || a.dateTime);
    const tratt = Array.isArray(a.trattamenti)
      ? a.trattamenti.map(t => (t?.nome || t)).join(", ")
      : (a.trattamento || a.titolo || "");
    const prezzo = Number(a.prezzo || a.totale || 0);

    if (!isNaN(prezzo)) totaleSempre += prezzo;

    items.push({
      dt,
      tratt: tratt || "—",
      prezzo
    });
  });

  // Ordina per data desc
  items.sort((a,b) => (b.dt?.getTime?.()||0) - (a.dt?.getTime?.()||0));

  const fmt = new Intl.DateTimeFormat("it-IT", { day:"2-digit", month:"2-digit", year:"2-digit" });

  items.forEach(it => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <div class="h-date">${it.dt ? fmt.format(it.dt) : "—"}</div>
        <div class="h-tratt">${it.tratt}</div>
      </div>
      <div class="h-amt">${€(it.prezzo)}</div>
    `;
    historyList.appendChild(li);
  });

  // Totale sempre
  valTotale.textContent = €(totaleSempre);
  barTotale.style.width = "100%";
}

// ================== Statistiche per anno ==================
async function popolaAnniERender() {
  // raccogli anni presenti
  const q  = query(collection(db, "appuntamenti"), where("clienteId", "==", clienteId));
  const qs = await getDocs(q);
  const anni = new Set();

  qs.forEach(s => {
    const dt = safeDate(s.data().data || s.data().date || s.data().dateTime);
    if (dt) anni.add(dt.getFullYear());
  });

  const arr = [...anni].sort((a,b)=>b-a);
  const current = new Date().getFullYear();
  yearSelect.innerHTML = (arr.length ? arr : [current])
    .map(y => `<option value="${y}">${y}</option>`)
    .join("");

  yearSelect.value = arr.includes(current) ? current : (arr[0] || current);
  await aggiornaStatistiche(Number(yearSelect.value));

  yearSelect.onchange = () => aggiornaStatistiche(Number(yearSelect.value));
}

async function aggiornaStatistiche(anno) {
  const q  = query(collection(db, "appuntamenti"), where("clienteId", "==", clienteId));
  const qs = await getDocs(q);

  let totAnno = 0;
  const perTratt = {}; // nome -> {count, sum}

  qs.forEach(s => {
    const a = s.data();
    const dt = safeDate(a.data || a.date || a.dateTime);
    if (!dt || dt.getFullYear() !== anno) return;

    // trattamenti (array o stringa singola)
    let trattList = [];
    if (Array.isArray(a.trattamenti)) {
      trattList = a.trattamenti.map(t => (t?.nome || t?.titolo || t)).filter(Boolean);
    } else if (a.trattamento || a.titolo) {
      trattList = [a.trattamento || a.titolo];
    }

    const prezzo = Number(a.prezzo || a.totale || 0);
    totAnno += isNaN(prezzo) ? 0 : prezzo;

    trattList.forEach(n => {
      if (!perTratt[n]) perTratt[n] = { count: 0, sum: 0 };
      perTratt[n].count += 1;
      perTratt[n].sum   += isNaN(prezzo) ? 0 : prezzo;
    });
  });

  valAnno.textContent = €(totAnno);

  // percentuale anno vs totale sempre
  const totalSempreNum = Number(valTotale.textContent.replace(/[^\d,.-]/g,"").replace(",","."));
  const perc = totalSempreNum > 0 ? Math.max(0, Math.min(100, (totAnno / totalSempreNum) * 100)) : 0;
  barAnno.style.width = `${perc.toFixed(0)}%`;

  // lista per trattamento
  const entries = Object.entries(perTratt)
    .sort((a,b)=> b[1].count - a[1].count || b[1].sum - a[1].sum);

  yearByTreatment.innerHTML = entries.length
    ? entries.map(([nome,v]) => `
        <li>
          <div class="qta-nome">${v.count} ${nome}</div>
          <div class="totale">Tot. ${€(v.sum)}</div>
        </li>
      `).join("")
    : "<li>—</li>";
}

// ================== Header events ==================
backBtn.addEventListener("click", () => history.back());

editBtnTop.addEventListener("click", () => {
  if (!clienteData) return;
  editNome.value     = clienteData.nome || "";
  editTelefono.value = clienteData.telefono || "";
  editEmail.value    = clienteData.email || "";
  editSheet.classList.remove("hidden");
});

// ================== Edit form ==================
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
  caricaCliente(); // refresh
});

// ================== Avvio ==================
caricaCliente();