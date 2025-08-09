// swipe.js
export function abilitaSwipe(elemento, callbackSinistra, callbackDestra, bloccaPropagazione = false) {
  let startX = 0;

  elemento.addEventListener("touchstart", (e) => {
    if (bloccaPropagazione) e.stopPropagation();
    startX = e.changedTouches[0].clientX;
  });

  elemento.addEventListener("touchend", (e) => {
    if (bloccaPropagazione) e.stopPropagation();
    const endX = e.changedTouches[0].clientX;
    const diff = startX - endX;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        callbackSinistra(); // swipe sinistra
      } else {
        callbackDestra();   // swipe destra
      }
    }
  });
}

export function abilitaSwipeVerticale(elemento, callbackSu, callbackGiu, bloccaPropagazione = false, soglia = 50) {
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

    // prevale movimento verticale e supera la soglia
    if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > soglia) {
      if (diffY < 0) callbackSu && callbackSu();   // swipe verso l'alto
      else callbackGiu && callbackGiu();           // swipe verso il basso
    }
  }, { passive: true });
}