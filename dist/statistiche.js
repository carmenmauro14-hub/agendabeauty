// statistiche.js
// Dipendenze: Firebase v10+ già inizializzato altrove (initializeApp), qui usiamo Firestore
import { getFirestore, collection, query, where, getDocs, doc, getDoc } 
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const db = getFirestore();

// ─────────────────────────────────────────────────────────────────────────────
// Utilità
// ─────────────────────────────────────────────────────────────────────────────
const € = (n) => (n ?? 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d){ const x=new Date(d); x.setHours(23,59,59,999); return x; }

function monthKey(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function dayKey(d){ return d.toISOString().slice(0,10); }

function ensureChartJs() {
  return new Promise((res) => {
    if (window.Chart) return res();
    const s = document.createElement('script');
    s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js";
    s.onload = () => res();
    document.head.appendChild(s);
  });
}

// Fallback semplice se nel trattamento non troviamo l’icona salvata
function trovaIconaLocale(nome="") {
  const base = nome.toLowerCase();
  const mappa = [
    { k: "microblading", p: "icones_trattamenti/microblading.png" },
    { k: "makeup", p: "icones_trattamenti/makeup.png" },
    { k: "sposa", p: "icones_trattamenti/makeup_sposa.png" },
    { k: "extension", p: "icones_trattamenti/extension_ciglia.png" },
    { k: "architettura", p: "icones_trattamenti/arch_sopracciglia.png" },
    { k: "filo", p: "icones_trattamenti/filo_arabo.png" },
    { k: "airbrush", p: "icones_trattamenti/airbrush.png" },
  ];
  return (mappa.find(m => base.includes(m.k))?.p) || "icone_uniformate_colore/setting.png";
}

// ─────────────────────────────────────────────────────────────────────────────
// Lettura UI (bottoni periodo)
// ─────────────────────────────────────────────────────────────────────────────
const el = {
  fatturato: document.querySelector('#fatturatoTotale'),
  appuntamenti: document.querySelector('#numeroAppuntamenti'),
  scontrino: document.querySelector('#scontrinoMedio'),
  trattTopNome: document.querySelector('#trattamentoTopNome'),
  trattTopIcona: document.querySelector('#trattamentoTopIcona'),
  clienteTop: document.querySelector('#clienteTopNome'),
  listaTop: document.querySelector('#listaTopTrattamenti'),
  canvas: document.querySelector('#chartAndamento'),

  btnMeseCorrente: document.querySelector('#btnMeseCorrente'),
  btnMeseScorso: document.querySelector('#btnMeseScorso'),
  btnAnnoCorrente: document.querySelector('#btnAnnoCorrente'),
  dataInizio: document.querySelector('#dataInizio'),
  dataFine: document.querySelector('#dataFine'),
  btnApplicaIntervallo: document.querySelector('#btnApplicaIntervallo'),
};

function getRangeMeseCorrente(){
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth()+1, 0);
  return { start: startOfDay(start), end: endOfDay(end) };
}
function getRangeMeseScorso(){
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return { start: startOfDay(start), end: endOfDay(end) };
}
function getRangeAnnoCorrente(){
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear(), 11, 31);
  return { start: startOfDay(start), end: endOfDay(end) };
}
function getRangePersonalizzato(){
  if (!el.dataInizio?.value || !el.dataFine?.value) return null;
  const start = startOfDay(new Date(el.dataInizio.value));
  const end = endOfDay(new Date(el.dataFine.value));
  if (isNaN(start) || isNaN(end)) return null;
  return { start, end };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch appuntamenti dal range
// Struttura attesa documento appuntamento:
// - data (Firestore Timestamp)  ❗️obbligatorio
// - clienteId (string)
// - totale (number)            ➜ se non presente, somma prezzi trattamenti
// - trattamenti: [{ nome, prezzo, icona? }, ...]
// ─────────────────────────────────────────────────────────────────────────────
async function getAppuntamentiNelRange(startDate, endDate){
  const col = collection(db, 'appuntamenti');
  const qy = query(
    col,
    where('data', '>=', startDate),
    where('data', '<=', endDate)
  );
  const snap = await getDocs(qy);
  const list = [];
  snap.forEach(docu => {
    const d = docu.data();
    // Normalizza
    const when = d.data?.toDate ? d.data.toDate() : (d.data instanceof Date ? d.data : null);
    if (!when) return; // salta se manca
    list.push({
      id: docu.id,
      data: when,
      clienteId: d.clienteId || d.cliente || null,
      totale: typeof d.totale === 'number' ? d.totale : null,
      trattamenti: Array.isArray(d.trattamenti) ? d.trattamenti : [],
    });
  });
  return list;
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregazioni
// ─────────────────────────────────────────────────────────────────────────────
function calcolaTotaleAppuntamento(app){
  if (typeof app.totale === 'number') return app.totale;
  const somma = app.trattamenti.reduce((s,t) => s + (Number(t.prezzo)||0), 0);
  return somma;
}

function aggregaStatistiche(appuntamenti){
  let fatturato = 0;
  const perGiorno = new Map();  // key: yyyy-mm-dd -> totale
  const perMese = new Map();    // key: yyyy-mm -> totale
  const perTratt = new Map();   // key: nome -> { count, totale, icona? }
  const perCliente = new Map(); // key: clienteId -> totale

  for (const a of appuntamenti){
    const tot = calcolaTotaleAppuntamento(a);
    fatturato += tot;

    // giorno / mese
    const dk = dayKey(a.data);
    perGiorno.set(dk, (perGiorno.get(dk)||0) + tot);

    const mk = monthKey(a.data);
    perMese.set(mk, (perMese.get(mk)||0) + tot);

    // per trattamento
    for (const t of a.trattamenti){
      const nome = t?.nome || 'Trattamento';
      const cur = perTratt.get(nome) || { count:0, totale:0, icona: null };
      cur.count += 1;
      cur.totale += Number(t?.prezzo)||0;
      // preferisci icona salvata nel DB, altrimenti fallback
      cur.icona = cur.icona || t?.icona || trovaIconaLocale(nome);
      perTratt.set(nome, cur);
    }

    // per cliente
    if (a.clienteId){
      perCliente.set(a.clienteId, (perCliente.get(a.clienteId)||0) + tot);
    }
  }

  const appuntamentiCount = appuntamenti.length;
  const scontrinoMedio = appuntamentiCount ? (fatturato / appuntamentiCount) : 0;

  // top trattamento
  let topTratt = null;
  for (const [nome, v] of perTratt.entries()){
    if (!topTratt || v.totale > topTratt.totale) topTratt = { nome, ...v };
  }

  // top cliente
  let topCliente = null;
  for (const [cid, tot] of perCliente.entries()){
    if (!topCliente || tot > topCliente.totale) topCliente = { clienteId: cid, totale: tot };
  }

  // ordina top trattamenti per totale desc
  const listaTopTratt = [...perTratt.entries()]
    .map(([nome,v]) => ({ nome, ...v }))
    .sort((a,b) => b.totale - a.totale);

  return {
    fatturato,
    appuntamentiCount,
    scontrinoMedio,
    topTratt,
    topCliente,
    perGiorno,
    perMese,
    listaTopTratt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// UI Rendering
// ─────────────────────────────────────────────────────────────────────────────
async function nomeClienteDaId(clienteId){
  if (!clienteId) return null;
  try {
    const d = await getDoc(doc(db, 'clienti', clienteId));
    if (!d.exists()) return clienteId; // fallback: mostra id se non trovi
    const c = d.data();
    const nome = c.nome || c.firstName || '';
    const cognome = c.cognome || c.lastName || '';
    const display = `${nome} ${cognome}`.trim();
    return display || (c.displayName || clienteId);
  } catch {
    return clienteId;
  }
}

function renderTopTrattamenti(lista){
  if (!el.listaTop) return;
  el.listaTop.innerHTML = ''; // pulisci
  for (const item of lista){
    const li = document.createElement('div');
    li.className = 'riga-trattamento'; // usa le tue classi esistenti se serve
    li.innerHTML = `
      <div class="riga-trattamento__sx">
        <img class="tratt-icona" alt="" src="${item.icona || trovaIconaLocale(item.nome)}" />
        <span class="tratt-nome">${item.nome}</span>
      </div>
      <div class="riga-trattamento__dx">
        <span class="tratt-qta">${item.count}</span>
        <span class="puntatore">•</span>
        <span class="tratt-totale">${€(item.totale)}</span>
      </div>
    `;
    el.listaTop.appendChild(li);
  }
}

let chartRef = null;
async function renderChart(perGiorno, perMese, rangeStart, rangeEnd){
  if (!el.canvas) return;
  await ensureChartJs();

  // Decide granularità
  const diffMs = endOfDay(rangeEnd) - startOfDay(rangeStart);
  const diffDays = Math.round(diffMs / (1000*60*60*24)) + 1;
  const granularita = diffDays <= 35 ? 'daily' : 'monthly';

  let labels = [];
  let data = [];

  if (granularita === 'daily'){
    // costruisci tutti i giorni nel range
    const cur = new Date(rangeStart);
    while (cur <= rangeEnd){
      const k = dayKey(cur);
      labels.push(k.slice(8,10) + '/' + k.slice(5,7)); // gg/mm
      data.push(perGiorno.get(k) || 0);
      cur.setDate(cur.getDate()+1);
    }
  } else {
    // tutti i mesi nel range
    let cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
    const stop = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);
    while (cur <= stop){
      const k = monthKey(cur);
      const label = cur.toLocaleString('it-IT', { month: 'short' }).replace('.','');
      labels.push(label.charAt(0).toUpperCase()+label.slice(1));
      data.push(perMese.get(k) || 0);
      cur.setMonth(cur.getMonth()+1);
    }
  }

  if (chartRef) { chartRef.destroy(); }
  chartRef = new Chart(el.canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Ricavi',
        data,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          ticks: {
            callback: (v) => €(v)
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ' ' + €(ctx.parsed.y || 0)
          }
        }
      }
    }
  });
}

