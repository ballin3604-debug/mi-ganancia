import { describe, expect, it } from 'vitest';
import { buildProductUpdateData } from './products';
import { getDefaultCategories } from './categories';

const existing = { stock: 0, unit_label: 'Plato' };

function dish(extra = {}) {
  return buildProductUpdateData(existing, {
    name: 'Milanesa napolitana',
    price: 35,
    stock: 0,
    minStock: 0,
    isDish: true,
    expectedStock: 0,
    ...extra,
  }, '2026-10-28T00:00:00.000Z');
}

describe('disponibilidad de platos', () => {
  it('guarda is_available=false cuando el plato está agotado', () => {
    const data = dish({ isAvailable: false });
    expect(data.is_dish).toBe(true);
    expect(data.is_available).toBe(false);
    expect(data.stock).toBe(0);
  });

  it('guarda is_available=true cuando el plato vuelve a estar disponible', () => {
    const data = dish({ isAvailable: true });
    expect(data.is_available).toBe(true);
  });

  it('no toca is_available si el llamador no lo envía', () => {
    const data = dish();
    expect(data).not.toHaveProperty('is_available');
  });
});

describe('categorías por rubro', () => {
  it('restaurante arranca con categorías gastronómicas', () => {
    const cats = getDefaultCategories('restaurante');
    expect(cats).toContain('Platos');
    expect(cats).toContain('Bebidas');
    expect(cats).toContain('Postres');
  });

  it('comercio conserva sus categorías de siempre', () => {
    const cats = getDefaultCategories('tienda');
    expect(cats).toContain('Lácteos');
    expect(cats).not.toContain('Platos');
  });
});
