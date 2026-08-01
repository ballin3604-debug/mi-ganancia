import { db, generateUUID } from './localDb';
import { buildOutboxOp, refreshOutboxState } from './syncEngine';

function mapProduct(p) {
  if (!p) return p;
  return {
    ...p,
    minStock: p.min_stock,
    supplierPrice: p.supplier_price,
    imageData: p.image_url,
    packageSize: p.package_size,
    createdAt: p.created_at ? { toDate: () => new Date(p.created_at) } : null,
    updatedAt: p.updated_at ? { toDate: () => new Date(p.updated_at) } : null,
  };
}

export function getReplenishmentExtraCosts(r) {
  if (!r) return [];
  if (Array.isArray(r.extra_costs) && r.extra_costs.length > 0) {
    return r.extra_costs;
  }
  if (Array.isArray(r.extraCosts) && r.extraCosts.length > 0) {
    return r.extraCosts;
  }

  const list = [];
  if (Number(r.cost_transport || r.costTransport) > 0) {
    list.push({ concept: 'Transporte', amount: Number(r.cost_transport || r.costTransport) });
  }
  if (Number(r.cost_commission || r.costCommission) > 0) {
    list.push({ concept: 'Comisión', amount: Number(r.cost_commission || r.costCommission) });
  }
  if (Number(r.cost_others || r.costOthers) > 0) {
    list.push({ concept: 'Otros', amount: Number(r.cost_others || r.costOthers) });
  }
  if (list.length === 0 && Number(r.additional_expenses || r.additionalExpenses) > 0) {
    list.push({ concept: 'Gastos Adicionales', amount: Number(r.additional_expenses || r.additionalExpenses) });
  }
  return list;
}

function mapReplenishment(r) {
  if (!r) return r;
  return {
    ...r,
    productId: r.product_id,
    productName: r.product_name,
    salePrice: r.sale_price,
    supplierPrice: r.supplier_price,
    additionalExpenses: r.additional_expenses,
    costTransport: r.cost_transport,
    costCommission: r.cost_commission,
    costOthers: r.cost_others,
    extraCosts: getReplenishmentExtraCosts(r),
    totalCost: r.total_cost,
    expiryDate: r.expiry_date,
    purchaseUnitType: r.purchase_unit_type,
    packageSize: r.package_size,
    packageCount: r.package_count,
    createdAt: r.created_at ? { toDate: () => new Date(r.created_at) } : null,
  };
}

const productListeners = new Set();
const replenishmentListeners = new Set();

export function notifyProductChanges(businessId) {
  getProducts(businessId).then((prods) => {
    productListeners.forEach((callback) => callback(prods));
  });
}

function notifyReplenishmentChanges(businessId) {
  getReplenishments(businessId).then((reps) => {
    replenishmentListeners.forEach((callback) => callback(reps));
  });
}

export async function getProducts(businessId) {
  const prods = await db.products.where('business_id').equals(businessId).toArray();
  // Sort by name locally
  return prods.sort((a, b) => a.name.localeCompare(b.name)).map(mapProduct);
}

export function subscribeToProducts(businessId, callback) {
  getProducts(businessId).then(callback).catch(console.error);
  productListeners.add(callback);
  return () => {
    productListeners.delete(callback);
  };
}

async function getReplenishments(businessId) {
  const reps = await db.replenishments.where('business_id').equals(businessId).toArray();
  // Sort by created_at desc
  return reps.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(mapReplenishment);
}

export function subscribeToReplenishments(businessId, callback) {
  getReplenishments(businessId).then(callback).catch(console.error);
  replenishmentListeners.add(callback);
  return () => {
    replenishmentListeners.delete(callback);
  };
}

