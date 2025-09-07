// ui.js — gestione notifiche e stato connessione

// Crea barra di stato sotto la top-bar
let statusBar = null;
function ensureStatusBar() {
  if (!statusBar) {
    statusBar = document.createElement("div");
    statusBar.id = "connectionStatusBar";
    statusBar.style.position = "fixed";
    statusBar.style.top = "0";                // sempre attaccato in alto
    statusBar.style.left = "0";
    statusBar.style.width = "100%";           // larghezza piena
    statusBar.style.height = "28px";
    statusBar.style.display = "none";
    statusBar.style.alignItems = "center";
    statusBar.style.justifyContent = "center";
    statusBar.style.fontSize = "14px";
    statusBar.style.fontWeight = "500";
    statusBar.style.color = "#fff";
    statusBar.style.zIndex = "9999";
    statusBar.style.transition = "opacity 0.3s ease";
    document.body.appendChild(statusBar);

    // Spingi il contenuto in basso di 28px, così il banner non copre
    if (!document.body.style.paddingTop) {
      document.body.style.paddingTop = "28px";
    }
  }
  return statusBar;
}

// Mostra barra con colore e testo
function showStatusBar(text, bg, autoHide = false) {
  const bar = ensureStatusBar();
  bar.textContent = text;
  bar.style.background = bg;
  bar.style.display = "flex";
  bar.style.opacity = "1";

  if (autoHide) {
    setTimeout(() => {
      bar.style.opacity = "0";
      setTimeout(() => { bar.style.display = "none"; }, 300);
    }, 3000);
  }
}

// API pubbliche
export function showOffline() {
  showStatusBar("Sei offline 🚫", "#e57373", false);
}
export function showOnline() {
  showStatusBar("Connessione ripristinata ✅", "#81c784", true);
}
export function showSyncOK() {
  showStatusBar("Dati sincronizzati ✅", "#d2b8a3", true);
}
export function showSyncFail() {
  showStatusBar("Sincronizzazione fallita 🚫", "#e57373", true);
}