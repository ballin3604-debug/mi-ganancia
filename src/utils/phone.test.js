import { describe, it, expect } from 'vitest';
import { normalizeBolivianPhone, formatPhoneDisplay } from './phone';

describe('normalizeBolivianPhone', () => {
  it('acepta un celular de 8 dígitos', () => {
    expect(normalizeBolivianPhone('70012345')).toBe('+59170012345');
    expect(normalizeBolivianPhone('61234567')).toBe('+59161234567');
  });

  it('acepta el prefijo del país y separadores', () => {
    expect(normalizeBolivianPhone('+591 700-12345')).toBe('+59170012345');
    expect(normalizeBolivianPhone('59170012345')).toBe('+59170012345');
  });

  it('quita el 0 inicial de larga distancia', () => {
    expect(normalizeBolivianPhone('070012345')).toBe('+59170012345');
  });

  it('rechaza números que no son celulares bolivianos', () => {
    expect(normalizeBolivianPhone('')).toBe('');
    expect(normalizeBolivianPhone('123')).toBe('');
    expect(normalizeBolivianPhone('20012345')).toBe('');
    expect(normalizeBolivianPhone('700123456')).toBe('');
  });
});

describe('formatPhoneDisplay', () => {
  it('muestra el número en formato legible', () => {
    expect(formatPhoneDisplay('+59170012345')).toBe('+591 70012345');
  });

  it('devuelve el texto original si no es válido', () => {
    expect(formatPhoneDisplay('abc')).toBe('abc');
  });
});