export async function addProduct(businessId, data) {
  const id = generateUUID();
  const now = new Date().toISOString();

  const localObj = {
    id,
    business_id: businessId,
    name: data.name.trim(),
    price: Number(data.price),
    stock: Number(data.stock),
    min_stock: Number(data.minStock || 5),
    brand: (data.brand || '').trim(),
    category: data.category || 'Otros',
    description: (data.description || '').trim(),
    image_url: data.imageData || '',
    supplier_price: data.supplierPrice !== undefined && data.supplierPrice !== '' ? Number(data.supplierPrice) : null,
    unit: data.unit || 'Unidad',
    package_size: data.packageSize !== undefined && data.packageSize !== '' ? Number(data.packageSize) : null,
    created_at: now,
    updated_at: now,
  };

  const outboxOp = buildOutboxOp('ADD_PRODUCT', localObj, businessId);
  await db.transaction('rw', db.products, db.pending_operations, async () => {
    await db.products.put(localObj);
    await db.pending_operations.add(outboxOp);
  });
  notifyProductChanges(businessId);
  await refreshOutboxState(businessId);

  return mapProduct(localObj);
}

export async function updateProduct(productId, data) {
  const now = new Date().toISOString();
  const existing = await db.products.get(productId);
  if (!existing) throw new Error('Product not found in local cache');

  // Si el caller indica con qué stock abrió el formulario / calculó el ajuste
  // (expectedStock), aplicamos la diferencia sobre el valor ACTUAL en vez de
  // sobreescribirlo directo — así una venta o compra concurrente en otra
  // pestaña/dispositivo no se pierde si este guardado se confirma después.
  const stock = data.expectedStock !== undefined
    ? existing.stock + (Number(data.stock) - Number(data.expectedStock))
    : Number(data.stock);

  const updateData = {
    name: data.name.trim(),
    price: Number(data.price),
    stock,
    min_stock: Number(data.minStock || 5),
    brand: (data.brand || '').trim(),
    category: data.category || 'Otros',
    description: (data.description || '').trim(),
    image_url: data.imageData || '',
    updated_at: now,
  };

  if (data.supplierPrice !== undefined) {
    updateData.supplier_price = data.supplierPrice !== '' ? Number(data.supplierPrice) : null;
  }
  if (data.unit !== undefined) {
    updateData.unit = data.unit;
  }
  if (data.packageSize !== undefined) {
    updateData.package_size = data.packageSize !== '' ? Number(data.packageSize) : null;
  }

  const outboxOp = buildOutboxOp('UPDATE_PRODUCT', { id: productId, ...updateData }, existing.business_id);
  await db.transaction('rw', db.products, db.pending_operations, async () => {
    await db.products.update(productId, updateData);
    await db.pending_operations.add(outboxOp);
  });
  notifyProductChanges(existing.business_id);
  await refreshOutboxState(existing.business_id);

  const updated = { ...existing, ...updateData };
  return mapProduct(updated);
}

export async function deleteProduct(productId) {
  const existing = await db.products.get(productId);
  if (!existing) return;

  const outboxOp = buildOutboxOp('DELETE_PRODUCT', { id: productId }, existing.business_id);
  await db.transaction('rw', db.products, db.pending_operations, async () => {
    await db.products.delete(productId);
    await db.pending_operations.add(outboxOp);
  });
  notifyProductChanges(existing.business_id);
  await refreshOutboxState(existing.business_id);
}

