// cliente.js — dettaglio cliente offline-first + sync_queue
import { db } from "./auth.js";
import {
  doc, getDoc, updateDoc, deleteDoc,
  collection, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { openWhatsAppReminder } from "./reminder-core.js";
import {
  getAll, getById, putOne, putMany,
  queueChange, deleteById
} from "./storage.js";

/* ───── Utils ───── */
const fmtEuro = (n) => Number(n || 0).toLocaleString("it-IT",{style:"currency",currency:"EUR"});
const FMT_DATA = new Intl.DateTimeFormat("it-IT",{day:"2-digit",month:"2-digit",year:"2-digit"});

function toNumberSafe(v){
  if(v==null) return 0;
  if(typeof v==="number") return isFinite(v)?v:0;
  if(typeof v==="string"){
    const n=parseFloat(v.replace(/[€\s]/g,"").replace(",","."));
    return isNaN(n)?0:n;
  }
  return 0;
}
function safeDate(d){
  if(!d) return null;
  if(d?.toDate) return d.toDate();
  if(typeof d==="number") return new Date(d);
  if(typeof d==="string") return new Date(d);
  return d instanceof Date ? d : null;
}
function getApptTotal(a){
  if(Array.isArray(a.trattamenti)) return a.trattamenti.reduce((s,t)=>s+toNumberSafe(t?.prezzo),0);
  return toNumberSafe(a.prezzo ?? a.totale);
}
function getApptNames(a){
  if(Array.isArray(a.trattamenti)) return a.trattamenti.map(t=>t?.nome||t).join(", ");
  return a.trattamento || "";
}
const debounce = (fn,ms=600)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};};
const autosize = (el)=>{ if(!el) return; el.style.height="auto"; el.style.height=Math.max(el.scrollHeight,92)+"px"; };
const getClienteId = ()=> new URLSearchParams(location.search).get("id") || sessionStorage.getItem("clienteId");

/* ───── DOM ───── */
const backBtn=document.getElementById("backBtn");
const editBtnTop=document.getElementById("editBtnTop");

const avatarIniziali=document.getElementById("avatarIniziali");
const displayName=document.getElementById("displayName");
const infoPhone=document.getElementById("infoPhone");
const infoEmail=document.getElementById("infoEmail");
const rowEmail=document.getElementById("rowEmail");

const noteInput=document.getElementById("noteInput");
const noteStatus=document.getElementById("noteStatus");

const infoView=document.getElementById("infoView");
const infoEdit=document.getElementById("infoEdit");
const editNome=document.getElementById("editNome");
const editTelefono=document.getElementById("editTelefono");
const editEmail=document.getElementById("editEmail");
const cancelInline=document.getElementById("cancelInline");

const yearSelect=document.getElementById("yearSelect");
const valAnno=document.getElementById("valAnno");
const valTotale=document.getElementById("valTotale");
const barAnno=document.getElementById("barAnno");
const barTotale=document.getElementById("barTotale");
const yearByTreatment=document.getElementById("yearByTreatment");

const historyList=document.getElementById("historyList");
const showAllBtn=document.getElementById("showAllHistory");

/* ───── Stato ───── */
let clienteId=null;
let clienteData=null;
let allAppointments=[];
let allYears=[];

/* ───── Caricamento Cliente ───── */
async function caricaCliente(){
  clienteId=getClienteId();
  if(!clienteId) return;

  try {
    const snap=await getDoc(doc(db,"clienti",clienteId));
    if(snap.exists()){ clienteData={id:clienteId,...snap.data()}; await putOne("clienti",clienteData); }
    else return;
  } catch {
    clienteData=await getById("clienti",clienteId);
    if(!clienteData) return;
  }

  renderCliente();
  await caricaStorico();
  await caricaStatistiche();
}

