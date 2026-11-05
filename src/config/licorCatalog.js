// Catálogo fijo de licorería: categorías, presentaciones de venta y
// unidad de compra por categoría. Es la única fuente para el formulario de
// inventario, la migración de categorías y los valores por defecto del rubro.

export const LICOR_CATEGORIES = [
  'Cervezas',
  'Vinos y tragos',
  'Cigarros',
  'Energizantes',
  'Peques sodas',
  'Sodas 2LTS',
  'Sodas 3LTS',
  'Snacks',
  'Abarrotes',
];

const UNIT_PRESENTATION = {
  key: 'unidad',
  name: 'Unidad',
  factor: 1,
  fixedFactor: true,
};

export const LICOR_CATALOG = {
  Cervezas: {
    emoji: '🍺',
    sell: [
      UNIT_PRESENTATION,
      { key: 'chipa', name: 'Chipa', factor: 12, fixedFactor: true },
      { key: 'cajaCaliente', name: 'Caja caliente', factor: 24, fixedFactor: true },
      { key: 'cajaFria', name: 'Caja fría', factor: 24, fixedFactor: true },
    ],
    purchase: { unit: 'caja', label: 'Caja', factorFrom: ['cajaFria', 'cajaCaliente'], fixedFactor: 24 },
  },
  'Vinos y tragos': {
    emoji: '🍷',
    sell: [
      UNIT_PRESENTATION,
      { key: 'cajaCaliente', name: 'Caja caliente', factor: '', fixedFactor: false },
      { key: 'cajaFria', name: 'Caja fría', factor: '', fixedFactor: false },
    ],
    purchase: { unit: 'caja', label: 'Caja', factorFrom: ['cajaFria', 'cajaCaliente'] },
  },
  Cigarros: {
    emoji: '🚬',
    sell: [
      UNIT_PRESENTATION,
      { key: 'paquete', name: 'Paquete', factor: '', fixedFactor: false },
    ],
    purchase: { unit: 'caja', label: 'Caja', askFactor: true },
  },
  Energizantes: {
    emoji: '⚡',
    sell: [
      UNIT_PRESENTATION,
      { key: 'paquete', name: 'Paquete', factor: '', fixedFactor: false },
    ],
    purchase: { unit: 'paquete', label: 'Paquete', factorFrom: ['paquete'] },
  },
  'Peques sodas': {
    emoji: '🥤',
    sell: [
      UNIT_PRESENTATION,
      { key: 'paquete', name: 'Paquete', factor: '', fixedFactor: false },
    ],
    purchase: { unit: 'paquete', label: 'Paquete', factorFrom: ['paquete'] },
  },
  'Sodas 2LTS': {
    emoji: '🥤',
    sell: [
      UNIT_PRESENTATION,
      { key: 'paquete', name: 'Paquete', factor: '', fixedFactor: false },
    ],
    purchase: { unit: 'paquete', label: 'Paquete', factorFrom: ['paquete'] },
  },
  'Sodas 3LTS': {
    emoji: '🧃',
    sell: [
      UNIT_PRESENTATION,
      { key: 'paquete', name: 'Paquete', factor: '', fixedFactor: false },
    ],
    purchase: { unit: 'paquete', label: 'Paquete', factorFrom: ['paquete'] },
  },
  Snacks: {
    emoji: '🍿',
    sell: [
      UNIT_PRESENTATION,
      { key: 'paquete', name: 'Paquete', factor: '', fixedFactor: false },
    ],
    purchase: { unit: 'paquete', label: 'Paquete', factorFrom: ['paquete'] },
  },
  Abarrotes: {
    emoji: '🛒',
    sell: [UNIT_PRESENTATION],
    purchase: { unit: 'caja_o_paquete', label: 'Caja o paquete', askFactor: true, askUnit: true },
  },
};

export function isLicorCategory(category) {
  return LICOR_CATEGORIES.includes(category);
}

export function getLicorCategoryConfig(category) {
  return LICOR_CATALOG[category] || LICOR_CATALOG.Cervezas;
}

export function normalizeLicorCategory(category) {
  if (isLicorCategory(category)) return category;
  const value = String(category || '').trim().toLowerCase();
  if (value.includes('cerveza')) return 'Cervezas';
  if (['whiskey', 'ron', 'vino', 'vodka', 'trago', 'licor'].some((word) => value.includes(word))) {
    return 'Vinos y tragos';
  }
  if (value.includes('cigarro') || value.includes('tabaco')) return 'Cigarros';
  if (value.includes('energiz')) return 'Energizantes';
  if (value.includes('snack') || value.includes('galleta') || value.includes('dulce')) return 'Snacks';
  if (value.includes('3lt') || value.includes('3 l')) return 'Sodas 3LTS';
  if (value.includes('2lt') || value.includes('2 l')) return 'Sodas 2LTS';
  if (value.includes('soda') || value.includes('refresco') || value.includes('peque')) return 'Peques sodas';
  return 'Abarrotes';
}

