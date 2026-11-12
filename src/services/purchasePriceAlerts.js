import { db, generateUUID } from './localDb';
import { buildOutboxOp, refreshOutboxState } from './syncEngine';
import { updateProductSalePrice } from './products';

const alertListeners = new Set();

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function mapAlert(row) {
  if (!row) return row;
  return {
    ...row,
    businessId: row.business_id,
    productId: row.product_id,
    productCode: row.product_code || '',
    productName: row.product_name,
    oldPackagePrice: Number(row.old_package_price || 0),
    newPackagePrice: Number(row.new_package_price || 0),
    differenceAmount: Number(row.difference_amount || 0),
    differencePct: Number(row.difference_pct || 0),
    packageFactor: Number(row.package_factor || 1),
    previousSalePrice: Number(row.previous_sale_price || 0),
    proformaId: row.proforma_id,
    proformaNumber: row.proforma_number || '',
    proformaDate: row.proforma_date || '',
    status: row.status || 'pending',
    reviewedAt: row.reviewed_at || null,
    reviewedBy: row.reviewed_by || null,
    updatedSalePrice: row.updated_sale_price === null || row.updated_sale_price === undefined
      ? null
      : Number(row.updated_sale_price),
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
}

export async function getPurchasePriceAlerts(businessId, { status = 'pending' } = {}) {
  if (!businessId) return [];
  const rows = await db.purchase_price_alerts.where('business_id').equals(businessId).toArray();
  return rows
    .filter((row) => !status || row.status === status)
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .map(mapAlert);
}

function notifyListeners(businessId) {
  getPurchasePriceAlerts(businessId)
    .then((alerts) => {
      alertListeners.forEach((entry) => {
        if (entry.businessId === businessId) entry.callback(alerts);
      });
    })
    .catch(console.error);
}

export function subscribeToPurchasePriceAlerts(businessId, callback) {
  if (!businessId) return () => {};
  getPurchasePriceAlerts(businessId).then(callback).catch(console.error);
  const entry = { businessId, callback };
  alertListeners.add(entry);
  return () => {
    alertListeners.delete(entry);
  };
}

export function notifyPurchasePriceAlertChanges(businessId) {
  notifyListeners(businessId);
}

export async function addPurchasePriceAlert(businessId, data) {
  if (!businessId) return null;
  const oldPrice = roundMoney(data.oldPackagePrice);
  const newPrice = roundMoney(data.newPackagePrice);
  const differenceAmount = roundMoney(
    data.differenceAmount !== undefined ? data.differenceAmount : newPrice - oldPrice,
  );
  const now = new Date().toISOString();
  const row = {
    id: generateUUID(),
    business_id: businessId,
    product_id: data.productId || null,
    product_code: String(data.productCode || '').trim(),
    product_name: String(data.productName || '').trim() || 'Producto',
    supplier: String(data.supplier || '').trim(),
    old_package_price: oldPrice,
    new_package_price: newPrice,
    difference_amount: differenceAmount,
    difference_pct: oldPrice > 0
      ? roundMoney((differenceAmount / oldPrice) * 100)
      : 0,
    package_factor: Number(data.packageFactor || 1),
    previous_sale_price: Number(data.previousSalePrice || 0) || null,
    proforma_id: data.proformaId || null,
    proforma_number: data.proformaNumber || null,
    proforma_date: data.proformaDate || null,
    status: 'pending',
    reviewed_at: null,
    reviewed_by: null,
    updated_sale_price: null,
    created_at: now,
    updated_at: now,
  };

  await db.transaction('rw', db.purchase_price_alerts, db.pending_operations, async () => {
    await db.purchase_price_alerts.put(row);
    await db.pending_operations.add(buildOutboxOp('ADD_PURCHASE_PRICE_ALERT', row, businessId));
  });
  notifyListeners(businessId);
  try {
    await refreshOutboxState(businessId);
  } catch { /* offline */ }
  return mapAlert(row);
}

export async function markProductPriceAlertsReviewed(
  businessId,
  productId,
  userId,
  { salePrice = null } = {},
) {
  if (!businessId || !productId) return 0;
  const rows = (await db.purchase_price_alerts.where('business_id').equals(businessId).toArray())
    .filter((row) => row.product_id === productId && row.status === 'pending');
  if (rows.length === 0) return 0;

  const now = new Date().toISOString();
  const ids = rows.map((row) => row.id);
  const updateData = {
    status: 'reviewed',
    reviewed_at: now,
    reviewed_by: userId || null,
    updated_sale_price: salePrice !== null && salePrice !== undefined ? Number(salePrice) : null,
    updated_at: now,
  };

  await db.transaction('rw', db.purchase_price_alerts, db.pending_operations, async () => {
    await db.purchase_price_alerts.where('id').anyOf(ids).modify(updateData);
    await db.pending_operations.add(buildOutboxOp('REVIEW_PURCHASE_PRICE_ALERTS', {
      ids,
      business_id: businessId,
      ...updateData,
    }, businessId));
  });
  notifyListeners(businessId);
  try {
    await refreshOutboxState(businessId);
  } catch { /* offline */ }
  return ids.length;
}

export async function updateProductPriceFromAlert({
  businessId,
  productId,
  salePrice,
  userId,
}) {
  const price = Number(salePrice);
  if (!(price > 0)) throw new Error('Ingresá un precio de venta mayor a 0.');
  await updateProductSalePrice(productId, price);
  await markProductPriceAlertsReviewed(businessId, productId, userId, { salePrice: price });
  return price;
}

export function groupPurchasePriceAlerts(alerts = []) {
  const groups = new Map();
  (alerts || []).forEach((alert) => {
    const key = alert.productId || alert.productCode || alert.productName;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        productId: alert.productId,
        productCode: alert.productCode,
        productName: alert.productName,
        supplier: alert.supplier,
        latest: alert,
        alerts: [],
      });
    }
    const group = groups.get(key);
    group.alerts.push(alert);
    if (new Date(alert.createdAt || 0) > new Date(group.latest.createdAt || 0)) {
      group.latest = alert;
    }
    if (!group.supplier && alert.supplier) group.supplier = alert.supplier;
    if (!group.productCode && alert.productCode) group.productCode = alert.productCode;
  });

  return [...groups.values()]
    .map((group) => ({
      ...group,
      count: group.alerts.length,
      direction: group.latest.differenceAmount > 0 ? 'up' : 'down',
    }))
    .sort((a, b) => new Date(b.latest.createdAt || 0) - new Date(a.latest.createdAt || 0));
}

if (typeof window !== 'undefined') {
  window.addEventListener('tuganancia-cache-synced', (event) => {
    const businessId = event?.detail?.businessId;
    if (businessId) notifyListeners(businessId);
  });
}
