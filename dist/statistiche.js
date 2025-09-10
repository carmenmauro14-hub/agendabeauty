// statistiche.js — Statistiche con supporto offline-first + cache sync
import { db } from "./auth.js";
import {
  collection, query, where, orderBy, getDocs,
  Timestamp, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { getAll, putMany } from "./storage.js";

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
const euro = (n) => Number(n || 0).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
const toNumberSafe = (v) =>{
  if (v == null) return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[€\s]/g, "").replace(",","."));
    return isNaN(n) ? 0 : n;
  }
  return 0;
};
const safeDate = (d) => {
  if (!d) return null;
  if (d?.toDate) return d.toDate();
  if (typeof d === "string") return new Date(d.length === 10? d+"T00:00:00": d);
  return d instanceof Date ? d : null;
};

// === Ranges
function getRange(type, fromStr, toStr) {
  const now = new Date();
  const startOfWeek = (d) => {
    const c = new Date(d);
    const day = c.getDay() || 7;
    c.setHours(0,0,0,0);
    c.setDate(c.getDate() - day + 1);
    return c;
  };
  if (type === "month") return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth()+1, 1) };
  if (type === "lastmonth") return { start: new Date(now.getFullYear(), now.getMonth()-1, 1), end: new Date(now.getFullYear(), now.getMonth(), 1) };
  if (type === "year") return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear()+1, 0, 1) };
  if (type === "lastyear") return { start: new Date(now.getFullYear()-1, 0, 1), end: new Date(now.getFullYear(), 0, 1) };
  if (type === "thisweek") { const s = startOfWeek(now), e = new Date(s); e.setDate(s.getDate()+7); return { start: s, end: e }; }
  if (type === "lastweek") { const s = startOfWeek(now); s.setDate(s.getDate() - 7); const e = new Date(s); e.setDate(s.getDate()+7); return { start: s, end: e }; }

  const s = fromStr ? new Date(fromStr + "T00:00:00") : new Date(now.getFullYear(), now.getMonth(), 1);
  const e = toStr ? (() => { const d = new Date(toStr + "T00:00:00"); d.setDate(d.getDate()+1); return d; })()
                  : new Date(now.getFullYear(), now.getMonth()+1, 1);
  return { start: s, end: e };
}

// === Offline-first fetch
async function fetchAppointmentsInRange(start, end) {
  const rangeTs = {
    start: Timestamp.fromDate(start),
    end: Timestamp.fromDate(end)
  };

  try {
    const q = query(
      collection(db, "appuntamenti"),
      where("data", ">=", rangeTs.start),
      where("data", "<", rangeTs.end)
    );
    const snap = await getDocs(q);
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    await putMany("appuntamenti", data);
    return data;
  } catch (err) {
    console.warn("[statistiche] offline, uso cache", err);
    const cached = await getAll("appuntamenti");
    return cached.filter(a => {
      const dt = safeDate(a.data || a.date || a.dataISO);
      return dt && dt >= start && dt < end;
    });
  }
}

// === Resolve names
async function resolveClientNames(ids) {
  const map = new Map();
  await Promise.all([...ids].map(async (id) => {
    try {
      const snap = await getDoc(doc(db, "clienti", id));
      if (snap.exists()) { map.set(id, snap.data()?.nome || id); }
    } catch {}
  }));
  return map;
}