function renderCliente(){
  const nome=clienteData.nome||"—";
  const tel=(clienteData.telefono||"").toString().trim();
  const mail=(clienteData.email||"").toString().trim();
  const note=(clienteData.note||"").toString();

  displayName.textContent=nome;
  infoPhone.textContent=tel||"—";
  infoPhone.href=tel?`tel:${tel}`:"#";

  if(mail){ rowEmail.style.display=""; infoEmail.textContent=mail; infoEmail.href=`mailto:${mail}`; }
  else rowEmail.style.display="none";

  noteInput.value=note; autosize(noteInput); noteStatus.textContent="";
  avatarIniziali.textContent=(nome.split(" ").map(w=>w[0]).slice(0,2).join("")||"AA").toUpperCase();

  const btnSms=document.getElementById("btnSms");
  const btnCall=document.getElementById("btnCall");
  const btnWa=document.getElementById("btnWa");
  const btnApp=document.getElementById("btnApp");
  const btnRem=document.getElementById("btnRem");

  if(tel){ btnSms.href=`sms:${tel}`; btnCall.href=`tel:${tel}`; btnWa.href=`https://wa.me/${tel.replace(/[^\d]/g,"")}`; }
  else { btnSms.removeAttribute("href"); btnCall.removeAttribute("href"); btnWa.removeAttribute("href"); }

  btnApp.href=`nuovo-appuntamento.html?cliente=${encodeURIComponent(clienteId)}`;
  btnRem.onclick=(e)=>{ e.preventDefault(); openWhatsAppReminder(clienteData, allAppointments); };
}

/* ───── Note ───── */
const saveNote=debounce(async()=>{
  if(!clienteId) return;
  const newNote=noteInput.value.trim();
  if(newNote===(clienteData.note||"")) return;

  noteStatus.textContent="Salvataggio…";
  try{
    if(navigator.onLine) await updateDoc(doc(db,"clienti",clienteId),{note:newNote});
    else await queueChange({collezione:"clienti",op:"update",id:clienteId,payload:{note:newNote}});
    clienteData.note=newNote; await putOne("clienti",clienteData);
    noteStatus.textContent="Salvato"; setTimeout(()=>noteStatus.textContent="",1200);
  }catch{
    clienteData.note=newNote; await putOne("clienti",clienteData);
    await queueChange({collezione:"clienti",op:"update",id:clienteId,payload:{note:newNote}});
    noteStatus.textContent="Errore salvataggio (offline)";
  }
},700);
noteInput.addEventListener("input",()=>{ autosize(noteInput); saveNote(); });
window.addEventListener("resize",()=>autosize(noteInput));

/* ───── Storico ───── */
async function caricaStorico(){
  historyList.innerHTML="";
  let arr=[];
  try {
    const qs=await getDocs(query(collection(db,"appuntamenti"),where("clienteId","==",clienteId)));
    arr=qs.docs.map(d=>({id:d.id,...d.data()})); await putMany("appuntamenti",arr);
  } catch {
    const cached=await getAll("appuntamenti");
    arr=cached.filter(a=>a.clienteId===clienteId);
  }
  processStorico(arr);
}
function processStorico(arr){
  let totaleSempre=0;
  allAppointments=arr;
  const items=arr.map(a=>{
    const dt=safeDate(a.data);
    const tot=getApptTotal(a); totaleSempre+=tot;
    return {dt,tratt:getApptNames(a),prezzo:tot};
  }).sort((a,b)=>(b.dt?.getTime?.()||0)-(a.dt?.getTime?.()||0));

  renderHistory(historyList,items.slice(0,3));
  showAllBtn.style.display=items.length>3?"":"none";
  valTotale.textContent=fmtEuro(totaleSempre); barTotale.style.width="100%";
  allYears=[...new Set(items.map(i=>i.dt?.getFullYear()).filter(Boolean))].sort((a,b)=>b-a);
}
function renderHistory(container,items){
  container.innerHTML="";
  items.forEach(it=>{
    const li=document.createElement("li");
    li.innerHTML=`<div><div class="h-date">${it.dt?FMT_DATA.format(it.dt):"—"}</div>
                  <div class="h-tratt">${it.tratt||"—"}</div></div>
                  <div class="h-amt">${fmtEuro(it.prezzo)}</div>`;
    container.appendChild(li);
  });
}

