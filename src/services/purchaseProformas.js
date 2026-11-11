import { db, generateUUID } from './localDb';
import { addProduct, addReplenishment } from './products';
import { applyPurchaseStock, setBranchStock } from './branchStock';

export const PROFORMA_DOC_TYPES = ['Proforma', 'Factura', 'Recibo', 'Nota de entrega'];

const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function roundUnitCost(value) {
  return Math.round((Number(value) || 0) * 1e6) / 1e6;
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function cleanProformaExtraCosts(extraCosts) {
  return (Array.isArray(extraCosts) ? extraCosts : [])
    .map((row) => ({
      concept: String(row?.concept || '').trim(),
      amount: roundMoney(row?.amount),
    }))
    .filter((row) => row.concept && row.amount > 0);
}

export function getProformaItemFactor(item) {
  const factor = Number(item?.factor || 0);
  return Number.isFinite(factor) && factor >= 1 ? factor : 1;
}

export function getProformaItemQuantity(item) {
  const factor = getProformaItemFactor(item);
  const packs = Math.max(0, Math.floor(Number(item?.packCount || 0)));
  const loose = Math.max(0, Math.floor(Number(item?.looseUnits || 0)));
  return packs * factor + loose;
}

export function getProformaItemUnitCost(item) {
  const factor = getProformaItemFactor(item);
  const input = Number(item?.costInput || 0);
  if (!Number.isFinite(input) || input <= 0) return 0;
  return item?.costMode === 'package' && factor > 1 ? input / factor : input;
}

export function computeProformaItem(item, extraShare = 0) {
  const factor = getProformaItemFactor(item);
  const packCount = Math.max(0, Math.floor(Number(item?.packCount || 0)));
  const looseUnits = Math.max(0, Math.floor(Number(item?.looseUnits || 0)));
  const quantity = packCount * factor + looseUnits;
  const unitCost = getProformaItemUnitCost(item);
  const baseCost = roundMoney(quantity * unitCost);
  const extra = roundMoney(extraShare);
  const totalCost = roundMoney(baseCost + extra);
  const unitRealCost = quantity > 0 ? totalCost / quantity : 0;
  const salePrice = Number(item?.salePrice || 0);
  const marginAmount = salePrice - unitRealCost;
  const marginPct = salePrice > 0 ? (marginAmount / salePrice) * 100 : 0;
  return {
    factor,
    packCount,
    looseUnits,
    quantity,
    unitCost,
    baseCost,
    extra,
    totalCost,
    unitRealCost,
    salePrice,
    marginAmount,
    marginPct,
  };
}

export function allocateAmountByWeights(total, weights = []) {
  const amount = roundMoney(total);
  const count = weights.length;
  if (count === 0) return [];
  if (!(amount > 0)) return weights.map(() => 0);

  const safeWeights = weights.map((weight) => Math.max(0, Number(weight) || 0));
  const weightTotal = safeWeights.reduce((sum, weight) => sum + weight, 0);

  if (!(weightTotal > 0)) {
    const base = Math.floor((amount / count) * 100) / 100;
    const result = weights.map(() => base);
    result[result.length - 1] = roundMoney(amount - base * (count - 1));
    return result;
  }

  let assigned = 0;
  return safeWeights.map((weight, index) => {
    if (index === count - 1) return roundMoney(amount - assigned);
    const share = Math.floor(((amount * weight) / weightTotal) * 100) / 100;
    assigned = roundMoney(assigned + share);
    return share;
  });
}

export function buildProformaExtraShares(extraCosts, baseCosts) {
  const clean = cleanProformaExtraCosts(extraCosts);
  const rowsByItem = baseCosts.map(() => []);

  clean.forEach((extra) => {
    const shares = allocateAmountByWeights(extra.amount, baseCosts);
    shares.forEach((amount, index) => {
      if (amount > 0) rowsByItem[index].push({ concept: extra.concept, amount });
    });
  });

  return rowsByItem.map((rows) => ({
    costs: rows,
    total: roundMoney(rows.reduce((sum, row) => sum + row.amount, 0)),
  }));
}

export function validateProformaDraft({ header, items, requireExpiry = false }) {
  const errors = [];
  if (!String(header?.number || '').trim()) errors.push('Escribí el número de la proforma.');
  if (!header?.date) errors.push('Elegí la fecha de la proforma.');
  if (!Array.isArray(items) || items.length === 0) errors.push('Agregá al menos un producto a la proforma.');

  (items || []).forEach((item, index) => {
    const label = String(item?.productName || item?.newProduct?.name || `Producto ${index + 1}`).trim();
    if (!item?.productId && !item?.isNewProduct) errors.push(`${label}: elegí un producto.`);
    if (item?.presentationKey === 'custom' && getProformaItemFactor(item) <= 1) {
      errors.push(`${label}: indicá cuántas unidades trae la presentación.`);
    }
    if (getProformaItemQuantity(item) <= 0) errors.push(`${label}: la cantidad debe ser mayor a 0.`);
    if (!(getProformaItemUnitCost(item) > 0)) errors.push(`${label}: el costo debe ser mayor a 0.`);
    if (!(Number(item?.salePrice) > 0)) errors.push(`${label}: el precio de venta debe ser mayor a 0.`);
    if (requireExpiry && !item?.expiryDate) errors.push(`${label}: cargá la fecha de vencimiento del lote.`);
  });

  return errors;
}

export function suggestProformaNumber(replenishments = []) {
  let max = 0;
  (replenishments || []).forEach((row) => {
    const match = /^P-(\d+)$/i.exec(String(row?.proformaNumber || '').trim());
    if (match) max = Math.max(max, Number(match[1]));
  });
  return `P-${String(max + 1).padStart(4, '0')}`;
}

export function groupReplenishmentsByProforma(replenishments = []) {
  const groups = new Map();

  (replenishments || []).forEach((row) => {
    if (!row?.proformaId) return;
    let group = groups.get(row.proformaId);
    if (!group) {
      group = {
        id: row.proformaId,
        number: '',
        date: '',
        supplier: '',
        docType: '',
        notes: '',
        branchId: null,
        branchName: '',
        extraCosts: [],
        extraTotal: 0,
        createdAt: null,
        items: [],
      };
      groups.set(row.proformaId, group);
    }

    if (!group.number && row.proformaNumber) group.number = row.proformaNumber;
    if (!group.date && row.proformaDate) group.date = row.proformaDate;
    if (!group.supplier && row.supplier) group.supplier = row.supplier;
    if (!group.docType && row.proformaDocType) group.docType = row.proformaDocType;
    if (!group.notes && row.proformaNotes) group.notes = row.proformaNotes;
    if (!group.branchId && row.branchId) group.branchId = row.branchId;
    if (!group.branchName && row.branchName) group.branchName = row.branchName;
    if (group.extraCosts.length === 0 && Array.isArray(row.proformaExtraCosts) && row.proformaExtraCosts.length > 0) {
      group.extraCosts = row.proformaExtraCosts;
    }
    if (!group.extraTotal && Number(row.proformaExtraTotal || 0) > 0) {
      group.extraTotal = Number(row.proformaExtraTotal || 0);
    }
    if (!group.createdAt && row.createdAt) {
      group.createdAt = row.createdAt?.toDate ? row.createdAt.toDate() : new Date(row.createdAt);
    }
    group.items.push(row);
  });

  return [...groups.values()].map((group) => {
    const items = group.items
      .slice()
      .sort((a, b) => {
        const lineA = Number(a.lineNumber || 0);
        const lineB = Number(b.lineNumber || 0);
        if (lineA !== lineB) return lineA - lineB;
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
        return dateA - dateB;
      });

    const units = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const baseTotal = items.reduce((sum, item) => sum + Number(item.supplierPrice || 0) * Number(item.quantity || 0), 0);
    const total = items.reduce((sum, item) => sum + Number(item.totalCost || 0), 0);
    const extraTotal = group.extraTotal > 0
      ? group.extraTotal
      : items.reduce((sum, item) => sum + Number(item.additionalExpenses || 0), 0);

    return {
      ...group,
      number: group.number || 'Sin número',
      docType: group.docType || 'Proforma',
      extraCosts: group.extraCosts,
      extraTotal: roundMoney(extraTotal),
      baseTotal: roundMoney(baseTotal),
      total: roundMoney(total),
      units,
      itemCount: items.length,
      items,
    };
  }).sort((a, b) => {
    const dateA = a.date ? new Date(`${a.date}T00:00:00`).getTime() : 0;
    const dateB = b.date ? new Date(`${b.date}T00:00:00`).getTime() : 0;
    if (dateA !== dateB) return dateB - dateA;
    return (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0);
  });
}

function buildNewProductPayload(item, computed) {
  const draft = item.newProduct || {};
  const basePrice = Number(computed.salePrice || 0);
  const presentations = Array.isArray(draft.presentations) && draft.presentations.length > 0
    ? draft.presentations.map((presentation) => (
      presentation.isBase ? { ...presentation, price: basePrice } : presentation
    ))
    : [{
      id: 'base-unit',
      name: 'Unidad',
      factor: 1,
      price: basePrice,
      isBase: true,
    }];
  const base = presentations.find((presentation) => presentation.isBase);

  return {
    name: String(draft.name || item.productName || '').trim(),
    barcode: String(draft.barcode || '').trim(),
    brand: String(draft.brand || '').trim(),
    category: draft.category || 'Otros',
    description: '',
    price: basePrice,
    stock: computed.quantity,
    minStock: 5,
    supplierPrice: roundUnitCost(computed.unitRealCost),
    unit: 'Unidad',
    unitLabel: base?.name || 'Unidad',
    isDish: false,
    isAvailable: true,
    packageSize: computed.factor > 1 ? computed.factor : null,
    expiryDate: null,
    presentations,
    imageData: '',
  };
}

function buildExistingProductFields(product, computed) {
  const presentations = Array.isArray(product.presentations) ? product.presentations : [];

  return {
    name: product.name,
    price: computed.salePrice,
    minStock: product.min_stock ?? 5,
    brand: product.brand || '',
    category: product.category || 'Otros',
    description: product.description || '',
    imageData: product.image_url || '',
    supplierPrice: roundUnitCost(computed.unitRealCost),
    unit: product.unit || 'Unidad',
    unitLabel: product.unit_label || 'Unidad',
    presentations: presentations.length > 0
      ? presentations.map((presentation) => (
        presentation.isBase ? { ...presentation, price: computed.salePrice } : presentation
      ))
      : undefined,
    packageSize: computed.factor > 1 ? computed.factor : (product.package_size || null),
  };
}

export async function savePurchaseProforma(businessId, payload) {
  const header = {
    number: String(payload?.header?.number || '').trim(),
    date: payload?.header?.date || '',
    supplier: String(payload?.header?.supplier || '').trim(),
    docType: payload?.header?.docType || 'Proforma',
    notes: String(payload?.header?.notes || '').trim(),
  };
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const extraCosts = cleanProformaExtraCosts(payload?.extraCosts);
  const branchId = payload?.branchId || null;
  const branchName = String(payload?.branchName || '').trim();
  const mainBranchId = payload?.mainBranchId || null;

  const errors = validateProformaDraft({
    header,
    items,
    requireExpiry: !!payload?.requireExpiry,
  });
  if (errors.length > 0) {
    const error = new Error(errors[0]);
    error.details = errors;
    throw error;
  }

  const localProducts = await db.products.where('business_id').equals(businessId).toArray();
  const productByName = new Map();
  const productByBarcode = new Map();
  localProducts.forEach((product) => {
    productByName.set(normalizeText(product.name), product);
    if (String(product.barcode || '').trim()) {
      productByBarcode.set(normalizeText(product.barcode), product);
    }
  });

  items.forEach((item) => {
    if (!item?.isNewProduct) return;
    const draft = item.newProduct || {};
    const nameKey = normalizeText(draft.name || item.productName);
    const barcodeKey = normalizeText(draft.barcode);
    const nameMatch = productByName.get(nameKey);
    if (nameMatch) {
      const error = new Error(`Ya existe el producto "${nameMatch.name}". Buscalo en la lista y agregalo desde ahí.`);
      error.details = [`Ya existe el producto "${nameMatch.name}".`];
      throw error;
    }
    const barcodeMatch = barcodeKey ? productByBarcode.get(barcodeKey) : null;
    if (barcodeMatch) {
      const error = new Error(`El código de barras ya pertenece a "${barcodeMatch.name}".`);
      error.details = [`El código de barras ya pertenece a "${barcodeMatch.name}".`];
      throw error;
    }
  });

  const prepared = items.map((item) => ({
    item,
    computed: computeProformaItem(item, 0),
  }));
  const baseCosts = prepared.map(({ computed }) => computed.baseCost);
  const extraShares = buildProformaExtraShares(extraCosts, baseCosts);
  const totalExtra = roundMoney(extraCosts.reduce((sum, extra) => sum + extra.amount, 0));
  const proformaId = generateUUID();
  const newProductCache = new Map();
  const savedItems = [];
  let total = 0;
  let units = 0;

  for (let index = 0; index < prepared.length; index += 1) {
    const { item } = prepared[index];
    const share = extraShares[index] || { costs: [], total: 0 };
    const computed = computeProformaItem(item, share.total);
    const usePackage = computed.factor > 1 && computed.packCount > 0;
    let product = null;

    if (item.isNewProduct) {
      const draft = item.newProduct || {};
      const cacheKey = normalizeText(draft.name || item.productName);
      const cached = newProductCache.get(cacheKey);

      if (cached) {
        product = await db.products.get(cached.id);
        if (!product) throw new Error(`No pudimos recuperar el producto "${draft.name}".`);
        await applyPurchaseStock({
          businessId,
          product,
          branchId,
          mainBranchId,
          qty: computed.quantity,
          fields: buildExistingProductFields(product, computed),
        });
        product = await db.products.get(product.id);
      } else {
        product = await addProduct(businessId, buildNewProductPayload(item, computed));
        if (branchId) {
          await setBranchStock(businessId, product, branchId, computed.quantity);
        }
        newProductCache.set(cacheKey, product);
      }
    } else {
      const current = await db.products.get(item.productId);
      if (!current || current.business_id !== businessId) {
        throw new Error(`No encontramos "${item.productName || 'el producto'}". Actualizá la lista y volvé a intentar.`);
      }
      await applyPurchaseStock({
        businessId,
        product: current,
        branchId,
        mainBranchId,
        qty: computed.quantity,
        fields: buildExistingProductFields(current, computed),
      });
      product = await db.products.get(current.id);
    }

    if (!product) throw new Error('No pudimos guardar uno de los productos de la proforma.');

    const replenishment = await addReplenishment(businessId, {
      productId: product.id,
      productName: product.name,
      supplier: header.supplier,
      quantity: computed.quantity,
      salePrice: computed.salePrice,
      supplierPrice: roundUnitCost(computed.baseCost / computed.quantity),
      extraCosts: share.costs,
      expiryDate: item.expiryDate || null,
      purchaseUnitType: usePackage ? 'package' : 'unit',
      packageSize: usePackage ? computed.factor : null,
      packageCount: usePackage ? computed.packCount : null,
      proformaId,
      proformaNumber: header.number,
      proformaDate: header.date,
      proformaDocType: header.docType,
      proformaNotes: header.notes,
      proformaExtraCosts: extraCosts,
      proformaExtraTotal: totalExtra,
      lotCode: String(item.lotCode || '').trim(),
      lineNumber: index + 1,
      presentationName: usePackage
        ? String(item.presentationName || 'Paquete').trim() || 'Paquete'
        : 'Unidad',
      branchId,
      branchName,
    });

    total = roundMoney(total + Number(replenishment.totalCost || 0));
    units += computed.quantity;
    savedItems.push(replenishment);
  }

  return {
    proformaId,
    number: header.number,
    date: header.date,
    itemCount: savedItems.length,
    units,
    total,
    totalExtra,
    items: savedItems,
  };
}

function proformaDraftId(businessId, userId) {
  return `${businessId}_${userId}_proforma`;
}

export async function getProformaDraft(businessId, userId) {
  if (!businessId || !userId) return null;
  const draft = await db.purchase_drafts.get(proformaDraftId(businessId, userId));
  if (!draft) return null;
  const ageMs = Date.now() - new Date(draft.updated_at).getTime();
  if (ageMs > DRAFT_MAX_AGE_MS) {
    await db.purchase_drafts.delete(proformaDraftId(businessId, userId));
    return null;
  }
  return draft;
}

export async function saveProformaDraft(businessId, userId, data) {
  if (!businessId || !userId) return;
  await db.purchase_drafts.put({
    id: proformaDraftId(businessId, userId),
    business_id: businessId,
    user_id: userId,
    kind: 'proforma',
    ...data,
    updated_at: new Date().toISOString(),
  });
}

export async function clearProformaDraft(businessId, userId) {
  if (!businessId || !userId) return;
  await db.purchase_drafts.delete(proformaDraftId(businessId, userId));
}
