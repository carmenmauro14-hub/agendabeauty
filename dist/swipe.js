// swipe.js
export function abilitaSwipe(
  elemento,
  callbackSinistra,
  callbackDestra,
  bloccaPropagazione = false,
  opzioni = {}
) {
  let startX = 0;
  const soglia = opzioni.soglia || 50;         // distanza minima per attivare swipe
  const minStartEdge = opzioni.minStartEdge || 30; // margine in px da sinistra/destra da ignorare

  elemento.addEventListener("touchstart", (e) => {
    if (bloccaPropagazione) e.stopPropagation();
    startX = e.changedTouches[0].clientX;
  }, { passive: true });

  elemento.addEventListener("touchend", (e) => {
    if (bloccaPropagazione) e.stopPropagation();
    const endX = e.changedTouches[0].clientX;
    const diff = startX - endX;

    // 🟢 Evita conflitti con swipe di sistema Safari (indietro/avanti)
    if (startX < minStartEdge || startX > window.innerWidth - minStartEdge) {
      return; // ignoriamo swipe partiti troppo a bordo
    }

    if (Math.abs(diff) > soglia) {
      if (diff > 0) {
        callbackSinistra && callbackSinistra(); // swipe sinistra
      } else {
        callbackDestra && callbackDestra();     // swipe destra
      }
    }
  }, { passive: true });
}

export function abilitaSwipeVerticale(
  elemento,
  callbackSu,
  callbackGiu,
  bloccaPropagazione = false,
  soglia = 50
) {
  let startX = 0, startY = 0;

  elemento.addEventListener("touchstart", (e) => {
    if (bloccaPropagazione) e.stopPropagation();
    const t = e.changedTouches[0];
    startX = t.clientX;
    startY = t.clientY;
  }, { passive: true });

  elemento.addEventListener("touchend", (e) => {
    if (bloccaPropagazione) e.stopPropagation();
    const t = e.changedTouches[0];
    const diffX = t.clientX - startX;
    const diffY = t.clientY - startY;

    if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > soglia) {
      if (diffY < 0) callbackSu && callbackSu();   // swipe verso l'alto
      else callbackGiu && callbackGiu();           // swipe verso il basso
    }
  }, { passive: true });
}