async function aggiornaUI(range){
  // 1) fetch
  const apps = await getAppuntamentiNelRange(range.start, range.end);

  // 2) aggrega
  const agg = aggregaStatistiche(apps);

  // 3) numeri principali
  if (el.fatturato) el.fatturato.textContent = €(agg.fatturato);
  if (el.appuntamenti) el.appuntamenti.textContent = agg.appuntamentiCount.toString();
  if (el.scontrino) el.scontrino.textContent = €(agg.scontrinoMedio);

  // 4) trattamento top (nome + icona)
  if (agg.topTratt){
    if (el.trattTopNome) el.trattTopNome.textContent = agg.topTratt.nome;
    if (el.trattTopIcona){
      el.trattTopIcona.innerHTML = '';
      const img = document.createElement('img');
      img.alt = '';
      img.src = agg.topTratt.icona || trovaIconaLocale(agg.topTratt.nome);
      img.style.width = '28px';
      img.style.height = '28px';
      img.style.objectFit = 'contain';
      el.trattTopIcona.appendChild(img);
    }
  } else {
    if (el.trattTopNome) el.trattTopNome.textContent = '—';
    if (el.trattTopIcona) el.trattTopIcona.innerHTML = '';
  }

  // 5) cliente top (nome e cognome al posto dell’ID)
  if (agg.topCliente?.clienteId){
    const nome = await nomeClienteDaId(agg.topCliente.clienteId);
    if (el.clienteTop) el.clienteTop.textContent = nome;
  } else {
    if (el.clienteTop) el.clienteTop.textContent = '—';
  }

  // 6) lista top trattamenti
  renderTopTrattamenti(agg.listaTopTratt);

  // 7) grafico
  await renderChart(agg.perGiorno, agg.perMese, range.start, range.end);
}

// ─────────────────────────────────────────────────────────────────────────────
// Wiring filtri UI
// ─────────────────────────────────────────────────────────────────────────────
function setupFiltri(){
  el?.btnMeseCorrente?.addEventListener('click', () => aggiornaUI(getRangeMeseCorrente()));
  el?.btnMeseScorso?.addEventListener('click', () => aggiornaUI(getRangeMeseScorso()));
  el?.btnAnnoCorrente?.addEventListener('click', () => aggiornaUI(getRangeAnnoCorrente()));
  el?.btnApplicaIntervallo?.addEventListener('click', () => {
    const r = getRangePersonalizzato();
    if (r) aggiornaUI(r);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setupFiltri();
  // avvio con "Mese corrente"
  await aggiornaUI(getRangeMeseCorrente());
});