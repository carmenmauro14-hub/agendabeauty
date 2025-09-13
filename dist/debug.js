// debug.js — mostra errori runtime anche in PWA iOS
window.addEventListener("error", (e) => {
  const box = document.createElement("div");
  box.style.position = "fixed";
  box.style.bottom = "0";
  box.style.left = "0";
  box.style.right = "0";
  box.style.background = "red";
  box.style.color = "white";
  box.style.fontSize = "12px";
  box.style.padding = "4px";
  box.style.zIndex = "9999";
  box.textContent = "Errore: " + e.message;
  document.body.appendChild(box);
});

// helper da usare nei vari init
export function debugMsg(msg) {
  const box = document.createElement("div");
  box.style.background = "#eee";
  box.style.fontSize = "12px";
  box.style.padding = "2px 4px";
  box.style.borderBottom = "1px solid #ccc";
  box.textContent = msg;
  document.body.insertAdjacentElement("afterbegin", box);
  console.log(msg);
}