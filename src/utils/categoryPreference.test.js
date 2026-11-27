import { beforeEach, describe, expect, it } from 'vitest';
import { readCategoryFilter, saveCategoryFilter } from './categoryPreference';

describe('preferencia de categoría', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('devuelve el valor por defecto sin negocio', () => {
    expect(readCategoryFilter('inventory', null, 'u1')).toBe('Todas');
  });

  it('guarda y recupera la categoría por negocio y usuario', () => {
    saveCategoryFilter('inventory', 'b1', 'u1', 'Cervezas');
    expect(readCategoryFilter('inventory', 'b1', 'u1')).toBe('Cervezas');
    expect(readCategoryFilter('inventory', 'b1', 'u2')).toBe('Todas');
    expect(readCategoryFilter('inventory', 'b2', 'u1')).toBe('Todas');
  });

  it('separa las preferencias de inventario y ventas', () => {
    saveCategoryFilter('inventory', 'b1', 'u1', 'Cervezas');
    saveCategoryFilter('sales', 'b1', 'u1', 'Sodas');
    expect(readCategoryFilter('inventory', 'b1', 'u1')).toBe('Cervezas');
    expect(readCategoryFilter('sales', 'b1', 'u1')).toBe('Sodas');
  });

  it('ignora valores vacíos al guardar', () => {
    saveCategoryFilter('sales', 'b1', 'u1', 'Sodas');
    saveCategoryFilter('sales', 'b1', 'u1', '');
    expect(readCategoryFilter('sales', 'b1', 'u1')).toBe('Sodas');
  });
});
