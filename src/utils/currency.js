/**
 * Formatea un monto en bolivianos con separador de miles.
 * Ej: 5107021.5 → "Bs 5,107,021.50"
 */
export function formatBs(amount) {
  const value = Number(amount || 0);
  const safe = Number.isFinite(value) ? value : 0;
  return `Bs ${safe.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Versión compacta, sin decimales, para espacios reducidos (ejes, chips, leyendas).
 * Ej: 5107021.5 → "5,107,022"
 */
export function formatBsShort(amount) {
  const value = Number(amount || 0);
  const safe = Number.isFinite(value) ? value : 0;
  return Math.round(safe).toLocaleString('en-US');
}