/* ───── Statistiche ───── */
async function caricaStatistiche(){
  let arr=[];
  try {
    const qs=await getDocs(query(collection(db,"appuntamenti"),where("clienteId","==",clienteId)));
    arr=qs.docs.map(d=>({id:d.id,...d.data()})); await putMany("appuntamenti",arr);
  } catch {
    const cached=await getAll("appuntamenti");
    arr=cached.filter(a=>a.clienteId===clienteId);
  }
  renderStats(arr);
}
function renderStats(arr){
  const anni=[...new Set(arr.map(a=>safeDate(a.data)?.getFullYear()).filter(Boolean))].sort((a,b)=>b-a);
  yearSelect.innerHTML=anni.map(y=>`<option value="${y}">${y}</option>`).join("");
  yearSelect.value=anni[0]||new Date().getFullYear();
  yearSelect.onchange=()=>aggiornaStats(Number(yearSelect.value));
  aggiornaStats(Number(yearSelect.value));
}
function aggiornaStats(anno){
  const arr=allAppointments.filter(a=>safeDate(a.data)?.getFullYear()===anno);
  let totAnno=0; const perTratt={};
  arr.forEach(a=>{
    const tot=getApptTotal(a); totAnno+=tot;
    (a.trattamenti||[]).forEach(t=>{
      const nome=t?.nome||"Trattamento";
      const p=toNumberSafe(t?.prezzo);
      perTratt[nome]=(perTratt[nome]||{count:0,sum:0});
      perTratt[nome].count++; perTratt[nome].sum+=p;
    });
  });
  valAnno.textContent=fmtEuro(totAnno);
  const totSempre=toNumberSafe(valTotale.textContent);
  barAnno.style.width=totSempre?`${Math.min(100,(totAnno/totSempre)*100).toFixed(0)}%`:"0";
  yearByTreatment.innerHTML=Object.entries(perTratt).sort((a,b)=>b[1].count-a[1].count)
    .map(([n,v])=>`<li><div class="qta-nome">${v.count} ${n}</div><div class="totale">${fmtEuro(v.sum)}</div></li>`).join("")||"<li>—</li>";
}

/* ───── Edit Cliente ───── */
function setEditMode(on){
  document.body.classList.toggle("editing",on);
  infoView.style.display=on?"none":"";
  infoEdit.style.display=on?"flex":"none";

  let delBtn=document.getElementById("deleteClienteBtn");
  if(on && !delBtn){
    delBtn=document.createElement("button");
    delBtn.id="deleteClienteBtn"; delBtn.className="btn-danger";
    delBtn.innerHTML='<i class="fa-solid fa-trash"></i> Elimina Cliente';
    infoEdit.appendChild(delBtn);

    delBtn.onclick=async()=>{
      if(!confirm("Vuoi davvero eliminare questo cliente?")) return;
      try{
        if(navigator.onLine){
          await deleteDoc(doc(db,"clienti",clienteId)); await deleteById("clienti",clienteId);
          const qs=await getDocs(query(collection(db,"appuntamenti"),where("clienteId","==",clienteId)));
          for(const d of qs.docs){ await updateDoc(d.ref,{clienteId:null,nome:"Cliente eliminato"});
            await putOne("appuntamenti",{...d.data(),id:d.id,clienteId:null,nome:"Cliente eliminato"}); }
        }else{
          await deleteById("clienti",clienteId);
          await queueChange({collezione:"clienti",op:"delete",id:clienteId,payload:{id:clienteId}});
          const all=await getAll("appuntamenti");
          for(const a of all.filter(x=>x.clienteId===clienteId)){
            a.clienteId=null; a.nome="Cliente eliminato"; await putOne("appuntamenti",a);
            await queueChange({collezione:"appuntamenti",op:"update",id:a.id,payload:a});
          }
          alert("Cliente eliminato offline (sarà sincronizzato)");
        }
        location.href="rubrica.html";
      }catch(err){ console.error("[cliente] elimina",err); alert("Errore durante l'eliminazione"); }
    };
  } else if(!on && delBtn) delBtn.remove();
}

editBtnTop.onclick=()=>{ if(clienteData){ editNome.value=clienteData.nome||""; editTelefono.value=clienteData.telefono||""; editEmail.value=clienteData.email||""; setEditMode(true);} };
cancelInline.onclick=()=>setEditMode(false);

infoEdit.addEventListener("submit",async e=>{
  e.preventDefault(); if(!clienteId) return;
  const payload={ nome:editNome.value.trim(), telefono:editTelefono.value.trim(), email:editEmail.value.trim() };
  try{
    if(navigator.onLine) await updateDoc(doc(db,"clienti",clienteId),payload);
    else await queueChange({collezione:"clienti",op:"update",id:clienteId,payload});
    clienteData={...clienteData,...payload}; await putOne("clienti",clienteData);
  }catch{ clienteData={...clienteData,...payload}; await putOne("clienti",clienteData);
          await queueChange({collezione:"clienti",op:"update",id:clienteId,payload}); }
  setEditMode(false); renderCliente();
});

/* ───── Back & Init ───── */
backBtn.onclick=()=>history.back();
caricaCliente();