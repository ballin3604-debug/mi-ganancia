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
});
