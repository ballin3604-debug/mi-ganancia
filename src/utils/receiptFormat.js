/**
 * Formato de impresión del recibo.
 *
 * Se guarda por dispositivo (localStorage) y no en los ajustes del negocio,
 * porque la impresora es del aparato: el celular del mostrador puede tener una
 * térmica de tickets mientras la compu de la trastienda imprime en hoja carta.
 *
 * La categoría del negocio define el formato por defecto. Así una agencia de
 * licorería imprime A4 desde el primer día, sin afectar a la licorería
 * minorista que ya tenía configurado su ticket térmico.
 */

const STORAGE_KEY = 'mg_receipt_format';
const CATEGORY_KEY = 'mg_receipt_format_category';

export const RECEIPT_FORMATS = {
  THERMAL: 'thermal',
  SHEET: 'sheet',
};

export const RECEIPT_FORMAT_LABELS = {
  [RECEIPT_FORMATS.THERMAL]: 'Ticket térmico (80mm)',
  [RECEIPT_FORMATS.SHEET]: 'Recibo en hoja (carta / A4)',
};

function normalizeFormat(format, fallback = RECEIPT_FORMATS.THERMAL) {
  if (format === RECEIPT_FORMATS.SHEET) return RECEIPT_FORMATS.SHEET;
  if (format === RECEIPT_FORMATS.THERMAL) return RECEIPT_FORMATS.THERMAL;
  return fallback === RECEIPT_FORMATS.SHEET ? RECEIPT_FORMATS.SHEET : RECEIPT_FORMATS.THERMAL;
}

export function getReceiptFormat(defaultFormat = RECEIPT_FORMATS.THERMAL, category = '') {
  const fallback = normalizeFormat(defaultFormat);
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const savedCategory = localStorage.getItem(CATEGORY_KEY);
    // Si el formato guardado pertenece a otro rubro, se usa el default del
    // rubro actual. Las preferencias viejas (sin categoría) se respetan salvo
    // que el rubro nuevo pida hoja A4: una agencia recién cambiada no debería
    // seguir imprimiendo tickets por una preferencia térmica anterior.
    if (category && savedCategory && savedCategory !== category) return fallback;
    if (category && !savedCategory && fallback === RECEIPT_FORMATS.SHEET) return fallback;
    if (saved === RECEIPT_FORMATS.SHEET || saved === RECEIPT_FORMATS.THERMAL) {
      return saved;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export function setReceiptFormat(format, category = '') {
  try {
    const value = normalizeFormat(format);
    localStorage.setItem(STORAGE_KEY, value);
    if (category) localStorage.setItem(CATEGORY_KEY, category);
  } catch {
    // Modo privado o almacenamiento lleno: se sigue usando el formato por defecto.
  }
}
