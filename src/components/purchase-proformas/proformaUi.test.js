import { describe, it, expect } from 'vitest';
import {
  createProformaItemFromProduct,
  getProformaItemCurrentPackagePrice,
} from './proformaUi';

describe('precio de compra actual en la proforma', () => {
  it('precarga el precio actual del producto y no el último precio de compra', () => {
    const item = createProformaItemFromProduct({
      id: 'producto-1',
      name: 'Super papitas clásicas',
      price: 5,
      supplierPrice: 1.92,
      packageSize: 12,
      lastPurchasePackagePrice: 23.04,
      lastPurchasePackageFactor: 12,
      presentations: [],
    });

    expect(item.factor).toBe(12);
    expect(item.packagePrice).toBe('23');
    expect(item.currentUnitCost).toBe(1.92);
    expect(getProformaItemCurrentPackagePrice(item)).toBe(23);
  });

  it('recalcula el precio actual al cambiar las unidades por caja', () => {
    const item = createProformaItemFromProduct({
      id: 'producto-2',
      name: 'Coca-Cola',
      price: 10,
      supplierPrice: 1.92,
      packageSize: 12,
      presentations: [],
    });

    expect(getProformaItemCurrentPackagePrice({ ...item, factor: 6 })).toBe(12);
  });

  it('usa el último precio de compra solo si el producto no tiene costo actual', () => {
    const item = createProformaItemFromProduct({
      id: 'producto-3',
      name: 'Sin costo',
      price: 10,
      supplierPrice: 0,
      lastPurchasePackagePrice: 100,
      lastPurchasePackageFactor: 12,
      packageSize: 12,
      presentations: [],
    });

    expect(item.packagePrice).toBe('100');
    expect(getProformaItemCurrentPackagePrice(item)).toBe(100);
  });
});
