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
const formatEuro = (n) =>
  Number(n || 0).toLocaleString("it-IT", { style: "currency", currency: "EUR" });

function toNumberSafe(v){
  if (v == null) return 0;
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string"){
    const n = parseFloat(v.replace(/[€\s]/g,"").replace(",","."));
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function safeDate(d) {
  if (!d) return null;
  if (d.toDate) return d.toDate();
  if (typeof d === "number") return new Date(d);
  if (typeof d === "string") return new Date(d);
  return d instanceof Date ? d : null;
}

/** Somma correttamente il totale appuntamento. */
function getApptTotal(app){
  // 1) se c'è una lista di trattamenti -> sommo i singoli prezzi
  if (Array.isArray(app.trattamenti) && app.trattamenti.length){
    return app.trattamenti.reduce((s,t)=>{
      const p = toNumberSafe(t?.prezzo ?? t?.costo ?? t?.price);
      return s + p;
    },0);
  }
  // 2) altrimenti fallback a campi singoli
  return toNumberSafe(app.prezzo ?? app.totale ?? app.price ?? app.costo);
}

/** Restituisce i nomi dei trattamenti dell'appuntamento (per lo storico). */
function getApptNames(app){
  if (Array.isArray(app.trattamenti) && app.trattamenti.length){
    return app.trattamenti.map(t => (t?.nome || t?.titolo || t)).join(", ");
  }
  return app.trattamento || app.titolo || "";
}

// ================== DOM ==================
const backBtn        = document.getElementById("backBtn");
const editBtnTop     = document.getElementById("editBtnTop");

const avatarIniziali = document.getElementById("avatarIniziali");
const displayName    = document.getElementById("displayName");
const displayPhone   = document.getElementById("displayPhone");
const infoPhone      = document.getElementById("infoPhone");
const infoEmail      = document.getElementById("infoEmail");
const rowEmail       = document.getElementById("rowEmail");

const yearSelect     = document.getElementById("yearSelect");
const valAnno        = document.getElementById("valAnno");
const valTotale      = document.getElementById("valTotale");
const barAnno        = document.getElementById("barAnno");
const barTotale      = document.getElementById("barTotale");
const yearByTreatment= document.getElementById("yearByTreatment");

const historyList    = document.getElementById("historyList");

const editSheet      = document.getElementById("editSheet");
const closeEdit      = document.getElementById("closeEdit");
const editForm       = document.getElementById("editForm");
const editNome       = document.getElementById("editNome");
const editTelefono   = document.getElementById("editTelefono");
const editEmail      = document.getElementById("editEmail");
const cancelEdit     = document.getElementById("cancelEdit");

// Quick actions
const btnSms         = document.getElementById("btnSms");
const btnCall        = document.getElementById("btnCall");
const btnWa          = document.getElementById("btnWa");
const btnApp         = document.getElementById("btnApp");
const btnRem         = document.getElementById("btnRem");

// ================== Stato ==================
let clienteId   = null;
let clienteData = null;

function getClienteId() {
  const url = new URLSearchParams(location.search);
  return url.get("id") || sessionStorage.getItem("clienteId") || null;
}

// ================== Caricamento Cliente ==================
async function caricaCliente() {
  clienteId = getClienteId();
  if (!clienteId) return;

  const ref  = doc(db, "clienti", clienteId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  clienteData = snap.data();

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

  const iniziali = nome.split(" ").filter(Boolean).map(w=>w[0].toUpperCase()).slice(0,2).join("") || "AA";
  avatarIniziali.textContent = iniziali;

  if (tel) {
    btnSms.href = `sms:${tel}`;
    btnCall.href = `tel:${tel}`;
    btnWa.href   = `https://wa.me/${tel.replace(/[^\d]/g,"")}`;
  } else {
    btnSms.removeAttribute("href");
    btnCall.removeAttribute("href");
    btnWa.removeAttribute("href");
  }
  btnApp.href = `nuovo-appuntamento.html?cliente=${encodeURIComponent(clienteId)}`;
  btnRem.onclick = (e)=>{ e.preventDefault(); alert("Promemoria WhatsApp: funzione in sviluppo."); };

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
    const a   = s.data();
    const dt  = safeDate(a.data || a.date || a.dateTime);
    const tot = getApptTotal(a);
    totaleSempre += tot;

    items.push({
      dt,
      tratt: getApptNames(a) || "—",
      prezzo: tot
    });
  });

  items.sort((a,b) => (b.dt?.getTime?.()||0) - (a.dt?.getTime?.()||0));

  const fmt = new Intl.DateTimeFormat("it-IT", { day:"2-digit", month:"2-digit", year:"2-digit" });

  items.forEach(it => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <div class="h-date">${it.dt ? fmt.format(it.dt) : "—"}</div>
        <div class="h-tratt">${it.tratt}</div>
      </div>
      <div class="h-amt">${formatEuro(it.prezzo)}</div>
    `;
    historyList.appendChild(li);
  });

  valTotale.textContent = formatEuro(totaleSempre);
  barTotale.style.width = "100%";
}

// ================== Statistiche per anno ==================
async function popolaAnniERender() {
  const q  = query(collection(db, "appuntamenti"), where("clienteId", "==", clienteId));
  const qs = await getDocs(q);
  const anni = new Set();

  qs.forEach(s => {
    const dt = safeDate(s.data().data || s.data().date || s.data().dateTime);
    if (dt) anni.add(dt.getFullYear());
  });

  const arr = [...anni].sort((a,b)=>b-a);
  const current = new Date().getFullYear();
  yearSelect.innerHTML = (arr.length ? arr : [current]).map(y=>`<option value="${y}">${y}</option>`).join("");
  yearSelect.value = arr.includes(current) ? current : (arr[0] || current);

  await aggiornaStatistiche(Number(yearSelect.value));
  yearSelect.onchange = ()=>aggiornaStatistiche(Number(yearSelect.value));
}

async function aggiornaStatistiche(anno) {
  const q  = query(collection(db, "appuntamenti"), where("clienteId", "==", clienteId));
  const qs = await getDocs(q);

  let totAnno = 0;
  const perTratt = {}; // nome -> {count, sum}

  qs.forEach(s => {
    const a  = s.data();
    const dt = safeDate(a.data || a.date || a.dateTime);
    if (!dt || dt.getFullYear() !== anno) return;

    // sommo il totale appuntamento all'anno
    const apptTotal = getApptTotal(a);
    totAnno += apptTotal;

    // conteggio per trattamento (nome + prezzo singolo)
    if (Array.isArray(a.trattamenti) && a.trattamenti.length){
      a.trattamenti.forEach(t => {
        const nome = t?.nome || t?.titolo || "Trattamento";
        const p    = toNumberSafe(t?.prezzo ?? t?.costo ?? t?.price);
        if (!perTratt[nome]) perTratt[nome] = {count:0, sum:0};
        perTratt[nome].count += 1;
        perTratt[nome].sum   += p;
      });
    } else if (a.trattamento || a.titolo){
      const nome = a.trattamento || a.titolo;
      if (!perTratt[nome]) perTratt[nome] = {count:0, sum:0};
      perTratt[nome].count += 1;
      perTratt[nome].sum   += apptTotal;
    }
  });

  valAnno.textContent = formatEuro(totAnno);

  const totalSempreNum = Number(valTotale.textContent.replace(/[^\d,.-]/g,"").replace(",","."));
  const perc = totalSempreNum > 0 ? Math.max(0, Math.min(100, (totAnno / totalSempreNum) * 100)) : 0;
  barAnno.style.width = `${perc.toFixed(0)}%`;

  const entries = Object.entries(perTratt)
    .sort((a,b)=> b[1].count - a[1].count || b[1].sum - a[1].sum);

  yearByTreatment.innerHTML = entries.length
    ? entries.map(([nome,v]) => `
        <li>
          <div class="qta-nome">${v.count} ${nome}</div>
          <div class="totale">Tot. ${formatEuro(v.sum)}</div>
        </li>
      `).join("")
    : "<li>—</li>";
}

// ================== Header / Edit ==================
backBtn.addEventListener("click", () => history.back());

editBtnTop.addEventListener("click", () => {
  if (!clienteData) return;
  editNome.value     = clienteData.nome || "";
  editTelefono.value = clienteData.telefono || "";
  editEmail.value    = clienteData.email || "";
  editSheet.classList.remove("hidden");
});

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