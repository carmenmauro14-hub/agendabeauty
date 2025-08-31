// Statistiche – BeautyBook
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, query, where, orderBy, getDocs,
  Timestamp, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase
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
const tabs        = document.getElementById("periodTabs");
const customBox   = document.getElementById("customRange");
const dateFrom    = document.getElementById("dateFrom");
const dateTo      = document.getElementById("dateTo");
const applyBtn    = document.getElementById("applyRange");

const yearControls= document.getElementById("yearControls");
const yearLabel   = document.getElementById("yearLabel");
const prevYearBtn = document.getElementById("prevYear");
const nextYearBtn = document.getElementById("nextYear");

const elRevenue = document.getElementById("kpiRevenue");
const elCount   = document.getElementById("kpiCount");
const elAvg     = document.getElementById("kpiAvg");

const listTopTreatments = document.getElementById("listTopTreatments");
const listTopClients    = document.getElementById("listTopClients");
const trendCard         = document.getElementById("trendCard");
const barsContainer     = document.getElementById("barsContainer");
const barsLegend        = document.getElementById("barsLegend");

// Stato
let currentType  = "month";
let selectedYear = new Date().getFullYear(); // ← anno navigabile

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

// Range
function getRange(type, fromStr, toStr){
  const now = new Date();
  if(type==="month"){
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end   = new Date(now.getFullYear(), now.getMonth()+1, 1);
    return {start,end};
  }
  if(type==="lastmonth"){
    const start = new Date(now.getFullYear(), now.getMonth()-1, 1);
    const end   = new Date(now.getFullYear(), now.getMonth(), 1);
    return {start,end};
  }
  if(type==="year"){
    const y = selectedYear; // ← usa l'anno scelto
    const start = new Date(y, 0, 1);
    const end   = new Date(y+1, 0, 1);
    return {start,end};
  }
  // custom
  const s = fromStr ? new Date(fromStr+"T00:00:00") : new Date(now.getFullYear(), now.getMonth(), 1);
  const e = toStr ? new Date(toStr+"T00:00:00")     : new Date(now.getFullYear(), now.getMonth()+1, 1);
  return {start:s, end:e};
}

