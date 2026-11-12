import { roundMoney } from '../../services/purchaseProformas';

let itemCounter = 0;

export function newProformaItemKey() {
  itemCounter += 1;
  return `pf-item-${Date.now()}-${itemCounter}`;
}

export function buildPresentationOptions({ presentations = [], packageSize = null, packLabel = '' } = {}) {
  const options = [{ key: 'unit', name: 'Unidad', factor: 1 }];

  (Array.isArray(presentations) ? presentations : []).forEach((presentation, index) => {
    const factor = Number(presentation?.factor || 0);
    const name = String(presentation?.name || '').trim();
    if (!name || !Number.isFinite(factor) || factor <= 1) return;
    const key = String(presentation.id || `presentation-${index + 1}`);
    if (options.some((option) => option.key === key)) return;
    options.push({ key, name, factor });
  });

  const legacyFactor = Number(packageSize || 0);
  if (legacyFactor > 1 && !options.some((option) => option.factor === legacyFactor)) {
    options.push({
      key: 'legacy',
      name: String(packLabel || '').trim() || 'Paquete',
      factor: legacyFactor,
    });
  }

  options.push({ key: 'custom', name: 'Otra presentación', factor: '' });
  return options;
}

export function chooseDefaultPresentation(options, preferredFactor = 0) {
  const valid = (options || []).filter((option) => option.key !== 'custom');
  if (!valid.length) return { key: 'unit', name: 'Unidad', factor: 1 };
  const preferred = Number(preferredFactor || 0);
  if (preferred > 1) {
    const match = valid.find((option) => option.factor === preferred);
    if (match) return match;
  }
  return valid.find((option) => option.factor === 1) || valid[0];
}

export function getProformaPresentationLabel(item) {
  const name = String(item?.presentationName || '').trim();
  if (name) return name;
  const factor = Number(item?.factor || 0);
  return factor > 1 ? `Paquete x${factor}` : 'Unidad';
}

export function resolvePurchasePresentation(product) {
  const options = buildPresentationOptions(product);
  const valid = options.filter((option) => option.key !== 'custom');
  const preferred = Number(product?.packageSize || 0);
  if (preferred > 1) {
    const match = valid.find((option) => option.factor === preferred);
    if (match) return match;
  }
  const packaged = valid
    .filter((option) => option.factor > 1)
    .sort((a, b) => b.factor - a.factor);
  return packaged[0] || valid.find((option) => option.factor === 1) || { key: 'unit', name: 'Unidad', factor: 1 };
}

function initialPackagePrice(supplierPrice, factor) {
  const unitCost = Number(supplierPrice || 0);
  if (!(unitCost > 0)) return '';
  return String(roundMoney(unitCost * (factor > 1 ? factor : 1)));
}

function purchasePriceForProduct(product, factor) {
  const lastPrice = Number(product?.lastPurchasePackagePrice || 0);
  if (factor > 1 && lastPrice > 0) return String(roundMoney(lastPrice));
  return initialPackagePrice(product?.supplierPrice, factor);
}

export function createProformaItemFromProduct(product) {
  const option = resolvePurchasePresentation(product);
  const factor = Number(option.factor || 1);
  return {
    key: newProformaItemKey(),
    productId: product.id,
    productName: product.name,
    productBrand: product.brand || '',
    category: product.category || 'Otros',
    barcode: product.barcode || '',
    description: product.description || '',
    isNewProduct: false,
    newProduct: null,
    presentationOptions: buildPresentationOptions(product),
    presentationKey: option.key,
    presentationName: option.name,
    factor,
    packageQty: '1',
    packagePrice: purchasePriceForProduct(product, factor),
    salePrice: String(product.price || ''),
    lotCode: '',
    expiryDate: '',
    noExpiry: false,
  };
}

export function createProformaItemFromNewProduct(newProduct, preferredFactor = 0) {
  const options = buildPresentationOptions({ presentations: newProduct?.presentations });
  const option = chooseDefaultPresentation(options, preferredFactor);
  const factor = Number(option.factor || 1);
  return {
    key: newProformaItemKey(),
    productId: null,
    productName: newProduct.name,
    productBrand: newProduct.brand || '',
    category: newProduct.category || 'Otros',
    barcode: newProduct.barcode || '',
    description: '',
    isNewProduct: true,
    newProduct,
    presentationOptions: options,
    presentationKey: option.key,
    presentationName: option.name,
    factor,
    packageQty: '1',
    packagePrice: '',
    salePrice: String(newProduct.price || ''),
    lotCode: '',
    expiryDate: '',
    noExpiry: false,
  };
}
