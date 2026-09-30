/**
 * Convierte un monto a letras en español, como se escribe en un recibo.
 * Ej: 294.5 → "Doscientos noventa y cuatro 50/100 Bolivianos"
 */

const UNIDADES = [
  '', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete',
  'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés',
  'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
];

const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];

const CENTENAS = [
  '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
  'seiscientos', 'setecientos', 'ochocientos', 'novecientos',
];

// 0..999
function tresCifras(n) {
  if (n === 0) return '';
  if (n === 100) return 'cien';

  const c = Math.floor(n / 100);
  const resto = n % 100;

  const parteCentena = CENTENAS[c];
  let parteResto = '';

  if (resto > 0) {
    if (resto < 30) {
      parteResto = UNIDADES[resto];
    } else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      parteResto = u > 0 ? `${DECENAS[d]} y ${UNIDADES[u]}` : DECENAS[d];
    }
  }

  return [parteCentena, parteResto].filter(Boolean).join(' ');
}

// "uno" pasa a "un" cuando acompaña a mil o millón ("veintiún mil")
function apocopar(texto) {
  return texto
    .replace(/veintiuno$/, 'veintiún')
    .replace(/\buno$/, 'un');
}

function enteroALetras(n) {
  if (n === 0) return 'cero';
  if (n < 0) return `menos ${enteroALetras(Math.abs(n))}`;

  const millones = Math.floor(n / 1000000);
  const miles = Math.floor((n % 1000000) / 1000);
  const resto = n % 1000;

  const partes = [];

  if (millones > 0) {
    partes.push(millones === 1 ? 'un millón' : `${apocopar(tresCifras(millones))} millones`);
  }
  if (miles > 0) {
    partes.push(miles === 1 ? 'mil' : `${apocopar(tresCifras(miles))} mil`);
  }
  if (resto > 0) {
    partes.push(tresCifras(resto));
  }

  return partes.join(' ');
}

/**
 * @param {number} amount monto en bolivianos
 * @param {string} moneda texto de la moneda ("Bolivianos" por defecto)
 * @returns {string} ej. "Doscientos noventa y cuatro 50/100 Bolivianos"
 */
export function amountToWords(amount, moneda = 'Bolivianos') {
  const value = Number(amount);
  const safe = Number.isFinite(value) ? Math.abs(value) : 0;

  const entero = Math.floor(safe);
  // Redondeo sobre el string para evitar sorpresas de coma flotante (0.145 → 14)
  const centavos = Math.round((safe - entero) * 100);

  // Si el redondeo de centavos llega a 100, sube al entero siguiente
  const enteroFinal = centavos === 100 ? entero + 1 : entero;
  const centavosFinal = centavos === 100 ? 0 : centavos;

  const letras = enteroALetras(enteroFinal);
  const conMayuscula = letras.charAt(0).toUpperCase() + letras.slice(1);

  return `${conMayuscula} ${String(centavosFinal).padStart(2, '0')}/100 ${moneda}`;
}
