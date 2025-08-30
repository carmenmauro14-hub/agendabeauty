// Statistiche – BeautyBook
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, query, where, orderBy, getDocs,
  Timestamp, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase (coerente con il resto dell'app)
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

// DOM
const tabs      = document.getElementById("periodTabs");
const customBox = document.getElementById("customRange");
const dateFrom  = document.getElementById("dateFrom");
const dateTo    = document.getElementById("dateTo");
const applyBtn  = document.getElementById("applyRange");

const elRevenue = document.getElementById("kpiRevenue");
const elCount   = document.getElementById("kpiCount");
const elAvg     = document.getElementById("kpiAvg");

const listTopTreatments = document.getElementById("listTopTreatments");
const listTopClients    = document.getElementById("listTopClients"); // ⬅️ nuova lista
const barsContainer = document.getElementById("barsContainer");
const barsLegend    = document.getElementById("barsLegend");
const trendCard     = document.getElementById("trendCard");

// Utils
const euro = (n)=> Number(n||0).toLocaleString("it-IT",{style:"currency",currency:"EUR"});
const toNumberSafe = (v)=>{
  if(v==null) return 0;
  if(typeof v==="number") return isFinite(v)?v:0;
  if(typeof v==="string"){
    const n = parseFloat(v.replace(/[€\s]/g,"").replace(",","."));
    return isNaN(n)?0:n;
  }
  return 0;
};
const safeDate = (d)=>{
  if(!d) return null;
  if(d?.toDate) return d.toDate();
  if(typeof d==="number") return new Date(d);
  if(typeof d==="string") return new Date(d.length===10 ? d+"T00:00:00" : d);
  return d instanceof Date ? d : null;
};

// Calcolo range
function getRange(type, fromStr, toStr){
  const now = new Date();
  if(type==="month"){
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end   = new Date(now.getFullYear(), now.getMonth()+1, 1);
    return {start,end,label:`${start.toLocaleString('it-IT',{month:'long'})} ${start.getFullYear()}`};
  }
  if(type==="lastmonth"){
    const start = new Date(now.getFullYear(), now.getMonth()-1, 1);
    const end   = new Date(now.getFullYear(), now.getMonth(), 1);
    return {start,end,label:`${start.toLocaleString('it-IT',{month:'long'})} ${start.getFullYear()}`};
  }
  if(type==="year"){
    const start = new Date(now.getFullYear(), 0, 1);
    const end   = new Date(now.getFullYear()+1, 0, 1);
    return {start,end,label:`${start.getFullYear()}`};
  }
  // custom
  const s = fromStr ? new Date(fromStr+"T00:00:00") : new Date(now.getFullYear(), now.getMonth(), 1);
  const e = toStr ? new Date(toStr+"T00:00:00")     : new Date(now.getFullYear(), now.getMonth()+1, 1);
  return {start:s, end:e, label:`${fromStr||""} → ${toStr||""}`};
}

// Query appuntamenti nel range (campo "data" Timestamp o ISO)
async function fetchAppointmentsInRange(start, end){
  // caso Timestamp
  const qTs = query(
    collection(db,"appuntamenti"),
    where("data", ">=", Timestamp.fromDate(start)),
    where("data", "<",  Timestamp.fromDate(end))
  );
  const snap = await getDocs(qTs);
  if (snap.size > 0) return snap.docs.map(d=>d.data());

  // fallback ISO (YYYY-MM-DD)
  const isoFrom = start.toISOString().slice(0,10);
  const isoTo   = end.toISOString().slice(0,10);

  const qIso = query(
    collection(db,"appuntamenti"),
    where("data", ">=", isoFrom),
    where("data", "<",  isoTo),
    orderBy("data","asc")
  );
  const snapIso = await getDocs(qIso);
  return snapIso.docs.map(d=>d.data());
}

// Mappa ID cliente -> nome (per la Top 10)
async function resolveClientNames(ids){
  const map = new Map();
  await Promise.all([...ids].map(async (id)=>{
    try{
      const cs = await getDoc(doc(db,"clienti",id));
      if (cs.exists()){
        const nome = cs.data()?.nome || "";
        if (nome) map.set(id, nome);
      }
    }catch{}
  }));
  return map;
}

function aggregateStats(appts){
  let revenue = 0;
  let count   = 0;

  const byTreatment = {}; // nome -> {count,sum}
  const byClientId  = {}; // id -> {sum}
  const byClientKey = {}; // nomeTesto/altro -> {sum} (fallback)
  const byDay = {};       // YYYY-MM-DD -> sum

  for (const a of appts){
    // totale appuntamento
    let tot = 0;
    if(Array.isArray(a.trattamenti) && a.trattamenti.length){
      for (const t of a.trattamenti){
        const n = (t?.nome || t?.titolo || "Trattamento").trim();
        const p = toNumberSafe(t?.prezzo ?? t?.costo ?? t?.price);
        tot += p;
        if(!byTreatment[n]) byTreatment[n] = {count:0,sum:0};
        byTreatment[n].count += 1;
        byTreatment[n].sum   += p;
      }
    } else {
      tot = toNumberSafe(a.prezzo ?? a.totale ?? a.price ?? a.costo);
    }

    revenue += tot;
    count   += 1;

    const dt = safeDate(a.data || a.date || a.dateTime);
    if (dt){
      const key = dt.toISOString().slice(0,10);
      byDay[key] = (byDay[key] || 0) + tot;
    }

    const id  = (a.clienteId || "").toString().trim();
    const key = (a.clienteNome || a.cliente || "").toString().trim();

    if (id){
      if(!byClientId[id]) byClientId[id] = {sum:0};
      byClientId[id].sum += tot;
    } else if (key){
      if(!byClientKey[key]) byClientKey[key] = {sum:0};
      byClientKey[key].sum += tot;
    }
  }

  const avg = count>0 ? revenue / count : 0;

  // Top trattamento (per KPI)
  const topTreat = Object.entries(byTreatment)
    .sort((a,b)=> b[1].count - a[1].count || b[1].sum - a[1].sum)[0]?.[0] || "—";

  return { revenue, count, avg, byTreatment, byDay, topTreat, byClientId, byClientKey };
}

function renderTopTreatments(byTreatment){
  const arr = Object.entries(byTreatment)
    .sort((a,b)=> b[1].sum - a[1].sum || b[1].count - a[1].count)
    .slice(0,10);

  listTopTreatments.innerHTML = arr.length
    ? arr.map(([nome,v]) =>
        `<li><span class="name">${nome}</span><span class="meta">${v.count} • ${euro(v.sum)}</span></li>`
      ).join("")
    : `<li><span class="name">—</span><span class="meta">Nessun dato</span></li>`;
}

// ⬇️ Nuova: Top 10 clienti (ID risolti a nome; fallback chiave testuale)
async function renderTopClients(byClientId, byClientKey){
  if (!listTopClients) return; // nel caso la sezione non sia in pagina

  const rows = [];

  for (const [id,v] of Object.entries(byClientId)){
    rows.push({ key:id, sum:v.sum, isId:true });
  }
  for (const [k,v] of Object.entries(byClientKey)){
    rows.push({ key:k, sum:v.sum, isId:false });
  }

  rows.sort((a,b)=> b.sum - a.sum);
  const top10 = rows.slice(0,10);

  // risolvi nomi per gli ID presenti nei top10
  const idSet = new Set(top10.filter(r=>r.isId).map(r=>r.key));
  const names = idSet.size ? await resolveClientNames(idSet) : new Map();

  listTopClients.innerHTML = top10.length
    ? top10.map(r=>{
        const nome = r.isId ? (names.get(r.key) || r.key) : r.key;
        return `<li><span class="name">${nome}</span><span class="meta">${euro(r.sum)}</span></li>`;
      }).join("")
    : `<li><span class="name">—</span><span class="meta">Nessun dato</span></li>`;
}

function renderBars(byDay, start, end){
  // Mostra il grafico solo se il range è dentro un singolo mese naturale
  const sameMonth = start.getFullYear()===end.getFullYear() && start.getMonth()===end.getMonth()-1;
  trendCard.classList.toggle("hidden", !sameMonth);

  barsContainer.innerHTML = "";
  barsLegend.textContent  = "";

  if (!sameMonth) return;

  const daysInMonth = new Date(start.getFullYear(), start.getMonth()+1, 0).getDate();
  const values = [];
  for (let d=1; d<=daysInMonth; d++){
    const key = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    values.push({ day:d, sum: byDay[key] || 0 });
  }
  const max = Math.max(1, ...values.map(v=>v.sum));

  values.forEach(v=>{
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = Math.round((v.sum / max) * 100) + "%";
    bar.innerHTML = `<div class="tip">${v.day}: ${euro(v.sum)}</div>`;
    barsContainer.appendChild(bar);
  });

  barsLegend.textContent =
    `${start.toLocaleString('it-IT',{month:'long'})} ${start.getFullYear()} • max giorno ${euro(max)}`;
}

// Tabs
let currentType = "month";
tabs.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    tabs.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const t = btn.dataset.range;

    const showCustom = t === "custom";
    customBox.hidden = !showCustom;

    // Precompila date nel caso "Intervallo"
    if (showCustom) {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      const pad = n => String(n).padStart(2, "0");
      const from = `${y}-${pad(m+1)}-01`;
      const to   = `${y}-${pad(m+1)}-${pad(new Date(y, m+1, 0).getDate())}`;
      if (!dateFrom.value) dateFrom.value = from;
      if (!dateTo.value)   dateTo.value   = to;
    }

    run(t);
  });
});

// Applica intervallo
applyBtn.addEventListener("click", ()=> run("custom"));

// Avvio
run("month");

// ---------------- Core run ----------------
async function run(type=currentType){
  currentType = type;
  const {start,end} = getRange(type, dateFrom.value, dateTo.value);

  const appts = await fetchAppointmentsInRange(start,end);
  const agg   = aggregateStats(appts);

  // KPI
  elRevenue.textContent = euro(agg.revenue);
  elCount.textContent   = String(agg.count);
  elAvg.textContent     = euro(agg.avg);

  // Liste e grafico
  renderTopTreatments(agg.byTreatment);
  await renderTopClients(agg.byClientId, agg.byClientKey);
  renderBars(agg.byDay, start, end);
}