export async function addReplenishment(businessId, data) {
  const id = generateUUID();
  const now = new Date().toISOString();

  const qty = Number(data.quantity);
  const baseSupplierPrice = Number(data.supplierPrice);

  // Dynamic extra costs array
  let rawExtraCosts = Array.isArray(data.extraCosts) ? data.extraCosts : [];
  
  // Backward compatibility check for legacy parameters if extraCosts array is empty
  if (rawExtraCosts.length === 0) {
    if (Number(data.costTransport) > 0) rawExtraCosts.push({ concept: 'Transporte', amount: Number(data.costTransport) });
    if (Number(data.costCommission) > 0) rawExtraCosts.push({ concept: 'Comisión', amount: Number(data.costCommission) });
    if (Number(data.costOthers) > 0) rawExtraCosts.push({ concept: 'Otros', amount: Number(data.costOthers) });
    if (rawExtraCosts.length === 0 && Number(data.additionalExpenses) > 0) {
      rawExtraCosts.push({ concept: 'Gastos Adicionales', amount: Number(data.additionalExpenses) });
    }
  }

  // Filter out invalid or zero amounts and format entries cleanly
  const extraCosts = rawExtraCosts
    .map((item) => ({ concept: (item.concept || 'Otros').trim(), amount: Number(item.amount || 0) }))
    .filter((item) => item.concept && item.amount > 0);

  // Calculate sum of all dynamic extra costs
  const totalExtra = extraCosts.reduce((sum, item) => sum + item.amount, 0);

  // Populate legacy fields for backward compatibility
  const legacyTransport = extraCosts.filter((i) => i.concept.toLowerCase() === 'transporte').reduce((s, i) => s + i.amount, 0);
  const legacyCommission = extraCosts.filter((i) => i.concept.toLowerCase() === 'comisión' || i.concept.toLowerCase() === 'comision').reduce((s, i) => s + i.amount, 0);
  const legacyOthers = extraCosts.filter((i) => i.concept.toLowerCase() !== 'transporte' && i.concept.toLowerCase() !== 'comisión' && i.concept.toLowerCase() !== 'comision').reduce((s, i) => s + i.amount, 0);

  const totalCost = (baseSupplierPrice * qty) + totalExtra;
  const unitCostReal = qty > 0 ? totalCost / qty : baseSupplierPrice;

  const replenishmentObj = {
    id,
    business_id: businessId,
    product_id: data.productId,
    product_name: data.productName,
    supplier: (data.supplier || '').trim(),
    quantity: qty,
    sale_price: Number(data.salePrice),
    supplier_price: baseSupplierPrice,
    extra_costs: extraCosts,
    additional_expenses: totalExtra,
    cost_transport: legacyTransport,
    cost_commission: legacyCommission,
    cost_others: legacyOthers,
    total_cost: totalCost,
    expiry_date: data.expiryDate || null,
    purchase_unit_type: data.purchaseUnitType || 'unit',
    package_size: data.purchaseUnitType === 'package' && data.packageSize ? Number(data.packageSize) : null,
    package_count: data.purchaseUnitType === 'package' && data.packageCount ? Number(data.packageCount) : null,
    created_at: now,
  };

  const outboxOp = buildOutboxOp('ADD_REPLENISHMENT', replenishmentObj, businessId);
  await db.transaction('rw', db.replenishments, db.pending_operations, async () => {
    await db.replenishments.put(replenishmentObj);
    await db.pending_operations.add(outboxOp);
  });
  notifyReplenishmentChanges(businessId);
  await refreshOutboxState(businessId);

  return mapReplenishment(replenishmentObj);
}

// Corrige la fecha de vencimiento de un lote de compra ya registrado —
// usado desde Inventario cuando el vencimiento que se cargó al comprar (o
// importar del catálogo) estaba mal y hay que arreglarlo sin tener que
// borrar y volver a crear la compra entera.
export async function updateReplenishmentExpiry(replenishmentId, expiryDate) {
  const existing = await db.replenishments.get(replenishmentId);
  if (!existing) throw new Error('Replenishment record not found');

  const updateData = { expiry_date: expiryDate || null };
  const outboxOp = buildOutboxOp('UPDATE_REPLENISHMENT', { id: replenishmentId, ...updateData }, existing.business_id);
  await db.transaction('rw', db.replenishments, db.pending_operations, async () => {
    await db.replenishments.update(replenishmentId, updateData);
    await db.pending_operations.add(outboxOp);
  });
  notifyReplenishmentChanges(existing.business_id);
  await refreshOutboxState(existing.business_id);
}

// Hook into local changes (e.g. from server sync) to refresh views
export function forceProductRefresh(businessId) {
  notifyProductChanges(businessId);
  notifyReplenishmentChanges(businessId);
}

if (typeof window !== 'undefined') {
  window.addEventListener('tuganancia-cache-synced', (e) => {
    if (e.detail && e.detail.businessId) {
      forceProductRefresh(e.detail.businessId);
    }
  });
}