export function getLicorSellPresets(category) {
  return getLicorCategoryConfig(category).sell;
}

export function getLicorPurchaseLabel(category, purchaseUnit) {
  const config = getLicorCategoryConfig(category);
  if (config.purchase.askUnit) return purchaseUnit === 'paquete' ? 'Paquete' : 'Caja';
  return config.purchase.label;
}

export function getLicorPurchaseFactorFromForm(form, category) {
  const config = getLicorCategoryConfig(category);
  if (config.purchase.fixedFactor) return Number(config.purchase.fixedFactor);
  const explicit = Number(form?.licorPurchaseFactor || 0);
  if (Number.isFinite(explicit) && explicit > 1) return explicit;
  const factors = form?.licorFactors || {};
  for (const key of config.purchase.factorFrom || []) {
    const value = Number(factors[key] || 0);
    if (value > 1) return value;
  }
  return 0;
}

export function getLicorPurchaseFactorFromProduct(product, category) {
  const config = getLicorCategoryConfig(category);
  const presentations = Array.isArray(product?.presentations) ? product.presentations : [];
  const purchaseOnly = presentations.find((presentation) => presentation?.purchaseOnly && Number(presentation.factor) > 1);
  if (purchaseOnly) return Number(purchaseOnly.factor);

  // En cervezas la compra siempre es por caja cerrada (24), aunque también
  // exista una presentación de venta "Caja caliente" con otro factor.
  if (config.purchase.fixedFactor) return Number(config.purchase.fixedFactor);

  // Al guardar desde licorería packageSize guarda el factor de compra real
  // (caja o paquete). Preferirlo evita confundir, por ejemplo, la caja fría
  // con la caja caliente cuando tienen factores distintos.
  const storedFactor = Number(product?.packageSize || 0);
  if (storedFactor > 1) return storedFactor;

  const label = getLicorPurchaseLabel(category, product?.licorPurchaseUnit);
  const matchingSale = presentations.find((presentation) => (
    !presentation?.purchaseOnly
    && Number(presentation?.factor) > 1
    && String(presentation?.name || '').trim().toLowerCase().startsWith(label.toLowerCase())
  ));
  if (matchingSale) return Number(matchingSale.factor);

  return 0;
}

export function buildLicorPresentations(form, extraPresentations = []) {
  const category = normalizeLicorCategory(form?.category);
  const config = getLicorCategoryConfig(category);
  const unitPrice = Number(form?.price || 0);
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    throw new Error('Ingresá el precio de venta de la unidad.');
  }

  const prices = form?.licorPrices || {};
  const factors = form?.licorFactors || {};
  const presentations = [{
    id: 'licor-unidad',
    name: 'Unidad',
    factor: 1,
    price: unitPrice,
    isBase: true,
  }];

  for (const preset of config.sell) {
    if (preset.key === 'unidad') continue;
    const price = Number(prices[preset.key] || 0);
    if (!Number.isFinite(price) || price <= 0) continue;
    const factor = Number(factors[preset.key] || preset.factor || 0);
    if (!Number.isFinite(factor) || factor <= 1) {
      throw new Error(`Indicá cuántas unidades trae ${preset.name}.`);
    }
    presentations.push({
      id: `licor-${preset.key}`,
      name: preset.name,
      factor,
      price,
      isBase: false,
    });
  }

  const purchaseFactor = getLicorPurchaseFactorFromForm(form, category);
  const purchaseLabel = getLicorPurchaseLabel(category, form?.licorPurchaseUnit);
  const purchaseCost = Number(form?.supplierPrice || 0);
  if (purchaseCost > 0) {
    if (!Number.isFinite(purchaseFactor) || purchaseFactor <= 1) {
      throw new Error(`Indicá cuántas unidades trae la ${purchaseLabel.toLowerCase()}.`);
    }
    const alreadyPresent = presentations.some((presentation) => (
      presentation.factor === purchaseFactor
      && presentation.name.toLowerCase().startsWith(purchaseLabel.toLowerCase())
    ));
    if (!alreadyPresent) {
      presentations.push({
        id: 'licor-compra',
        name: purchaseLabel,
        factor: purchaseFactor,
        price: 0,
        isBase: false,
        purchaseOnly: true,
      });
    }
  }

  const knownNames = new Set(presentations.map((presentation) => presentation.name.toLowerCase()));
  for (const extra of extraPresentations || []) {
    const name = String(extra?.name || '').trim();
    const price = Number(extra?.price || 0);
    const factor = Number(extra?.factor || 0);
    if (!name || knownNames.has(name.toLowerCase()) || price <= 0 || factor <= 0) continue;
    presentations.push({ ...extra, name, price, factor });
    knownNames.add(name.toLowerCase());
  }

  return { presentations, purchaseFactor, purchaseCost, unitPrice };
}
