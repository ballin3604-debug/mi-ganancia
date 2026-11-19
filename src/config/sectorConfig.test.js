import { describe, expect, it } from 'vitest';
import { getSectorConfig } from './sectorConfig';

describe('getSectorConfig', () => {
  it('mantiene el stock visible por defecto en restaurantes', () => {
    const config = getSectorConfig('restaurante');
    expect(config.features.dishes).toBe(true);
    expect(config.features.stock).toBe(true);
  });

  it('permite que el dueño oculte el stock con un override', () => {
    const config = getSectorConfig('restaurante', { features: { stock: false } });
    expect(config.features.dishes).toBe(true);
    expect(config.features.stock).toBe(false);
  });

  it('mantiene el escáner activo por defecto', () => {
    const config = getSectorConfig('tienda');
    expect(config.features.scanner).toBe(true);
  });

  it('permite que el dueño desactive el escáner con un override', () => {
    const config = getSectorConfig('tienda', { features: { scanner: false } });
    expect(config.features.scanner).toBe(false);
  });

  it('avisa los vencimientos con 3 meses de anticipación en licorerías', () => {
    expect(getSectorConfig('licorera').expiryWarningDays).toBe(90);
  });

  it('mantiene el aviso de 30 días en los demás rubros', () => {
    expect(getSectorConfig('tienda').expiryWarningDays).toBe(30);
    expect(getSectorConfig('restaurante').expiryWarningDays).toBe(30);
  });

  it('la agencia de licorería hereda el catálogo y las presentaciones de licorería', () => {
    const agencia = getSectorConfig('agencia_licoreria');
    const licorera = getSectorConfig('licorera');
    expect(agencia.features.configurablePresentations).toBe(true);
    expect(agencia.expiryWarningDays).toBe(90);
    expect(agencia.unitLabels).toEqual(licorera.unitLabels);
  });

  it('la agencia habilita clientes, cuentas por cobrar y recibo A4', () => {
    const agencia = getSectorConfig('agencia_licoreria');
    expect(agencia.features.wholesale).toBe(true);
    expect(agencia.features.customers).toBe(true);
    expect(agencia.features.receivables).toBe(true);
    expect(agencia.defaultReceiptFormat).toBe('sheet');
  });

  it('la licorería minorista no recibe funciones mayoristas', () => {
    const licorera = getSectorConfig('licorera');
    expect(licorera.features.receivables).toBeFalsy();
    expect(licorera.features.customers).toBeFalsy();
    expect(licorera.defaultReceiptFormat).toBeUndefined();
  });

  it('los overrides del dueño no apagan las funciones base de la agencia', () => {
    const agencia = getSectorConfig('agencia_licoreria', { features: { stock: false } });
    expect(agencia.features.stock).toBe(false);
    expect(agencia.features.receivables).toBe(true);
  });
});
