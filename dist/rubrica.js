// rubrica.js — offline-first con sync_queue
import { db } from "./auth.js";
import {
  collection, addDoc, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAll, putOne, queueChange } from "./storage.js";

(async () => {
  // ─── Elementi DOM ────────────────────────────────────
  const clientList    = document.getElementById("clientList");
  const letterNav     = document.getElementById("letterNav");
  const searchInput   = document.getElementById("searchInput");
  const openAddModal  = document.getElementById("openAddModal");
  const addModal      = document.getElementById("addModal");
  const closeAddModal = document.getElementById("closeAddModal");
  const addForm       = document.getElementById("addForm");
  const addNome       = document.getElementById("addNome");
  const addTelefono   = document.getElementById("addTelefono");

  if (!clientList) {
    console.warn("[rubrica] elementi non presenti: esco senza eseguire.");
    return;
  }

  // ─── Helper: modal ───────────────────────────────────
  const showModal  = (m) => {
    if (!m) return;
    m.style.display = "flex";
    m.setAttribute("aria-hidden", "false");
    const input = m.querySelector("input");
    if (input) setTimeout(() => input.focus(), 50);
  };

  const closeModal = (m) => {
    if (!m) return;
    m.style.display = "none";
    m.setAttribute("aria-hidden", "true");
  };

  // ─── Carica & render rubrica ─────────────────────────
  async function caricaClienti() {
    clientList.innerHTML = `<li class="section" style="opacity:.6">Caricamento…</li>`;
    let data = [];

    try {
      // 🔹 Online → Firestore
      const snapshot = await getDocs(collection(db, "clienti"));
      data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      for (const c of data) await putOne("clienti", c); // aggiorna cache
    } catch (err) {
      console.warn("[rubrica] offline, uso cache:", err);

      // 🔹 Offline → IndexedDB
      data = await getAll("clienti");
      if (!data.length) {
        clientList.innerHTML = `<li class="section" style="opacity:.6">Nessun cliente disponibile offline.<br>Apri almeno una volta online.</li>`;
        return;
      }
    }

    data.forEach(c => {
      c.nome = (c.nome ?? "").toString().trim();
      c.telefono = (c.telefono ?? "").toString().trim();
    });

    renderList(data);
  }

  function renderList(clienti) {
    const groups = {};
    clienti.forEach(c => {
      const first = (c.nome || "#").charAt(0).toUpperCase();
      (groups[first] = groups[first] || []).push(c);
    });

    const letters = Object.keys(groups).sort((a,b)=> a.localeCompare(b,"it"));
    clientList.innerHTML = "";

    letters.forEach(L => {
      const sec = document.createElement("li");
      sec.textContent = L;
      sec.className = "section";
      sec.id = "letter-" + L;
      clientList.appendChild(sec);

      groups[L]
        .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "it"))
        .forEach(c => {
          const li = document.createElement("li");
          li.className = "item";
          li.textContent = c.nome || "(senza nome)";
          li.onclick = () => location.href = `cliente.html?id=${encodeURIComponent(c.id)}`;
          clientList.appendChild(li);
        });
    });

    renderLetterNav(letters);
  }

  function renderLetterNav(letters) {
    if (!letterNav) return;
    letterNav.innerHTML = "";
    letters.forEach(L => {
      const el = document.createElement("span");
      el.textContent = L;
      el.onclick = () => {
        const target = document.getElementById("letter-" + L);
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      };
      letterNav.appendChild(el);
    });
  }

  // ─── Ricerca live ────────────────────────────────────
  if (searchInput) {
    searchInput.oninput = () => {
      const f = searchInput.value.toLowerCase();
      if (letterNav) letterNav.style.display = f ? "none" : "flex";

      document.querySelectorAll("#clientList li.item").forEach(li => {
        li.style.display = li.textContent.toLowerCase().includes(f) ? "" : "none";
      });

      document.querySelectorAll("#clientList li.section").forEach(sec => {
        let el = sec.nextElementSibling, visible = false;
        while (el && !el.classList.contains("section")) {
          if (el.style.display !== "none") { visible = true; break; }
          el = el.nextElementSibling;
        }
        sec.style.display = visible ? "" : "none";
      });
    };
  }

  // ─── Aggiungi cliente ────────────────────────────────
  openAddModal?.addEventListener("click", () => { addForm.reset(); showModal(addModal); });
  closeAddModal?.addEventListener("click", () => closeModal(addModal));

  addForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = (addNome?.value || "").trim();
    const telefono = (addTelefono?.value || "").trim();
    if (!nome) return alert("Inserisci un nome.");

    if (navigator.onLine) {
      try {
        const ref = await addDoc(collection(db, "clienti"), { nome, telefono });
        await putOne("clienti", { id: ref.id, nome, telefono });
      } catch (err) {
        console.error("[rubrica] errore add cliente online:", err);
        alert("Errore durante il salvataggio del cliente.");
      }
    } else {
      // 🔹 Offline → salva con id temporaneo e metti in coda sync
      const tempId = "temp-" + Date.now();
      await putOne("clienti", { id: tempId, nome, telefono });
      await queueChange({
        collezione: "clienti",
        op: "add",
        id: tempId,
        payload: { nome, telefono }
      });
      alert("Cliente salvato offline (sarà sincronizzato)");
    }

    closeModal(addModal);
    await caricaClienti();
  });

  // ─── Avvio ───────────────────────────────────────────
  caricaClienti();
})();