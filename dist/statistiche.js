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
const tabs = document.getElementById("periodTabs");
const customBox = document.getElementById("customRange");
const dateFrom = document.getElementById("dateFrom");
const dateTo   = document.getElementById("dateTo");
const applyBtn = document.getElementById("applyRange");

const elRevenue = document.getElementById("kpiRevenue");
const elCount   = document.getElementById("kpiCount");
const elAvg     = document.getElementById("kpiAvg");
const elTopTr   = document.getElementById("kpiTopTreatment");
const elTopCl   = document.getElementById("kpiTopClient");

const listTopTreatments = document.getElementById("listTopTreatments");
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
  const e = toStr ? new Date(toStr+"T00:00:00") : new Date(now.getFullYear(), now.getMonth()+1, 1);
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

  // fallback se alcuni sono salvati come stringa ISO "YYYY-MM-DD"
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

function aggregateStats(appts){
  let revenue = 0;
  let count   = 0;
  const byTreatment = {}; // nome -> {count,sum}
  const byClient    = {}; // clienteId/nome -> {sum}

  // Per andamento giornaliero: key = YYYY-MM-DD -> sum
  const byDay = {};

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

    const keyClient = (a.clienteNome || a.cliente || a.clienteId || "").toString();
    if (keyClient){
      if(!byClient[keyClient]) byClient[keyClient] = {sum:0};
      byClient[keyClient].sum += tot;
    }
  }

  const avg = count>0 ? revenue / count : 0;

  // ordini
  const topTreat = Object.entries(byTreatment)
    .sort((a,b)=> b[1].count - a[1].count || b[1].sum - a[1].sum)[0]?.[0] || "—";
  const topClient = Object.entries(byClient)
    .sort((a,b)=> b[1].sum - a[1].sum)[0]?.[0] || "—";

  return { revenue, count, avg, byTreatment, byClient, byDay, topTreat, topClient };
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

function renderBars(byDay, start, end){
  // Mostriamo il grafico solo se il range è dentro un singolo mese
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

// Interazione filtri
let currentType = "month";
async function run(type=currentType){
  currentType = type;
  const {start,end} = getRange(type, dateFrom.value, dateTo.value);

  const appts = await fetchAppointmentsInRange(start,end);
  const agg   = aggregateStats(appts);

  // KPI
  elRevenue.textContent = euro(agg.revenue);
  elCount.textContent   = String(agg.count);
  elAvg.textContent     = euro(agg.avg);
  elTopTr.textContent   = agg.topTreat;
  elTopCl.textContent   = agg.topClient;

  // Liste e grafico
  renderTopTreatments(agg.byTreatment);
  renderBars(agg.byDay, start, end);
}

// Tabs
tabs.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    tabs.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const t = btn.dataset.range;
    // mostra/nascondi range custom
    const showCustom = t === "custom";
    customBox.hidden = !showCustom;
    run(t);
  });
});

// Applica intervallo
applyBtn.addEventListener("click", ()=> run("custom"));

// Avvio
run("month");