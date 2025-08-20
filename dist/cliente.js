import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, getDocs, getDoc, doc, setDoc, deleteDoc, query, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* Firebase */
const firebaseConfig = {
  apiKey: "AIzaSyD0tDQQepdvj_oZPcQuUrEKpoNOd4zF0nE",
  authDomain: "agenda-carmenmauro.firebaseapp.com",
  projectId: "agenda-carmenmauro",
  storageBucket: "agenda-carmenmauro.appspot.com",
  messagingSenderId: "959324976221",
  appId: "1:959324976221:web:780c8e9195965cea0749b4"
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db  = getFirestore(app);

/* DOM */
const h1Nome = document.getElementById("nomeCliente");
const avatar = document.getElementById("avatarIniziali");
const displayName = document.getElementById("displayName");
const displayPhone = document.getElementById("displayPhone");

const infoPhone = document.getElementById("infoPhone");
const infoEmail = document.getElementById("infoEmail");
const rowEmail  = document.getElementById("rowEmail");

const btnSms = document.getElementById("btnSms");
const btnCall = document.getElementById("btnCall");
const btnWa   = document.getElementById("btnWa");
const btnMail = document.getElementById("btnMail");

const yearSelect = document.getElementById("yearSelect");
const valAnnoEl  = document.getElementById("valAnno");
const valTotEl   = document.getElementById("valTotale");
const barAnno    = document.getElementById("barAnno");
const barTotale  = document.getElementById("barTotale");
const byTreatmentEl = document.getElementById("yearByTreatment");
const historyList = document.getElementById("historyList");

const editBtnTop = document.getElementById("editBtnTop");
const editBtn    = document.getElementById("editBtn");
const deleteBtn  = document.getElementById("deleteBtn");
const backBtn    = document.getElementById("backBtn");

const editSheet  = document.getElementById("editSheet");
const closeEdit  = document.getElementById("closeEdit");
const cancelEdit = document.getElementById("cancelEdit");
const editForm   = document.getElementById("editForm");
const editNome   = document.getElementById("editNome");
const editTel    = document.getElementById("editTelefono");
const editEmail  = document.getElementById("editEmail");

/* Helpers */
const qs = new URLSearchParams(location.search);
const id = qs.get("id");

function formatEuro(n){return Number(n||0).toLocaleString("it-IT",{style:"currency",currency:"EUR"})}
function toNumberSafe(v){
  if (v == null) return 0;
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const clean = v.replace(/[€\s]/g,"").replace(",",".");
    const n = parseFloat(clean); return isNaN(n) ? 0 : n;
  }
  return 0;
}
function toDateSafe(v){
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === "function") return v.toDate();
  if (typeof v === "number") return new Date(v);
  if (typeof v === "string") return new Date(v);
  return null;
}
function initialsFromName(n=""){
  const parts = n.trim().split(/\s+/).slice(0,2);
  return parts.map(p=>p[0]?.toUpperCase()||"").join("") || "AA";
}

