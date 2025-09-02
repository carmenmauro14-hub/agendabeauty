import { app } from "./auth.js";
import {
  getFirestore, collection, query, where, orderBy, getDocs,
  Timestamp, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const db = getFirestore(app);

// === Riferimenti DOM
const tabs      = document.getElementById("periodTabs");
const customBox = document.getElementById("customRange");
const dateFrom  = document.getElementById("dateFrom");
const dateTo    = document.getElementById("dateTo");
const applyBtn  = document.getElementById("applyRange");

const elRevenue = document.getElementById("kpiRevenue");
const elCount   = document.getElementById("kpiCount");
const elAvg     = document.getElementById("kpiAvg");

const listTopTreatments = document.getElementById("listTopTreatments");
const listTopClients    = document.getElementById("listTopClients");
const trendCard         = document.getElementById("trendCard");
const barsContainer     = document.getElementById("barsContainer");
const barsLegend        = document.getElementById("barsLegend");

// === Utils
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

// === Ranges
function getRange(type, fromStr, toStr){
  const now = new Date();
  const startOfWeek = (d)=>{
    const day = d.getDay() || 7;
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() - day + 1);
    return d;
  };
  if(type==="month"){
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth()+1, 1)
    };
  }
  if(type==="lastmonth"){
    return {
      start: new Date(now.getFullYear(), now.getMonth()-1, 1),
      end: new Date(now.getFullYear(), now.getMonth(), 1)
    };
  }
  if(type==="year"){
    return {
      start: new Date(now.getFullYear(), 0, 1),
      end: new Date(now.getFullYear()+1, 0, 1)
    };
  }
  if(type==="lastyear"){
    return {
      start: new Date(now.getFullYear()-1, 0, 1),
      end: new Date(now.getFullYear(), 0, 1)
    };
  }
  if(type==="week"){
    const s = startOfWeek(new Date());
    const e = new Date(); e.setHours(0,0,0,0); e.setDate(e.getDate()+1); // oggi +1
    return {start: s, end: e};
  }
  if(type==="lastweek"){
    const s = startOfWeek(new Date());
    s.setDate(s.getDate() - 7);
    const e = new Date(s); e.setDate(e.getDate()+7);
    return {start: s, end: e};
  }

  const s = fromStr ? new Date(fromStr+"T00:00:00") : new Date(now.getFullYear(), now.getMonth(), 1);
  const e = toStr ? (()=>{ const d=new Date(toStr+"T00:00:00"); d.setDate(d.getDate()+1); return d; })()
                  : new Date(now.getFullYear(), now.getMonth()+1, 1);
  return {start:s, end:e};
}

