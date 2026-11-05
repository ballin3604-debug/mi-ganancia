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

// Precios de compra: solo bolivianos enteros. Si pegan "145.92" se redondea
// a 146; mientras se escribe, el punto/coma queda bloqueado por teclado.
export function clampIntegerInput(value, { min = 0, max = Infinity } = {}) {
  if (value === '') return '';
  const n = Number(String(value).replace(',', '.'));
  if (Number.isNaN(n)) return '';
  const rounded = Math.round(n);
  if (rounded < min) return String(min);
  if (rounded > max) return String(max);
  return String(rounded);
}

// Bloquea teclas que un <input type="number"> deja pasar pero que rompen la
// validación numérica normal: 'e'/'E' (notación científica — "1e10" da
// 10 mil millones con una sola tecla), y opcionalmente '-' para campos que
// nunca deberían ser negativos.
export function blockInvalidNumberKeys(e, { allowNegative = false, allowDecimal = true } = {}) {
  const blocked = ['e', 'E'];
  if (!allowNegative) blocked.push('-');
  if (!allowDecimal) blocked.push('.', ',');
  if (blocked.includes(e.key)) e.preventDefault();
}
