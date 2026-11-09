import { describe, expect, it } from 'vitest';
import { DEFAULT_EXPIRY_WARNING_DAYS, getExpiryWarningDays } from './expiry';

describe('getExpiryWarningDays', () => {
  it('usa el plazo configurado por rubro', () => {
    expect(getExpiryWarningDays({ expiryWarningDays: 90 })).toBe(90);
  });

  it('cae a 30 días cuando el rubro no define el plazo', () => {
    expect(getExpiryWarningDays(null)).toBe(DEFAULT_EXPIRY_WARNING_DAYS);
    expect(getExpiryWarningDays({})).toBe(DEFAULT_EXPIRY_WARNING_DAYS);
    expect(getExpiryWarningDays({ expiryWarningDays: 0 })).toBe(DEFAULT_EXPIRY_WARNING_DAYS);
    expect(getExpiryWarningDays({ expiryWarningDays: '90' })).toBe(90);
  });
});
