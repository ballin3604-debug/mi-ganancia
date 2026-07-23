// Formatea una fecha como 'YYYY-MM-DD' usando componentes LOCALES (no UTC)
export function toLocalISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getDayRange(base = new Date()) {
  const iso = toLocalISODate(base);
  return { start: iso, end: iso };
}

// Semana de lunes a domingo que contiene `base`, sin importar qué día es hoy.
export function getWeekRange(base = new Date()) {
  const dow = base.getDay(); // 0=Dom..6=Sáb
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(base);
  monday.setDate(base.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: toLocalISODate(monday), end: toLocalISODate(sunday) };
}

export function getMonthRange(base = new Date()) {
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const last = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return { start: toLocalISODate(first), end: toLocalISODate(last) };
}
