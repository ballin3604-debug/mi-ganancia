/**
 * Formato de impresión del recibo.
 *
 * Se guarda por dispositivo (localStorage) y no en los ajustes del negocio,
 * porque la impresora es del aparato: el celular del mostrador puede tener una
 * térmica de tickets mientras la compu de la trastienda imprime en hoja carta.
 */

const STORAGE_KEY = 'mg_receipt_format';

export const RECEIPT_FORMATS = {
  THERMAL: 'thermal',
  SHEET: 'sheet',
};

export const RECEIPT_FORMAT_LABELS = {
  [RECEIPT_FORMATS.THERMAL]: 'Ticket térmico (80mm)',
  [RECEIPT_FORMATS.SHEET]: 'Recibo en hoja (carta / A4)',
};

export function getReceiptFormat() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === RECEIPT_FORMATS.SHEET ? RECEIPT_FORMATS.SHEET : RECEIPT_FORMATS.THERMAL;
  } catch {
    return RECEIPT_FORMATS.THERMAL;
  }
}

export function setReceiptFormat(format) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      format === RECEIPT_FORMATS.SHEET ? RECEIPT_FORMATS.SHEET : RECEIPT_FORMATS.THERMAL,
    );
  } catch {
    // Modo privado o almacenamiento lleno: se sigue usando el formato por defecto.
  }
}
