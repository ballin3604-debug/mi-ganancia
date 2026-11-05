import { describe, expect, it } from 'vitest';
import { clampIntegerInput } from './numberInput';

describe('clampIntegerInput', () => {
  it('redondea valores con decimales a bolivianos enteros', () => {
    expect(clampIntegerInput('145.92')).toBe('146');
    expect(clampIntegerInput('145,4')).toBe('145');
    expect(clampIntegerInput('6.08')).toBe('6');
  });

  it('respeta los límites y los campos vacíos', () => {
    expect(clampIntegerInput('')).toBe('');
    expect(clampIntegerInput('9999999', { max: 999999 })).toBe('999999');
    expect(clampIntegerInput('-5', { min: 0 })).toBe('0');
  });
});
