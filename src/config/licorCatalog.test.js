import { describe, expect, it } from 'vitest';
import {
  buildLicorPresentations,
  getLicorPurchaseFactorFromProduct,
} from './licorCatalog';
import { getSellOptions } from '../utils/presentations';

describe('catálogo de licorería', () => {
  it('convierte el costo de la caja de cervezas a costo por unidad', () => {
    const built = buildLicorPresentations({
      category: 'Cervezas',
      price: '8',
      licorPrices: { chipa: '90', cajaFria: '170' },
      licorFactors: { chipa: '12', cajaFria: '24' },
      supplierPrice: '144',
    });

    expect(built.purchaseFactor).toBe(24);
    expect(built.purchaseCost).toBe(144);
    expect(built.presentations).toEqual([
      { id: 'licor-unidad', name: 'Unidad', factor: 1, price: 8, isBase: true },
      { id: 'licor-chipa', name: 'Chipa', factor: 12, price: 90, isBase: false },
      { id: 'licor-cajaFria', name: 'Caja fría', factor: 24, price: 170, isBase: false },
    ]);
    expect(getSellOptions({ id: 'p1', price: 8, presentations: built.presentations })).toHaveLength(3);
  });

  it('usa el factor de la caja fría al editar aunque la caja caliente tenga otro factor', () => {
    const presentations = [
      { id: 'licor-unidad', name: 'Unidad', factor: 1, price: 20, isBase: true },
      { id: 'licor-cajaCaliente', name: 'Caja caliente', factor: 12, price: 200, isBase: false },
      { id: 'licor-cajaFria', name: 'Caja fría', factor: 6, price: 110, isBase: false },
    ];
    const factor = getLicorPurchaseFactorFromProduct(
      { category: 'Vinos y tragos', packageSize: '6', presentations },
      'Vinos y tragos'
    );
    expect(factor).toBe(6);
  });

  it('crea una presentación de compra que no se ofrece en venta', () => {
    const built = buildLicorPresentations({
      category: 'Cigarros',
      price: '10',
      licorPrices: { paquete: '80' },
      licorFactors: { paquete: '10' },
      supplierPrice: '900',
      licorPurchaseFactor: '100',
    });

    const options = getSellOptions({ id: 'p2', price: 10, presentations: built.presentations });
    expect(options.map((option) => option.label)).toEqual(['Unidad', 'Paquete']);
    expect(built.presentations).toContainEqual({
      id: 'licor-compra',
      name: 'Caja',
      factor: 100,
      price: 0,
      isBase: false,
      purchaseOnly: true,
    });
    expect(getLicorPurchaseFactorFromProduct(
      { category: 'Cigarros', packageSize: '100', presentations: built.presentations },
      'Cigarros'
    )).toBe(100);
  });

  it('exige unidades por caja cuando hay costo de compra', () => {
    expect(() => buildLicorPresentations({
      category: 'Vinos y tragos',
      price: '20',
      licorPrices: {},
      licorFactors: {},
      supplierPrice: '60',
    })).toThrow('Indicá cuántas unidades trae la caja.');
  });

  it('permite cervezas con chipa y caja de otros tamaños y compra según la caja', () => {
    // Chipa de 6 y caja fría de 30: la compra por caja usa las 30 unidades.
    const built = buildLicorPresentations({
      category: 'Cervezas',
      price: '8',
      licorPrices: { chipa: '50', cajaFria: '205' },
      licorFactors: { chipa: '6', cajaFria: '30' },
      supplierPrice: '150',
    });

    expect(built.purchaseFactor).toBe(30);
    expect(built.purchaseCost).toBe(150);
    expect(built.unitPrice).toBe(8);
    expect(built.presentations).toContainEqual({
      id: 'licor-cajaFria',
      name: 'Caja fría',
      factor: 30,
      price: 205,
      isBase: false,
    });
  });

  it('prefiere el factor guardado del producto en vez de la caja fija de cervezas', () => {
    const presentations = [
      { id: 'licor-unidad', name: 'Unidad', factor: 1, price: 8, isBase: true },
      { id: 'licor-cajaFria', name: 'Caja fría', factor: 30, price: 205, isBase: false },
    ];
    // El dueño compró cajas de 30; debe respetarse al volver a editar.
    expect(getLicorPurchaseFactorFromProduct(
      { category: 'Cervezas', packageSize: '30', presentations },
      'Cervezas'
    )).toBe(30);
  });
});
