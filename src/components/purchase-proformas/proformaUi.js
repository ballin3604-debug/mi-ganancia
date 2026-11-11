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

function initialCostInput(supplierPrice, factor) {
  const unitCost = Number(supplierPrice || 0);
  if (!(unitCost > 0)) return '';
  return String(roundMoney(unitCost * (factor > 1 ? factor : 1)));
}

export function createProformaItemFromProduct(product) {
  const options = buildPresentationOptions(product);
  const option = chooseDefaultPresentation(options, product?.packageSize);
  return {
    key: newProformaItemKey(),
    productId: product.id,
    productName: product.name,
    productBrand: product.brand || '',
    category: product.category || 'Otros',
    barcode: product.barcode || '',
    isNewProduct: false,
    newProduct: null,
    presentationOptions: options,
    presentationKey: option.key,
    presentationName: option.name,
    factor: option.factor,
    packCount: '1',
    looseUnits: '',
    costMode: option.factor > 1 ? 'package' : 'unit',
    costInput: initialCostInput(product.supplierPrice, option.factor),
    salePrice: String(product.price || ''),
    lotCode: '',
    expiryDate: '',
  };
}

export function createProformaItemFromNewProduct(newProduct, preferredFactor = 0) {
  const options = buildPresentationOptions({ presentations: newProduct?.presentations });
  const option = chooseDefaultPresentation(options, preferredFactor);
  return {
    key: newProformaItemKey(),
    productId: null,
    productName: newProduct.name,
    productBrand: newProduct.brand || '',
    category: newProduct.category || 'Otros',
    barcode: newProduct.barcode || '',
    isNewProduct: true,
    newProduct,
    presentationOptions: options,
    presentationKey: option.key,
    presentationName: option.name,
    factor: option.factor,
    packCount: '1',
    looseUnits: '',
    costMode: option.factor > 1 ? 'package' : 'unit',
    costInput: '',
    salePrice: String(newProduct.price || ''),
    lotCode: '',
    expiryDate: '',
  };
}