// Query appuntamenti
async function fetchAppointmentsInRange(start, end){
  const qTs = query(
    collection(db,"appuntamenti"),
    where("data", ">=", Timestamp.fromDate(start)),
    where("data", "<",  Timestamp.fromDate(end))
  );
  const snap = await getDocs(qTs);
  if (snap.size > 0) return snap.docs.map(d=>d.data());

  // fallback ISO
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

// Risolvi nomi clienti da ID
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
  let revenue = 0, count = 0;
  const byTreatment = {}; // nome -> {count,sum}
  const byClientId  = {}; // id -> {sum}
  const byClientKey = {}; // nome -> {sum}
  const byDay       = {}; // YYYY-MM-DD -> sum
  const byMonth     = {}; // YYYY-MM -> sum

  for (const a of appts){
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

    revenue += tot; count += 1;

    const dt = safeDate(a.data || a.date || a.dateTime);
    if (dt){
      const dKey = dt.toISOString().slice(0,10);
      const mKey = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`;
      byDay[dKey] = (byDay[dKey] || 0) + tot;
      byMonth[mKey] = (byMonth[mKey] || 0) + tot;
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
  return { revenue, count, avg, byTreatment, byDay, byMonth, byClientId, byClientKey };
}

// Top trattamenti: TUTTI (ordinati per fatturato)
function renderTopTreatments(byTreatment){
  const arr = Object.entries(byTreatment)
    .sort((a,b)=> b[1].sum - a[1].sum || b[1].count - a[1].count);

  listTopTreatments.innerHTML = arr.length
    ? arr.map(([nome,v]) =>
        `<li><span class="name">${nome}</span><span class="meta">${v.count} • ${euro(v.sum)}</span></li>`
      ).join("")
    : `<li><span class="name">—</span><span class="meta">Nessun dato</span></li>`;
}

// Top clienti: TOP 10
async function renderTopClients(byClientId, byClientKey){
  if (!listTopClients) return;

  const rows = [];
  for (const [id,v] of Object.entries(byClientId)) rows.push({ key:id, sum:v.sum, isId:true });
  for (const [k,v] of Object.entries(byClientKey)) rows.push({ key:k, sum:v.sum, isId:false });

  rows.sort((a,b)=> b.sum - a.sum);
  const top10 = rows.slice(0,10);

  const idSet = new Set(top10.filter(r=>r.isId).map(r=>r.key));
  const names = idSet.size ? await resolveClientNames(idSet) : new Map();

  listTopClients.innerHTML = top10.length
    ? top10.map(r=>{
        const nome = r.isId ? (names.get(r.key) || r.key) : r.key;
        return `<li><span class="name">${nome}</span><span class="meta">${euro(r.sum)}</span></li>`;
      }).join("")
    : `<li><span class="name">—</span><span class="meta">Nessun dato</span></li>`;
}

// Grafico giornaliero (per mese)
function renderMonthBars(byDay, start, end){
  const lastMoment = new Date(end.getTime() - 1);
  const sameMonth =
    start.getFullYear() === lastMoment.getFullYear() &&
    start.getMonth()    === lastMoment.getMonth() &&
    start.getDate()     === 1;

  trendCard.classList.toggle("hidden", !sameMonth);
  if (!sameMonth) return;

  trendCard.querySelector(".card-title").textContent = "Andamento mese";
  barsContainer.innerHTML = "";
  barsLegend.textContent  = "";

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
    bar.innerHTML = `
      <div class="tip">${v.day}: ${euro(v.sum)}</div>
      <div class="day-label">${v.day}</div>
    `;
    barsContainer.appendChild(bar);
  });

  barsLegend.textContent =
    `${start.toLocaleString('it-IT',{month:'long'})} ${start.getFullYear()} • max giorno ${euro(max)}`;
}

// Grafico annuale (12 mesi)
function renderYearBars(byMonth, year){
  trendCard.classList.remove("hidden");
  trendCard.querySelector(".card-title").textContent = "Andamento anno";
  barsContainer.innerHTML = "";
  barsLegend.textContent  = "";

  const monthNames = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
  const values = [];
  for (let m=1; m<=12; m++){
    const key = `${year}-${String(m).padStart(2,"0")}`;
    values.push({ m, sum: byMonth[key] || 0 });
  }
  const max = Math.max(1, ...values.map(v=>v.sum));

  values.forEach(v=>{
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = Math.round((v.sum / max) * 100) + "%";
    bar.innerHTML = `
      <div class="tip">${monthNames[v.m-1]}: ${euro(v.sum)}</div>
      <div class="day-label">${monthNames[v.m-1]}</div>
    `;
    barsContainer.appendChild(bar);
  });

  const maxMonthIdx = values.reduce((best,i,idx,arr)=> i.sum>arr[best].sum ? idx : best ,0);
  barsLegend.textContent =
    `${year} • mese top ${monthNames[maxMonthIdx]} (${euro(values[maxMonthIdx].sum)})`;
}

// Tabs
tabs.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    tabs.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const t = btn.dataset.range;

    const isYear   = t === "year";
    const isCustom = t === "custom";
    yearControls.hidden = !isYear;
    customBox.hidden    = !isCustom;

    if (isCustom) {
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

// Navigazione anno
function refreshYearLabel(){ yearLabel.textContent = String(selectedYear); }
prevYearBtn?.addEventListener("click", ()=>{ selectedYear--; refreshYearLabel(); run("year"); });
nextYearBtn?.addEventListener("click", ()=>{ selectedYear++; refreshYearLabel(); run("year"); });

// Applica intervallo custom
applyBtn.addEventListener("click", ()=> run("custom"));

// Avvio
refreshYearLabel();
run("month");

// Core
async function run(type=currentType){
  currentType = type;
  const {start,end} = getRange(type, dateFrom.value, dateTo.value);

  const appts = await fetchAppointmentsInRange(start,end);
  const agg   = aggregateStats(appts);

  elRevenue.textContent = euro(agg.revenue);
  elCount.textContent   = String(agg.count);
  elAvg.textContent     = euro(agg.avg);

  renderTopTreatments(agg.byTreatment);
  await renderTopClients(agg.byClientId, agg.byClientKey);

  // grafici
  if (type === "year"){
    renderYearBars(agg.byMonth, start.getFullYear());
  } else {
    renderMonthBars(agg.byDay, start, end); // mostra mese solo se l'intervallo è un mese pieno
  }
}