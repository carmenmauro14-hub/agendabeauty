// statistiche.js
import {
  getFirestore, collection, query, where, getDocs, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const db = getFirestore();

// ───────────── Utilità ─────────────
const € = (n) => (n ?? 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const startOfDay = (d)=>{const x=new Date(d); x.setHours(0,0,0,0); return x;};
const endOfDay   = (d)=>{const x=new Date(d); x.setHours(23,59,59,999); return x;};
const dayKey   = (d)=> new Date(d).toISOString().slice(0,10);             // yyyy-mm-dd
const monthKey = (d)=> `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;

function trovaIconaLocale(nome=""){ // se vuoi usarla per mostrare anche l'icona
  const base = String(nome).toLowerCase();
  const m = [
    {k:"microblading", p:"icones_trattamenti/microblading.png"},
    {k:"makeup sposa", p:"icones_trattamenti/makeup_sposa.png"},
    {k:"makeup",       p:"icones_trattamenti/makeup.png"},
    {k:"extension",    p:"icones_trattamenti/extension_ciglia.png"},
    {k:"architettura", p:"icones_trattamenti/arch_sopracciglia.png"},
    {k:"filo",         p:"icones_trattamenti/filo_arabo.png"},
    {k:"airbrush",     p:"icones_trattamenti/airbrush.png"},
  ];
  return (m.find(x=>base.includes(x.k))?.p) || "icone_uniformate_colore/setting.png";
}

// ───────────── Riferimenti DOM ─────────────
const els = {
  tabs: document.getElementById('periodTabs'),
  customWrap: document.getElementById('customRange'),
  dateFrom: document.getElementById('dateFrom'),
  dateTo: document.getElementById('dateTo'),
  applyRange: document.getElementById('applyRange'),

  kpiRevenue: document.getElementById('kpiRevenue'),
  kpiCount: document.getElementById('kpiCount'),
  kpiAvg: document.getElementById('kpiAvg'),
  kpiTopTreatment: document.getElementById('kpiTopTreatment'),
  kpiTopClient: document.getElementById('kpiTopClient'),

  listTopTreatments: document.getElementById('listTopTreatments'),
  bars: document.getElementById('barsContainer'),
  legend: document.getElementById('barsLegend'),
  trendCard: document.getElementById('trendCard'),
};

// ───────────── Range helper ─────────────
function rangeMeseCorrente(){
  const now=new Date();
  return {
    start: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
    end:   endOfDay(new Date(now.getFullYear(), now.getMonth()+1, 0))
  };
}
function rangeMeseScorso(){
  const now=new Date();
  return {
    start: startOfDay(new Date(now.getFullYear(), now.getMonth()-1, 1)),
    end:   endOfDay(new Date(now.getFullYear(), now.getMonth(), 0))
  };
}
function rangeAnnoCorrente(){
  const now=new Date();
  return {
    start: startOfDay(new Date(now.getFullYear(), 0, 1)),
    end:   endOfDay(new Date(now.getFullYear(),11,31))
  };
}
function rangeCustom(){
  if(!els.dateFrom.value || !els.dateTo.value) return null;
  return {
    start: startOfDay(new Date(els.dateFrom.value)),
    end:   endOfDay(new Date(els.dateTo.value))
  };
}

// ───────────── Fetch & aggregazione ─────────────
async function fetchAppuntamenti(start, end){
  const col = collection(db,'appuntamenti');
  const qy = query(col, where('data','>=',start), where('data','<=',end));
  const snap = await getDocs(qy);
  const out = [];
  snap.forEach(d=>{
    const v = d.data();
    const when = v.data?.toDate ? v.data.toDate() : (v.data instanceof Date ? v.data : null);
    if(!when) return;
    out.push({
      id: d.id,
      data: when,
      clienteId: v.clienteId || v.cliente || null,
      totale: typeof v.totale==='number' ? v.totale : null,
      trattamenti: Array.isArray(v.trattamenti)? v.trattamenti : [],
    });
  });
  return out;
}

function totaleApp(a){
  if(typeof a.totale==='number') return a.totale;
  return a.trattamenti.reduce((s,t)=> s + (Number(t.prezzo)||0), 0);
}

function aggrega(apps){
  let fatturato=0;
  const perGiorno=new Map(), perMese=new Map();
  const perTratt=new Map(); // nome -> {count, totale, icona?}
  const perCliente=new Map(); // id -> totale

  for(const a of apps){
    const tot = totaleApp(a);
    fatturato += tot;

    const dk = dayKey(a.data);
    perGiorno.set(dk, (perGiorno.get(dk)||0) + tot);

    const mk = monthKey(a.data);
    perMese.set(mk, (perMese.get(mk)||0) + tot);

    // trattamenti
    for(const t of a.trattamenti){
      const nome = t?.nome || 'Trattamento';
      const cur = perTratt.get(nome) || {count:0, totale:0, icona:null};
      cur.count += 1;
      cur.totale += Number(t?.prezzo)||0;
      cur.icona = cur.icona || t?.icona || trovaIconaLocale(nome);
      perTratt.set(nome, cur);
    }

    // cliente
    if(a.clienteId){
      perCliente.set(a.clienteId, (perCliente.get(a.clienteId)||0) + tot);
    }
  }

  const count = apps.length;
  const avg = count ? (fatturato / count) : 0;

  // top trattamento
  let topTratt=null;
  for(const [nome,v] of perTratt.entries()){
    if(!topTratt || v.totale > topTratt.totale) topTratt = {nome, ...v};
  }

  // top cliente
  let topCliente=null;
  for(const [cid,tot] of perCliente.entries()){
    if(!topCliente || tot > topCliente.totale) topCliente = {clienteId: cid, totale: tot};
  }

  const topList = [...perTratt.entries()]
    .map(([nome,v]) => ({nome, ...v}))
    .sort((a,b)=> b.totale - a.totale);

  return { fatturato, count, avg, perGiorno, perMese, topTratt, topCliente, topList };
}

// ───────────── Rendering ─────────────
async function nomeCliente(clienteId){
  if(!clienteId) return '—';
  try{
    const d = await getDoc(doc(db,'clienti',clienteId));
    if(!d.exists()) return clienteId;
    const c = d.data();
    const nome = c.nome || c.firstName || '';
    const cognome = c.cognome || c.lastName || '';
    const disp = `${nome} ${cognome}`.trim();
    return disp || (c.displayName || clienteId);
  }catch{
    return clienteId;
  }
}

function renderKPI({fatturato, count, avg, topTratt, topClienteName}){
  els.kpiRevenue.textContent = €(fatturato);
  els.kpiCount.textContent   = String(count);
  els.kpiAvg.textContent     = €(avg);
  els.kpiTopTreatment.textContent = topTratt ? topTratt.nome : '—';
  els.kpiTopClient.textContent    = topClienteName || '—';
}

function renderTopTreatments(list){
  els.listTopTreatments.innerHTML = '';
  list.forEach(item=>{
    const li = document.createElement('li');
    li.className = 'list-item';
    li.innerHTML = `
      <span class="li-name">${item.nome}</span>
      <span class="li-vals"><strong>${item.count}</strong> <span class="dot">•</span> ${€(item.totale)}</span>
    `;
    els.listTopTreatments.appendChild(li);
  });
}

function renderBars(rangeStart, rangeEnd, perGiorno, perMese){
  els.bars.innerHTML = '';
  els.legend.innerHTML = '';

  // scegli granularità: daily se <= 35 giorni, altrimenti monthly
  const days = Math.round((endOfDay(rangeEnd)-startOfDay(rangeStart))/(1000*60*60*24))+1;
  const daily = days <= 35;

  let labels=[], data=[];
  if(daily){
    const cur=new Date(rangeStart);
    while(cur<=rangeEnd){
      const k=dayKey(cur);
      labels.push(k.slice(8,10)); // gg
      data.push(perGiorno.get(k)||0);
      cur.setDate(cur.getDate()+1);
    }
    els.trendCard.querySelector('.card-title').textContent = 'Andamento giorno per giorno';
  }else{
    let cur=new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
    const stop=new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);
    while(cur<=stop){
      const k=monthKey(cur);
      const lbl = cur.toLocaleString('it-IT',{month:'short'}).replace('.','');
      labels.push(lbl.charAt(0).toUpperCase()+lbl.slice(1));
      data.push(perMese.get(k)||0);
      cur.setMonth(cur.getMonth()+1);
    }
    els.trendCard.querySelector('.card-title').textContent = 'Andamento mese per mese';
  }

  const max = Math.max(...data, 0);
  const safeMax = max || 1;

  data.forEach((val,i)=>{
    const h = Math.round((val / safeMax) * 100); // % altezza
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = h + '%';
    bar.title = `${labels[i]}: ${€(val)}`;
    els.bars.appendChild(bar);

    const l = document.createElement('span');
    l.className = 'legend-item';
    l.textContent = labels[i];
    els.legend.appendChild(l);
  });
}

// ───────────── Controller principale ─────────────
async function aggiorna(range){
  const apps = await fetchAppuntamenti(range.start, range.end);
  const agg  = aggrega(apps);

  const topClienteName = agg.topCliente?.clienteId
    ? await nomeCliente(agg.topCliente.clienteId)
    : '—';

  renderKPI({
    fatturato: agg.fatturato,
    count: agg.count,
    avg: agg.avg,
    topTratt: agg.topTratt,
    topClienteName
  });

  renderTopTreatments(agg.topList);
  renderBars(range.start, range.end, agg.perGiorno, agg.perMese);
}

// ───────────── Wiring UI ─────────────
function setActiveTab(btn){
  els.tabs.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}

function handleTabClick(e){
  const btn = e.target.closest('button.tab');
  if(!btn) return;
  const rangeType = btn.dataset.range;
  setActiveTab(btn);
  if(rangeType==='custom'){
    els.customWrap.hidden = false;
    const r = rangeCustom();
    if(r) aggiorna(r);
  }else{
    els.customWrap.hidden = true;
    if(rangeType==='month')      aggiorna(rangeMeseCorrente());
    if(rangeType==='lastmonth')  aggiorna(rangeMeseScorso());
    if(rangeType==='year')       aggiorna(rangeAnnoCorrente());
  }
}

function handleApply(){
  const r = rangeCustom();
  if(r) aggiorna(r);
}

// ───────────── Init ─────────────
document.addEventListener('DOMContentLoaded', ()=>{
  els.tabs.addEventListener('click', handleTabClick);
  els.applyRange.addEventListener('click', handleApply);

  // default: Mese corrente
  setActiveTab(els.tabs.querySelector('[data-range="month"]'));
  aggiorna(rangeMeseCorrente());
});