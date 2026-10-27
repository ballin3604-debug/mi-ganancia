import { describe, expect, it } from 'vitest';
import {
  calculateBaseQuantity,
  calculatePurchaseBaseQuantity,
  ensureBasePresentation,
  getSellOptions,
  validatePresentationDefinitions,
  validateSellSelection,
} from './presentations';

const configuredProduct = {
  id: 'product-1',
  name: 'Bebida de prueba',
  price: 12,
  presentations: [
    { id: 'bottle', name: 'Botella', factor: 1, price: 12, isBase: true },
    { id: 'six', name: 'Six-pack', factor: 6, price: 65, isBase: false },
    { id: 'case', name: 'Caja', factor: 24, price: 240, isBase: false },
  ],
};

describe('presentaciones configurables', () => {
  it('ofrece la unidad base y presentaciones con factor y precio propios', () => {
    const options = getSellOptions(configuredProduct);
    expect(options.map((option) => [option.label, option.factor, option.price])).toEqual([
      ['Botella', 1, 12],
      ['Six-pack', 6, 65],
      ['Caja', 24, 240],
    ]);
  });

  it('descuenta una unidad base por botella y doce por dos six-packs', () => {
    expect(calculateBaseQuantity(1, 1)).toBe(1);
    expect(calculateBaseQuantity(2, 6)).toBe(12);
    expect(calculateBaseQuantity(1, 24)).toBe(24);
  });

  it('convierte paquetes de compra a unidades base', () => {
    expect(calculatePurchaseBaseQuantity(10, 12)).toBe(120);
  });

  it('completa una base para formularios abiertos automáticamente y rescata borradores legacy', () => {
    const newForm = ensureBasePresentation({ price: '12', presentations: [] }, 'Botella');
    expect(newForm.presentations).toEqual([
      { id: 'base-unit', name: 'Botella', factor: 1, price: '12', isBase: true },
    ]);

    const legacyDraft = ensureBasePresentation({
      unitLabel: 'Lata',
      price: '10',
      sellPack: true,
      packLabel: 'Caja',
      packageSize: '6',
      packPrice: '55',
      packPriceHot: '58',
      presentations: [],
    });
    expect(legacyDraft.presentations.map((presentation) => [presentation.name, presentation.factor, presentation.price])).toEqual([
      ['Lata', 1, '10'],
      ['Caja fría', 6, 55],
      ['Caja caliente', 6, 58],
    ]);
  });

  it('conserva las opciones de productos antiguos sin configuración', () => {
    const oldProduct = {
      id: 'legacy-1',
      price: 10,
      unitLabel: 'Botella',
      packageSize: 6,
      packLabel: 'Six-pack',
      packPrice: 55,
    };
    const options = getSellOptions(oldProduct);
    expect(options).toHaveLength(2);
    expect(options[0].factor).toBe(1);
    expect(options[1].factor).toBe(6);
    expect(options[1].price).toBe(55);
  });

  it('rechaza factores no positivos, no finitos, nombres duplicados y bases inconsistentes', () => {
    const base = { id: 'base', name: 'Botella', factor: 1, price: 12, isBase: true };
    expect(() => validatePresentationDefinitions([base, { id: 'pack', name: 'Caja', factor: 0, price: 20 }], { baseName: 'Botella', basePrice: 12 })).toThrow(/factor/i);
    expect(() => validatePresentationDefinitions([base, { id: 'pack', name: 'Caja', factor: -2, price: 20 }], { baseName: 'Botella', basePrice: 12 })).toThrow(/factor/i);
    expect(() => validatePresentationDefinitions([base, { id: 'pack', name: 'Caja', factor: Number.NaN, price: 20 }], { baseName: 'Botella', basePrice: 12 })).toThrow(/factor/i);
    expect(() => validatePresentationDefinitions([base, { id: 'pack', name: 'Botella', factor: 6, price: 65 }], { baseName: 'Botella', basePrice: 12 })).toThrow(/repetida/i);
    expect(() => validatePresentationDefinitions([{ ...base, factor: 2 }], { baseName: 'Botella', basePrice: 12 })).toThrow(/factor 1/i);
  });

  it('rechaza cantidad, factor y precio que no correspondan con la presentación elegida', () => {
    const option = getSellOptions(configuredProduct)[1];
    const item = {
      quantity: 2,
      factor: option.factor,
      unitPrice: option.price,
      presLabel: 'Six-pack x6',
      presentationId: option.presentationId,
      presId: option.presId,
      variant: option.variant,
    };
    expect(() => validateSellSelection(configuredProduct, { ...item, quantity: 0 })).toThrow(/cantidad/i);
    expect(() => validateSellSelection(configuredProduct, { ...item, factor: -1 })).toThrow(/factor/i);
    expect(() => validateSellSelection(configuredProduct, { ...item, unitPrice: 1 })).toThrow(/no coincide/i);
  });
});
