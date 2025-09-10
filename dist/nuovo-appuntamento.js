// nuovo-appuntamento.js — wizard 3 step con supporto offline-first

// ─── Firebase (riuso di auth.js) ────────────────────────────────
import { db } from "./auth.js";
import {
  collection, getDocs, addDoc, updateDoc, getDoc, doc, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ─── Swipe utility ──────────────────────────────────────────────
import { abilitaSwipeVerticale } from "./swipe.js";

// ─── Offline storage helpers ───────────────────────────────────
import { putOne, getAll, queueChange } from "./storage.js";

// ─── Parametri URL ─────────────────────────────────────────────
const params          = new URLSearchParams(location.search);
const editId          = params.get("edit");
const presetClienteId = params.get("cliente");
const presetDataISO   = params.get("data");

// ─── Utils ─────────────────────────────────────────────────────
function setPageTitle(text) {
  const titleEl = document.getElementById("wizardTitle");
  if (titleEl) titleEl.textContent = text;
  document.title = text;
}

// ─── DOM riferimenti ───────────────────────────────────────────
const step1   = document.getElementById("step1");
const step2   = document.getElementById("step2");
const step3   = document.getElementById("step3");

const btnToStep2     = document.getElementById("toStep2");
const btnBackToStep1 = document.getElementById("backToStep1");
const btnToStep3     = document.getElementById("toStep3");
const btnBackToStep2 = document.getElementById("backToStep2");
const btnSalva       = document.getElementById("salvaAppuntamento");
const btnCancel      = document.getElementById("cancelWizard");

const inpData  = document.getElementById("dataAppuntamento");
const inpOra   = document.getElementById("oraAppuntamento");
const wrapperTratt = document.getElementById("trattamentiWrapper");

// Cliente
const clienteIdHidden    = document.getElementById("clienteId");
const openRubrica        = document.getElementById("openRubrica");
const openRubricaField   = document.getElementById("openRubricaField");
const pickerValue        = document.getElementById("pickerValue");
const pickerPlaceholder  = document.getElementById("pickerPlaceholder");
const rubricaModal       = document.getElementById("rubricaModal");
const rubricaPanel       = document.querySelector("#rubricaModal .rubrica-container");
const clientListPicker   = document.getElementById("clientListPicker");
const letterNavPicker    = document.getElementById("letterNavPicker");
const searchCliente      = document.getElementById("searchCliente");
const btnRubricaClose    = document.getElementById("rubricaClose");

// Sheet wrapper
const pageModal   = document.querySelector(".page-modal");
const sheetEl     = document.getElementById("wizardSheet");
const sheetHeader = document.querySelector(".sheet-header");
const sheetClose  = document.getElementById("sheetClose");

// ─── Stato ─────────────────────────────────────────────────────
let clientiCache = null;
let apptData     = null;

// ─── Navigazione UI ───────────────────────────────────────────
function updateNavState() {
  btnToStep2.disabled = !clienteIdHidden.value;
  btnToStep3.disabled = !(inpData.value && inpOra.value);
}
[inpData, inpOra].forEach(el => el?.addEventListener("input", updateNavState));

// ─── Overlay / Sheet ──────────────────────────────────────────
function chiudiSheet() {
  if (!sheetEl) return;
  sheetEl.classList.add("swipe-out-down");
  sheetEl.addEventListener("transitionend", () => {
    document.getElementById("cancelWizard")?.click();
  }, { once: true });
}
sheetClose?.addEventListener("click", chiudiSheet);
pageModal?.addEventListener("click", e => { if (e.target === pageModal) chiudiSheet(); });
if (sheetHeader) abilitaSwipeVerticale(sheetHeader, null, chiudiSheet, true, 45);

// ─── Rubrica ──────────────────────────────────────────────────
async function apriRubrica() {
  if (!clientiCache) {
    try {
      const snap = await getDocs(collection(db, "clienti"));
      clientiCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch {
      clientiCache = await getAll("clienti");
    }
    clientiCache.sort((a,b)=>(a.nome||"").localeCompare(b.nome||""));
  }
  renderRubrica(clientiCache);
  rubricaModal.style.display = "flex";
}
openRubrica?.addEventListener("click", apriRubrica);
openRubricaField?.addEventListener("click", apriRubrica);
btnRubricaClose?.addEventListener("click", chiudiRubrica);

function chiudiRubrica() {
  if (!rubricaPanel) return rubricaModal.style.display = "none";
  rubricaPanel.classList.add("swipe-out-down");
  rubricaPanel.addEventListener("transitionend", () => {
    rubricaPanel.classList.remove("swipe-out-down");
    rubricaModal.style.display = "none";
  }, { once: true });
}

function renderRubrica(clienti) {
  const groups = {};
  clienti.forEach(c => {
    const L = (c.nome||"#").charAt(0).toUpperCase();
    (groups[L] = groups[L] || []).push(c);
  });
  const letters = Object.keys(groups).sort();

  clientListPicker.innerHTML = "";
  letters.forEach(L => {
    const sec = document.createElement("li");
    sec.className = "section"; sec.textContent = L;
    clientListPicker.appendChild(sec);
    groups[L].forEach(c => {
      const li = document.createElement("li");
      li.className = "item"; li.textContent = c.nome || "(senza nome)";
      li.onclick = () => {
        clienteIdHidden.value = c.id;
        pickerValue.textContent = c.nome || "(senza nome)";
        pickerPlaceholder.style.display = "none";
        openRubricaField.classList.remove("empty");
        rubricaModal.style.display = "none";
        updateNavState();
      };
      clientListPicker.appendChild(li);
    });
  });

  letterNavPicker.innerHTML = "";
  letters.forEach(L => {
    const el = document.createElement("span");
    el.textContent = L;
    el.onclick = () => document.getElementById("picker-letter-"+L)?.scrollIntoView({behavior:"smooth"});
    letterNavPicker.appendChild(el);
  });
}

searchCliente?.addEventListener("input", () => {
  const f = searchCliente.value.toLowerCase();
  letterNavPicker.style.display = f ? "none":"flex";
  clientListPicker.querySelectorAll("li.item").forEach(li=>{
    li.style.display = li.textContent.toLowerCase().includes(f) ? "" : "none";
  });
});

// ─── Trattamenti ──────────────────────────────────────────────
async function caricaTrattamenti(selectedMap=null) {
  wrapperTratt.innerHTML = "";
  let lista=[];
  try {
    const snap = await getDocs(collection(db,"trattamenti"));
    lista = snap.docs.map(d=>({id:d.id,...d.data()}));
  } catch {
    lista = await getAll("trattamenti");
  }
  lista.sort((a,b)=>(a.nome||"").localeCompare(b.nome||""));

  for (const t of lista) {
    const icona = t.icona || "icone_uniformate_colore/setting.png";
    const prezzo = Number(t.prezzo)||0;
    const checked = selectedMap?.has(t.nome) || false;
    const prezzoSel = selectedMap?.get(t.nome) ?? prezzo;

    const row = document.createElement("div");
    row.classList.add("trattamento-row");
    row.innerHTML = `
      <label>
        <input type="checkbox" class="trattamento-checkbox" ${checked?"checked":""}
               data-nome="${t.nome}" data-prezzo="${prezzo}" data-icona="${icona}">
        <img src="${icona}" alt="${t.nome}" class="icona-trattamento"> ${t.nome}
      </label>
      <input type="number" class="prezzo-input" value="${prezzoSel}" min="0" step="0.01">
    `;
    wrapperTratt.appendChild(row);
  }
}

// ─── Navigazione step ──────────────────────────────────────────
btnToStep2?.addEventListener("click", ()=>{
  if(!clienteIdHidden.value) return alert("Seleziona un cliente");
  step1.style.display="none"; step2.style.display="block";
});
btnBackToStep1?.addEventListener("click", ()=>{
  step2.style.display="none"; step1.style.display="block";
});
btnToStep3?.addEventListener("click", ()=>{
  if(!(inpData.value&&inpOra.value)) return alert("Inserisci data e ora");
  step2.style.display="none"; step3.style.display="block";
});
btnBackToStep2?.addEventListener("click", ()=>{
  step3.style.display="none"; step2.style.display="block";
});

// ─── Salvataggio appuntamento ──────────────────────────────────
btnSalva?.addEventListener("click", async ()=>{
  const clienteId=clienteIdHidden.value;
  if(!clienteId) return alert("Seleziona un cliente");
  if(!(inpData.value&&inpOra.value)) return alert("Inserisci data e ora");

  const selected=[...document.querySelectorAll(".trattamento-checkbox:checked")];
  if(!selected.length) return alert("Seleziona almeno un trattamento");

  const trattamenti=selected.map(cb=>{
    const row=cb.closest(".trattamento-row");
    const prezzo=parseFloat(row.querySelector(".prezzo-input").value)||0;
    return {nome:cb.dataset.nome, prezzo, icona:cb.dataset.icona};
  });

  const dataISO=inpData.value;
  const ora=inpOra.value;
  const d=new Date(dataISO+"T"+ora);
  const payload={ clienteId, dataISO, ora, data:Timestamp.fromDate(new Date(dataISO)), dateTime:Timestamp.fromDate(d), trattamenti };

  try{
    if(navigator.onLine){
      if(editId){
        await updateDoc(doc(db,"appuntamenti",editId),payload);
        await putOne("appuntamenti",{id:editId,...payload});
      }else{
        const ref=await addDoc(collection(db,"appuntamenti"),payload);
        await putOne("appuntamenti",{id:ref.id,...payload});
      }
    }else{
      const tempId="temp-"+Date.now();
      await putOne("appuntamenti",{id:tempId,...payload});
      await queueChange({collezione:"appuntamenti",op:editId?"update":"add",id:editId||tempId,payload});
    }
    location.href="calendario.html";
  }catch(err){ console.error("Errore salvataggio",err); alert("Errore salvataggio."); }
});

// ─── INIT ──────────────────────────────────────────────────────
(async function init(){
  setPageTitle(editId?"Modifica Appuntamento":"Nuovo Appuntamento");

  if(!editId){
    await caricaTrattamenti();
    if(presetClienteId){
      try{
        const snap=await getDoc(doc(db,"clienti",presetClienteId));
        if(snap.exists()){
          clienteIdHidden.value=presetClienteId;
          pickerValue.textContent=snap.data().nome||"(senza nome)";
          pickerPlaceholder.style.display="none";
          openRubricaField.classList.remove("empty");
        }
      }catch{
        const lista=await getAll("clienti");
        const c=lista.find(x=>x.id===presetClienteId);
        if(c){ clienteIdHidden.value=c.id; pickerValue.textContent=c.nome; pickerPlaceholder.style.display="none"; }
      }
    }
    if(presetDataISO&&!inpData.value) inpData.value=presetDataISO;
  }else{
    let docSnap=null;
    try{ if(navigator.onLine) docSnap=await getDoc(doc(db,"appuntamenti",editId)); }catch{}
    apptData=docSnap?.exists()?docSnap.data(): (await getAll("appuntamenti")).find(x=>x.id===editId);

    if(apptData){
      inpData.value=apptData.dataISO?.slice(0,10)||"";
      inpOra.value =apptData.ora||"";
      if(apptData.clienteId){
        clienteIdHidden.value=apptData.clienteId;
        try{
          const cli=await getDoc(doc(db,"clienti",apptData.clienteId));
          pickerValue.textContent=cli.exists()?cli.data().nome:"(senza nome)";
        }catch{
          const c=(await getAll("clienti")).find(x=>x.id===apptData.clienteId);
          if(c) pickerValue.textContent=c.nome;
        }
        pickerPlaceholder.style.display="none"; openRubricaField.classList.remove("empty");
      }
      const map=new Map((apptData.trattamenti||[]).map(t=>[t.nome,Number(t.prezzo)||0]));
      await caricaTrattamenti(map);
    }else{
      await caricaTrattamenti();
    }
  }

  updateNavState();
  btnCancel?.addEventListener("click", ()=> location.href="calendario.html");
})();