/* Load */
(async function init(){
  if (!id){ history.back(); return; }

  // Cliente
  const snap = await getDoc(doc(db,"clienti",id));
  if (!snap.exists()){ history.back(); return; }
  const cliente = { id, ...snap.data() };

  // UI base
  const nome = cliente.nome || "Cliente";
  const tel  = (cliente.telefono || "").toString().trim();
  const mail = (cliente.email || "").toString().trim();

  h1Nome.textContent = nome;
  displayName.textContent = nome;
  avatar.textContent = initialsFromName(nome);
  displayPhone.textContent = tel || "—";

  // Azioni rapide
  if (tel){
    const telPlain = tel.replace(/\D+/g,"");
    infoPhone.textContent = tel;
    infoPhone.href = `tel:${telPlain}`;
    btnSms.href  = `sms:${telPlain}`;
    btnCall.href = `tel:${telPlain}`;
    btnWa.href   = `https://wa.me/${telPlain}`;
  } else {
    infoPhone.textContent = "—";
    infoPhone.removeAttribute("href");
    btnSms.href = btnCall.href = btnWa.href = "#";
  }

  if (mail){
    rowEmail.style.display = "";
    infoEmail.textContent = mail;
    infoEmail.href = `mailto:${mail}`;
    btnMail.href = `mailto:${mail}`;
  } else {
    rowEmail.style.display = "none";
    btnMail.href = "#";
  }

  // Appuntamenti del cliente
  const q = query(collection(db,"appuntamenti"), where("clienteId","==",id));
  const apptsSnap = await getDocs(q);
  const appts = apptsSnap.docs.map(d=>({id:d.id,...d.data()}));

  // Statistiche: anni disponibili + lifetime
  const yearsSet = new Set();
  let lifetime = 0;
  appts.forEach(a=>{
    const dt = toDateSafe(a.data || a.date || a.dateTime);
    if (dt) yearsSet.add(dt.getFullYear());
    const tratt = Array.isArray(a.trattamenti)? a.trattamenti : [];
    lifetime += tratt.reduce((s,t)=>s + toNumberSafe(t?.prezzo ?? t?.costo ?? t?.price),0);
  });
  valTotEl.textContent = formatEuro(lifetime);

  const years = Array.from(yearsSet).sort((a,b)=>b-a);
  const currentYear = new Date().getFullYear();
  yearSelect.innerHTML = years.length
    ? years.map(y=>`<option value="${y}">${y}</option>`).join("")
    : `<option value="${currentYear}">${currentYear}</option>`;
  if (years.includes(currentYear)) yearSelect.value = String(currentYear);

  function renderYear(y){
    // per anno
    const freq = {};
    let yearTotal = 0;

    appts.forEach(a=>{
      const dt = toDateSafe(a.data || a.date || a.dateTime);
      if (!dt || dt.getFullYear() !== y) return;
      const tratt = Array.isArray(a.trattamenti)? a.trattamenti : [];
      tratt.forEach(t=>{
        const nome = t?.nome || t?.titolo || t?.trattamento || "Trattamento";
        const prezzo = toNumberSafe(t?.prezzo ?? t?.costo ?? t?.price);
        yearTotal += prezzo;
        if (!freq[nome]) freq[nome] = {count:0, spend:0};
        freq[nome].count += 1;
        freq[nome].spend += prezzo;
      });
    });

    valAnnoEl.textContent = formatEuro(yearTotal);

    // barre proporzionali
    const maxVal = Math.max(yearTotal, lifetime, 1);
    barAnno.style.width   = `${Math.round((yearTotal/maxVal)*100)}%`;
    barTotale.style.width = `${Math.round((lifetime/maxVal)*100)}%`;

    // lista per trattamento stile "2 Microblading   Tot. € 700,00"
    const items = Object.entries(freq)
      .sort((a,b)=> b[1].count - a[1].count || b[1].spend - a[1].spend)
      .map(([nome,v])=>`
        <li><span class="qta-nome">${v.count} ${nome}</span>
            <span class="totale">Tot. ${formatEuro(v.spend)}</span></li>
      `).join("");
    byTreatmentEl.innerHTML = items || "<li>—</li>";
  }

  renderYear(Number(yearSelect.value || currentYear));
  yearSelect.onchange = () => renderYear(Number(yearSelect.value));

  // Storico appuntamenti (ultimi per primi)
  const fmt = new Intl.DateTimeFormat("it-IT",{day:"2-digit",month:"short",year:"numeric"});
  const hist = appts
    .map(a=>{
      const dt = toDateSafe(a.data || a.date || a.dateTime);
      const tratt = Array.isArray(a.trattamenti)? a.trattamenti : [];
      const names = tratt.map(t=>t?.nome || t?.titolo || t?.trattamento).filter(Boolean).join(", ");
      const total = tratt.reduce((s,t)=>s + toNumberSafe(t?.prezzo ?? t?.costo ?? t?.price),0);
      return { dt, names, total };
    })
    .filter(x=>x.dt)
    .sort((a,b)=> b.dt - a.dt);

  historyList.innerHTML = hist.map(h=>`
      <li>
        <div>
          <div class="h-date">${fmt.format(h.dt)}</div>
          <div class="h-tratt">${namesOrDash(h.names)}</div>
        </div>
        <div class="h-amt">${formatEuro(h.total)}</div>
      </li>
  `).join("");

  function namesOrDash(s){ return s && s.trim() ? s : "—"; }

  /* Edit/Delete */
  function openEdit(){
    editNome.value = nome;
    editTel.value  = tel;
    editEmail.value= mail || "";
    editSheet.classList.remove("hidden");
  }
  function closeEditSheet(){ editSheet.classList.add("hidden"); }

  editBtnTop.onclick = openEdit;
  editBtn.onclick    = openEdit;
  cancelEdit.onclick = closeEditSheet;
  closeEdit.onclick  = closeEditSheet;

  editForm.onsubmit = async (e)=>{
    e.preventDefault();
    await setDoc(doc(db,"clienti",id), {
      nome: editNome.value.trim(),
      telefono: editTel.value.trim(),
      email: editEmail.value.trim()
    }, { merge:true });
    location.reload();
  };

  deleteBtn.onclick = async ()=>{
    if (!confirm("Eliminare questo cliente?")) return;
    await deleteDoc(doc(db,"clienti",id));
    location.href = "rubrica.html";
  };

  backBtn.onclick = ()=> history.back();
})();