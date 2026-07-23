// Corta el valor al min/max dado. Se usa en el onChange de inputs numéricos
// controlados — el atributo HTML `max` por sí solo NO impide que el valor
// llegue al estado ni al servidor, solo lo marca ":invalid" visualmente.
export function clampNumberInput(value, { min = 0, max = Infinity } = {}) {
  if (value === '') return '';
  const n = Number(value);
  if (Number.isNaN(n)) return '';
  if (n < min) return String(min);
  if (n > max) return String(max);
  return value;
}

// Bloquea teclas que un <input type="number"> deja pasar pero que rompen la
// validación numérica normal: 'e'/'E' (notación científica — "1e10" da
// 10 mil millones con una sola tecla), y opcionalmente '-' para campos que
// nunca deberían ser negativos.
export function blockInvalidNumberKeys(e, { allowNegative = false } = {}) {
  const blocked = allowNegative ? ['e', 'E'] : ['e', 'E', '-'];
  if (blocked.includes(e.key)) e.preventDefault();
}