// === Aggregate
function aggregateStats(appts) {
  let revenue = 0, count = 0;
  const byTreatment = {}, byDay = {}, byMonth = {}, byClientId = {}, byClientKey = {};

  for (const a of appts) {
    let tot = 0;
    if (Array.isArray(a.trattamenti)) {
      for (const t of a.trattamenti) {
        const n = (t?.nome || t?.titolo || "Trattamento").trim();
        const p = toNumberSafe(t?.prezzo ?? t?.costo ?? t?.price);
        tot += p;
        if (!byTreatment[n]) byTreatment[n] = { sum: 0, count: 0 };
        byTreatment[n].sum += p;
        byTreatment[n].count++;
      }
    } else {
      tot = toNumberSafe(a.prezzo ?? a.totale ?? a.price ?? a.costo);
    }
    revenue += tot; count++;

    const dt = safeDate(a.data);
    if (dt) {
      const dKey = dt.toISOString().slice(0,10);
      const mKey = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`;
      byDay[dKey] = (byDay[dKey] || 0) + tot;
      byMonth[mKey] = (byMonth[mKey] || 0) + tot;
    }

    const id = a.clienteId || "";
    const key = (a.clienteNome || a.cliente || "").trim();
    if (id) {
      byClientId[id] = (byClientId[id] || 0) + tot;
    } else if (key) {
      byClientKey[key] = (byClientKey[key] || 0) + tot;
    }
  }

  const avg = count > 0 ? (revenue / count) : 0;
  return { revenue, count, avg, byTreatment, byDay, byMonth, byClientId, byClientKey };
}

// === Render functions
function renderTopTreatments(byTreatment) {
  const arr = Object.entries(byTreatment)
    .sort((a, b) => b[1].sum - a[1].sum || b[1].count - a[1].count);
  listTopTreatments.innerHTML = arr.length
    ? arr.map(([n, v]) => `<li><span class="name">${n}</span><span class="meta">${v.count} • ${euro(v.sum)}</span></li>`).join("")
    : `<li><span class="name">—</span><span class="meta">Nessun dato</span></li>`;
}

async function renderTopClients(byClientId, byClientKey) {
  const rows = [
    ...Object.entries(byClientId).map(([id, sum]) => ({ key: id, sum, isId: true })),
    ...Object.entries(byClientKey).map(([k, sum]) => ({ key: k, sum, isId: false }))
  ];
  rows.sort((a, b) => b.sum - a.sum);
  const top10 = rows.slice(0, 10);

  const ids = top10.filter(r => r.isId).map(r => r.key);
  const names = ids.length ? await resolveClientNames(new Set(ids)) : new Map();

  listTopClients.innerHTML = top10.length
    ? top10.map(r => {
        const nm = r.isId ? (names.get(r.key) || r.key) : r.key;
        return `<li><span class="name">${nm}</span><span class="meta">${euro(r.sum)}</span></li>`;
      }).join("")
    : `<li><span class="name">—</span><span class="meta">Nessun dato</span></li>`;
}

// Render bar charts (week/month/year)
function renderWeekBars(byDay, start) {
  trendCard.classList.remove("hidden");
  const days = ["LUN","MAR","MER","GIO","VEN","SAB","DOM"];
  const vals = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0,10);
    return { label: days[i], sum: byDay[key] || 0 };
  });
  const max = Math.max(1, ...vals.map(v => v.sum));

  trendCard.querySelector(".card-title").textContent = "Andamento settimana";
  barsContainer.innerHTML = "";
  barsLegend.textContent = `Settimana: ${start.getDate()}–${start.getDate()+6} ${start.toLocaleString("it-IT",{month:"long",year:"numeric"})}`;

  vals.forEach(v => {
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = Math.round((v.sum / max)*100) + "%";
    bar.innerHTML = `<div class="tip">${v.label}: ${euro(v.sum)}</div><div class="day-label">${v.label}</div>`;
    barsContainer.appendChild(bar);
  });
}

function renderMonthBars(byDay, start) {
  trendCard.classList.remove("hidden");
  const daysInMonth = new Date(start.getFullYear(), start.getMonth()+1, 0).getDate();
  const vals = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i+1;
    const key = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    return { day: d, sum: byDay[key] || 0 };
  });
  const max = Math.max(1, ...vals.map(v => v.sum));

  trendCard.querySelector(".card-title").textContent = "Andamento mese";
  barsContainer.innerHTML = "";
  barsLegend.textContent = `${start.toLocaleString('it-IT',{month:'long'})} ${start.getFullYear()} • max giorno ${euro(max)}`;

  vals.forEach(v => {
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = Math.round((v.sum / max)*100) + "%";
    bar.innerHTML = `<div class="tip">${v.day}: ${euro(v.sum)}</div><div class="day-label">${v.day}</div>`;
    barsContainer.appendChild(bar);
  });
}

function renderYearBars(byMonth, year) {
  trendCard.classList.remove("hidden");
  const months = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
  const vals = months.map((m, i) => {
    const key = `${year}-${String(i+1).padStart(2,"0")}`;
    return { m: i+1, sum: byMonth[key] || 0 };
  });
  const max = Math.max(1, ...vals.map(v => v.sum));
  const maxIdx = vals.findIndex(v => v.sum === max);

  trendCard.querySelector(".card-title").textContent = "Andamento anno";
  barsContainer.innerHTML = "";
  barsLegend.textContent = `${year} • mese top ${months[maxIdx]} (${euro(max)})`;

  vals.forEach(v => {
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = Math.round((v.sum / max)*100) + "%";
    bar.innerHTML = `<div class="tip">${months[v.m-1]}: ${euro(v.sum)}</div><div class="day-label">${months[v.m-1]}</div>`;
    barsContainer.appendChild(bar);
  });
}

// === Tabs
let currentType = "month";
tabs.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    tabs.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    customBox.hidden = (btn.dataset.range !== "custom");
    run(btn.dataset.range);
  });
});
applyBtn.addEventListener("click", () => run("custom"));

// === Main runner
run("month");

async function run(type) {
  currentType = type;
  const { start, end } = getRange(type, dateFrom.value, dateTo.value);
  const appts = await fetchAppointmentsInRange(start, end);
  const agg = aggregateStats(appts);

  elRevenue.textContent = euro(agg.revenue);
  elCount.textContent = String(agg.count);
  elAvg.textContent = euro(agg.avg);

  renderTopTreatments(agg.byTreatment);
  await renderTopClients(agg.byClientId, agg.byClientKey);

  const isWeek = type === "thisweek" || type === "lastweek";
  const isFullMonth = start.getDate() === 1 && end.getDate() === 1 && (end.getMonth()-start.getMonth() === 1) && (start.getFullYear() === end.getFullYear());
  const isFullYear = start.getDate() === 1 && start.getMonth() === 0 && end.getDate() === 1 && end.getMonth() === 0 && (end.getFullYear()-start.getFullYear() === 1);

  if (type === "year" || type === "lastyear" || isFullYear) {
    renderYearBars(agg.byMonth, start.getFullYear());
  } else if (isWeek) {
    renderWeekBars(agg.byDay, start);
  } else if (type === "month" || type === "lastmonth" || isFullMonth) {
    renderMonthBars(agg.byDay, start);
  } else {
    trendCard.classList.add("hidden");
  }
}