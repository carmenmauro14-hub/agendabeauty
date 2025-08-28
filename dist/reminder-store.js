// =============== reminder-store.js ==================
// Piccolo “store” per il template promemoria.
// Al momento usa localStorage; in futuro potrai
// sostituire qui l’implementazione (es. Firestore).

export const REMINDER_KEY = "bb-reminder-template";

export const DEFAULT_TEMPLATE =
  "Ciao {NOME}! Ti ricordiamo l’appuntamento del {DATA} alle {ORA}. A presto!";

/** Restituisce il template salvato (o il default se vuoto). */
export function loadTemplate() {
  try {
    const v = localStorage.getItem(REMINDER_KEY);
    return (v && v.length) ? v : DEFAULT_TEMPLATE;
  } catch {
    return DEFAULT_TEMPLATE;
  }
}

/** Salva il template. Ritorna true/false sul successo. */
export function saveTemplate(text) {
  try {
    localStorage.setItem(REMINDER_KEY, String(text ?? ""));
    return true;
  } catch {
    return false;
  }
}

/** Ripristina il template di default. */
export function resetTemplate() {
  return saveTemplate(DEFAULT_TEMPLATE);
}

/**
 * Utilità: genera l’anteprima sostituendo i placeholder.
 * Esempio d’uso:
 *   renderPreview("{NOME} {DATA}", {NOME:"Anna", DATA:"10/10"})
 */
export function renderPreview(tpl, data) {
  let out = String(tpl ?? "");
  Object.entries(data || {}).forEach(([k, v]) => {
    const token = new RegExp("\\{" + k + "\\}", "g");
    out = out.replace(token, String(v));
  });
  return out;
}