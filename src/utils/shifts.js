// ── Turnos del personal ────────────────────────────────────────────────
// Un turno es un horario fijo (hora de entrada, hora de salida y días de la
// semana) que el dueño asigna a cada miembro del equipo. La caja solo puede
// abrirse mientras el turno del cajero está vigente.
//
// Los días se guardan con el estándar ISO: 1 = lunes … 7 = domingo.
// Un turno nocturno (p. ej. 20:00 a 02:00) pertenece al día en que empieza:
// la madrugada del día siguiente sigue siendo parte del turno del día anterior.

export const SHIFT_PRESETS = [
  { id: 'Mañana', label: 'Mañana', start: '08:00', end: '14:00' },
  { id: 'Tarde', label: 'Tarde', start: '14:00', end: '20:00' },
  { id: 'Noche', label: 'Noche', start: '20:00', end: '02:00' },
];

export const WEEK_DAYS = [
  { id: 1, short: 'Lun', label: 'Lunes' },
  { id: 2, short: 'Mar', label: 'Martes' },
  { id: 3, short: 'Mié', label: 'Miércoles' },
  { id: 4, short: 'Jue', label: 'Jueves' },
  { id: 5, short: 'Vie', label: 'Viernes' },
  { id: 6, short: 'Sáb', label: 'Sábado' },
  { id: 7, short: 'Dom', label: 'Domingo' },
];

export const DEFAULT_SHIFT_DAYS = [1, 2, 3, 4, 5, 6];

export function minutesOfTime(value) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value || '').trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function normalizeTime(value) {
  const minutes = minutesOfTime(value);
  if (minutes === null) return '';
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function normalizeShiftDays(days) {
  if (!Array.isArray(days)) return [];
  return [...new Set(days
    .map((day) => Number(day))
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7))]
    .sort((a, b) => a - b);
}

export function inferShiftLabel(start, end) {
  const preset = SHIFT_PRESETS.find((item) => item.start === start && item.end === end);
  return preset ? preset.label : 'Personalizado';
}

export function normalizeShift(shift) {
  const start = normalizeTime(shift?.start);
  const end = normalizeTime(shift?.end);
  const days = normalizeShiftDays(shift?.days);
  const providedLabel = String(shift?.label || '').trim().slice(0, 30);
  return {
    label: providedLabel || inferShiftLabel(start, end),
    start,
    end,
    days,
  };
}

export function validateShift(shift) {
  const clean = normalizeShift(shift);
  if (!clean.start) return 'Indica la hora de entrada del turno.';
  if (!clean.end) return 'Indica la hora de salida del turno.';
  if (clean.start === clean.end) return 'La entrada y la salida no pueden ser la misma hora.';
  if (clean.days.length === 0) return 'Selecciona al menos un día de trabajo.';
  return '';
}

export function isShiftConfigured(shift) {
  const clean = normalizeShift(shift);
  return Boolean(clean.start && clean.end && clean.days.length > 0);
}

export function formatShiftDays(days) {
  const clean = normalizeShiftDays(days);
  if (clean.length === 0) return 'Sin días';
  if (clean.length === 7) return 'Todos los días';
  if (clean.length === 6 && clean.every((day) => day <= 6)) return 'Lun a Sáb';
  if (clean.length === 5 && clean.every((day) => day <= 5)) return 'Lun a Vie';
  return clean
    .map((day) => WEEK_DAYS.find((item) => item.id === day)?.short || '')
    .filter(Boolean)
    .join(', ');
}

export function formatShiftRange(shift) {
  const clean = normalizeShift(shift);
  if (!clean.start || !clean.end) return 'Sin horario';
  return `${clean.start} a ${clean.end}`;
}

export function isoWeekday(date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date, amount) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function atTime(date, time) {
  const minutes = minutesOfTime(time);
  const copy = new Date(date);
  copy.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return copy;
}

export function formatShiftMoment(date, now = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const today = startOfDay(now);
  const target = startOfDay(date);
  const diffDays = Math.round((target - today) / 86400000);
  const time = date.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (diffDays === 0) return `hoy a las ${time}`;
  if (diffDays === 1) return `mañana a las ${time}`;
  const day = date.toLocaleDateString('es-BO', { weekday: 'short', day: '2-digit', month: 'short' });
  return `${day} a las ${time}`;
}

export function getShiftStatus(shift, now = new Date()) {
  const clean = normalizeShift(shift);
  const base = {
    configured: false,
    active: false,
    label: clean.label,
    start: clean.start,
    end: clean.end,
    days: clean.days,
    windowStart: null,
    windowEnd: null,
    nextStart: null,
  };
  if (!clean.start || !clean.end || clean.days.length === 0) return base;

  const today = startOfDay(now);
  const windows = [];
  // De ayer a los próximos 7 días: cubre el turno activo de anoche, el de hoy
  // y la próxima ocurrencia cuando hoy ya pasó.
  for (let offset = -1; offset <= 7; offset += 1) {
    const day = addDays(today, offset);
    if (!clean.days.includes(isoWeekday(day))) continue;
    const startDate = atTime(day, clean.start);
    let endDate = atTime(day, clean.end);
    if (endDate <= startDate) endDate = addDays(endDate, 1);
    windows.push({ start: startDate, end: endDate });
  }
  windows.sort((a, b) => a.start - b.start);

  const activeWindow = windows.find((window) => now >= window.start && now < window.end) || null;
  const nextWindow = windows.find((window) => window.start > now) || null;

  return {
    ...base,
    configured: true,
    active: Boolean(activeWindow),
    windowStart: (activeWindow || nextWindow)?.start || null,
    windowEnd: (activeWindow || nextWindow)?.end || null,
    nextStart: nextWindow?.start || null,
  };
}

export function isShiftActive(shift, now = new Date()) {
  return getShiftStatus(shift, now).active;
}

export function describeShiftStatus(status, now = new Date()) {
  if (!status?.configured) return 'Sin turno asignado';
  if (status.active) {
    const end = status.windowEnd
      ? status.windowEnd.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false })
      : status.end;
    return `En turno · hasta las ${end}`;
  }
  if (status.nextStart) return `Fuera de turno · vuelve ${formatShiftMoment(status.nextStart, now)}`;
  return 'Fuera de turno';
}
