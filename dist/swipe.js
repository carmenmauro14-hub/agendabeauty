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