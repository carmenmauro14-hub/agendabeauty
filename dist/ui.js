// ui.js — gestione notifiche e stato connessione

let statusBar = null;
function ensureStatusBar() {
  if (!statusBar) {
    statusBar = document.createElement("div");
    statusBar.id = "connectionStatusBar";
    statusBar.style.width = "100%";
    statusBar.style.height = "28px";
    statusBar.style.display = "none";
    statusBar.style.alignItems = "center";
    statusBar.style.justifyContent = "center";
    statusBar.style.fontSize = "14px";
    statusBar.style.fontWeight = "500";
    statusBar.style.color = "#fff";
    statusBar.style.transition = "opacity 0.3s ease";

    // Inserito SUBITO DOPO la navbar
    const navbar = document.getElementById("navbar-placeholder");
    if (navbar) {
      navbar.insertAdjacentElement("afterend", statusBar);
    } else {
      document.body.prepend(statusBar);
    }
  }
  return statusBar;
}

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