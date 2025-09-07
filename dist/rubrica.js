// rubrica.js — usa la stessa istanza Firestore (offline cache) da auth.js
import { db } from "./auth.js";
import {
  collection, addDoc, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAll, putOne } from "./storage.js";  // 🔥 integrazione cache offline

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
  function showModal(m){ if(m) m.style.display = "flex"; }
  function closeModal(m){ if(m) m.style.display = "none"; }

  // ─── Carica & render rubrica ─────────────────────────
  async function caricaClienti() {
    clientList.innerHTML = `<li class="section" style="opacity:.6">Caricamento…</li>`;
    let data = [];

    try {
      // 🔹 tenta da Firestore
      const snapshot = await getDocs(collection(db, "clienti"));
      data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      // 🔹 aggiorna cache offline
      for (const c of data) {
        await putOne("clienti", c);
      }
    } catch (err) {
      console.warn("[rubrica] offline, uso cache:", err);
      // 🔹 fallback da IndexedDB
      data = await getAll("clienti");
    }

    // normalizza: assicurati che nome/telefono siano stringhe
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

    const letters = Object.keys(groups).sort((a,b)=> a.localeCompare(b, "it"));

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
          li.onclick = () => { location.href = `cliente.html?id=${encodeURIComponent(c.id)}`; };
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
        target && target.scrollIntoView({ behavior: "smooth", block: "start" });
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

      // mostra/nascondi intestazioni di sezione in base agli item visibili
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
  openAddModal?.addEventListener("click", () => { addForm?.reset(); showModal(addModal); });
  closeAddModal?.addEventListener("click", () => closeModal(addModal));

  addForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = (addNome?.value || "").trim();
    const telefono = (addTelefono?.value || "").trim();
    if (!nome) { alert("Inserisci un nome."); return; }

    try {
      const docRef = await addDoc(collection(db, "clienti"), { nome, telefono });
      // 🔹 aggiorna subito anche la cache
      await putOne("clienti", { id: docRef.id, nome, telefono });
      closeModal(addModal);
      await caricaClienti();
    } catch (err) {
      console.error("[rubrica] errore add cliente:", err);
      alert("Errore durante il salvataggio del cliente.");
    }
  });

  // ─── Avvio ───────────────────────────────────────────
  caricaClienti();
})();