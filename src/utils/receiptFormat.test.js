import { beforeEach, describe, expect, it } from 'vitest';
import { getReceiptFormat, setReceiptFormat, RECEIPT_FORMATS } from './receiptFormat';

describe('formato del recibo', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('usa hoja A4 por defecto cuando el rubro lo pide', () => {
    expect(getReceiptFormat(RECEIPT_FORMATS.SHEET, 'agencia_licoreria')).toBe(RECEIPT_FORMATS.SHEET);
  });

  it('mantiene el ticket térmico por defecto en los demás rubros', () => {
    expect(getReceiptFormat(RECEIPT_FORMATS.THERMAL, 'licorera')).toBe(RECEIPT_FORMATS.THERMAL);
  });

  it('respeta la preferencia guardada del mismo rubro', () => {
    setReceiptFormat(RECEIPT_FORMATS.THERMAL, 'agencia_licoreria');
    expect(getReceiptFormat(RECEIPT_FORMATS.SHEET, 'agencia_licoreria')).toBe(RECEIPT_FORMATS.THERMAL);
  });

  it('ignora una preferencia vieja de otro rubro', () => {
    setReceiptFormat(RECEIPT_FORMATS.THERMAL, 'tienda');
    expect(getReceiptFormat(RECEIPT_FORMATS.SHEET, 'agencia_licoreria')).toBe(RECEIPT_FORMATS.SHEET);
  });

  it('una preferencia vieja sin rubro no bloquea el A4 de la agencia', () => {
    localStorage.setItem('mg_receipt_format', RECEIPT_FORMATS.THERMAL);
    expect(getReceiptFormat(RECEIPT_FORMATS.SHEET, 'agencia_licoreria')).toBe(RECEIPT_FORMATS.SHEET);
  });

  it('conserva la preferencia vieja sin rubro en una licorería minorista', () => {
    localStorage.setItem('mg_receipt_format', RECEIPT_FORMATS.SHEET);
    expect(getReceiptFormat(RECEIPT_FORMATS.THERMAL, 'licorera')).toBe(RECEIPT_FORMATS.SHEET);
  });
});