// === Firebase
async function fetchAppointmentsInRange(start, end){
  const qTs = query(
    collection(db,"appuntamenti"),
    where("data", ">=", Timestamp.fromDate(start)),
    where("data", "<",  Timestamp.fromDate(end))
  );
  const snap = await getDocs(qTs);
  if (snap.size > 0) return snap.docs.map(d=>d.data());

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

// === Aggregazione
function aggregateStats(appts){
  let revenue = 0, count = 0;
  const byTreatment = {}, byClientId = {}, byClientKey = {}, byDay = {}, byMonth = {};

  for (const a of appts){
    let tot = 0;
    if(Array.isArray(a.trattamenti)){
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

    const dt = safeDate(a.data);
    if (dt){
      const dKey = dt.toISOString().slice(0,10);
      const mKey = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`;
      byDay[dKey]   = (byDay[dKey]   || 0) + tot;
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

// === Render
function renderTopTreatments(byTreatment){
  const arr = Object.entries(byTreatment)
    .sort((a,b)=> b[1].sum - a[1].sum || b[1].count - a[1].count);
  listTopTreatments.innerHTML = arr.length
    ? arr.map(([nome,v]) => `<li><span class="name">${nome}</span><span class="meta">${v.count} • ${euro(v.sum)}</span></li>`).join("")
    : `<li><span class="name">—</span><span class="meta">Nessun dato</span></li>`;
}

async function renderTopClients(byClientId, byClientKey){
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

function renderMonthBars(byDay, start){
  trendCard.classList.remove("hidden");
  const daysInMonth = new Date(start.getFullYear(), start.getMonth()+1, 0).getDate();
  const values = [];
  for (let d=1; d<=daysInMonth; d++){
    const key = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    values.push({ day:d, sum: byDay[key] || 0 });
  }
  const max = Math.max(1, ...values.map(v=>v.sum));

  trendCard.querySelector(".card-title").textContent = "Andamento mese";
  barsContainer.innerHTML = "";
  barsLegend.textContent  = `${start.toLocaleString('it-IT',{month:'long'})} ${start.getFullYear()} • max giorno ${euro(max)}`;

  values.forEach(v=>{
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = Math.round((v.sum / max) * 100) + "%";
    bar.innerHTML = `<div class="tip">${v.day}: ${euro(v.sum)}</div><div class="day-label">${v.day}</div>`;
    barsContainer.appendChild(bar);
  });
}

function renderYearBars(byMonth, year){
  trendCard.classList.remove("hidden");
  const monthNames = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
  const values = [];
  for (let m=1; m<=12; m++){
    const key = `${year}-${String(m).padStart(2,"0")}`;
    values.push({ m, sum: byMonth[key] || 0 });
  }
  const max = Math.max(1, ...values.map(v=>v.sum));
  const maxIdx = values.findIndex(v => v.sum === max);

  trendCard.querySelector(".card-title").textContent = "Andamento anno";
  barsContainer.innerHTML = "";
  barsLegend.textContent  = `${year} • mese top ${monthNames[maxIdx]} (${euro(max)})`;

  values.forEach(v=>{
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = Math.round((v.sum / max) * 100) + "%";
    bar.innerHTML = `<div class="tip">${monthNames[v.m-1]}: ${euro(v.sum)}</div><div class="day-label">${monthNames[v.m-1]}</div>`;
    barsContainer.appendChild(bar);
  });
}

function renderWeekBars(byDay, start){
  trendCard.classList.remove("hidden");
  const days = ["LUN","MAR","MER","GIO","VEN","SAB","DOM"];
  const values = [];
  for (let i=0; i<7; i++){
    const d = new Date(start); d.setDate(d.getDate()+i);
    const key = d.toISOString().slice(0,10);
    values.push({ label: days[i], sum: byDay[key] || 0 });
  }
  const max = Math.max(1, ...values.map(v=>v.sum));

  trendCard.querySelector(".card-title").textContent = "Andamento settimana";
  barsContainer.innerHTML = "";
  barsLegend.textContent  = `Settimana dal ${start.toLocaleDateString("it-IT")}`;

  values.forEach(v=>{
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = Math.round((v.sum / max) * 100) + "%";
    bar.innerHTML = `<div class="tip">${v.label}: ${euro(v.sum)}</div><div class="day-label">${v.label}</div>`;
    barsContainer.appendChild(bar);
  });
}

// === Tabs
let currentType = "month";
tabs.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    tabs.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const t = btn.dataset.range;
    customBox.hidden = (t !== "custom");
    run(t);
  });
});
applyBtn.addEventListener("click", ()=> run("custom"));

// === Core
run("month");

async function run(type = currentType) {
  currentType = type;

  const { start, end } = getRange(type, dateFrom.value, dateTo.value);
  const appts = await fetchAppointmentsInRange(start, end);
  const agg = aggregateStats(appts);

  elRevenue.textContent = euro(agg.revenue);
  elCount.textContent = String(agg.count);
  elAvg.textContent = euro(agg.avg);

  renderTopTreatments(agg.byTreatment);
  await renderTopClients(agg.byClientId, agg.byClientKey);

  const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));

  const isWeekLike =
    (type === "week" || type === "lastweek") ||
    (diff === 7 && start.getDay() % 7 === 1);

  const isFullMonth =
    start.getDate() === 1 &&
    end.getDate() === 1 &&
    end.getMonth() - start.getMonth() === 1 &&
    end.getFullYear() === start.getFullYear();

  const isFullYear =
    start.getDate() === 1 && start.getMonth() === 0 &&
    end.getDate() === 1 && end.getMonth() === 0 &&
    end.getFullYear() - start.getFullYear() === 1;

  if (type === "year" || type === "lastyear" || isFullYear) {
    renderYearBars(agg.byMonth, start.getFullYear());
  } else if (isWeekLike) {
    renderWeekBars(agg.byDay, start);
  } else if (type === "month" || type === "lastmonth" || isFullMonth) {
    renderMonthBars(agg.byDay, start);
  } else {
    trendCard.classList.add("hidden");
  }
}