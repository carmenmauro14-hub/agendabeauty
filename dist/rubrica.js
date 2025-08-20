function renderStatsForYear(year) {
  if (!year || !currentClientAppointments.length) {
    yearTreatmentsCountEl.textContent = "0";
    yearSpentEl.textContent = "0,00";
    yearByTreatmentEl.innerHTML = "<li>—</li>";
    return;
  }

  const freq = {};
  let totalTreatments = 0;
  let totalSpentYear = 0;

  currentClientAppointments.forEach(app => {
    const dt = toDateSafe(app.data || app.date || app.dateTime);
    if (!dt || dt.getFullYear() !== year) return;

    const tratt = Array.isArray(app.trattamenti) ? app.trattamenti : [];
    tratt.forEach(t => {
      const nome = t?.nome || t?.titolo || t?.trattamento || "Trattamento";
      const prezzo = toNumberSafe(t?.prezzo ?? t?.costo ?? t?.price);
      if (!freq[nome]) freq[nome] = { count: 0, spend: 0 };
      freq[nome].count += 1;
      freq[nome].spend += prezzo;
      totalTreatments += 1;
      totalSpentYear += prezzo;
    });
  });

  yearTreatmentsCountEl.textContent = String(totalTreatments);
  yearSpentEl.textContent = totalSpentYear.toFixed(2).replace(".", ",");

  const items = Object.entries(freq)
    .sort((a,b)=> b[1].count - a[1].count || b[1].spend - a[1].spend)
    .map(([nome, v]) => `
      <li class="riga-trattamento">
        <span class="qta-nome">${v.count} ${nome}</span>
        <span class="totale">Tot. € ${v.spend.toFixed(2).replace(".", ",")}</span>
      </li>
    `)
    .join("");

  yearByTreatmentEl.innerHTML = items || "<li>—</li>";
}