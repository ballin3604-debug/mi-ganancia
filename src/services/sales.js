import { db, generateUUID } from './localDb';
import { buildOutboxOp, refreshOutboxState } from './syncEngine';
import { forceProductRefresh } from './products';
import { notifyIncomeChanges } from './expenses';

function mapSale(s) {
  if (!s) return s;
  return {
    ...s,
    paymentMethod: s.payment_method,
    itemCount: s.item_count,
    montoEfectivo: s.monto_efectivo,
    montoQR: s.monto_qr,
    createdAt: s.created_at ? { toDate: () => new Date(s.created_at) } : null,
  };
}

function mapSaleItem(item) {
  if (!item) return item;
  return {
    ...item,
    saleId: item.sale_id,
    productId: item.product_id,
    productName: item.product_name,
    productBrand: item.product_brand,
  };
}

const todaySalesListeners = new Set();
const allSalesListeners = new Set();
const saleItemsListeners = new Set();

function notifyTodaySales(businessId) {
  getTodaySales(businessId).then((sales) => {
    todaySalesListeners.forEach((callback) => callback(sales));
  });
}

function notifyAllSales(businessId) {
  getSales(businessId).then((sales) => {
    allSalesListeners.forEach((callback) => callback(sales));
  });
}

function notifySaleItems(businessId) {
  getSaleItemsAll(businessId).then((items) => {
    saleItemsListeners.forEach((callback) => callback(items));
  });
}

export function notifySaleChanges(businessId) {
  notifyTodaySales(businessId);
  notifyAllSales(businessId);
  notifySaleItems(businessId);
}

export async function registerSale(
  businessId,
  userId,
  cartItems,
  clientName = '',
  clientNit = '',
  paymentMethod = 'cash',
  sellerName = '',
  extraFields = {}
) {
  const saleId = generateUUID();
  const now = new Date().toISOString();
  const total = cartItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity, 0
  );

  const localSale = {
    id: saleId,
    business_id: businessId,
    created_by: userId,
    seller_name: sellerName || '',
    client_name: clientName || '',
    client_nit: clientNit || '',
    payment_method: paymentMethod || 'cash',
    total,
    item_count: cartItems.reduce((sum, item) => sum + item.quantity, 0),
    created_at: now,
    client_generated_id: saleId,
    monto_efectivo: extraFields.montoEfectivo !== undefined ? Number(extraFields.montoEfectivo) : null,
    monto_qr: extraFields.montoQR !== undefined ? Number(extraFields.montoQR) : null,
  };

  const p_items = cartItems.map((item) => {
    const supplierPrice = item.product.supplierPrice !== undefined && item.product.supplierPrice !== null
      ? Number(item.product.supplierPrice)
      : (item.product.supplier_price !== undefined && item.product.supplier_price !== null
        ? Number(item.product.supplier_price)
        : null);

    return {
      product_id: item.product.id,
      product_name: item.product.name,
      product_brand: item.product.brand || '',
      category: item.product.category || 'Otros',
      quantity: Number(item.quantity),
      price: Number(item.product.price),
      supplier_price: supplierPrice
    };
  });

  const outboxPayload = {
    business_id: businessId,
    client_name: clientName || 'S/N',
    client_nit: clientNit || '0',
    payment_method: paymentMethod || 'cash',
    total,
    p_items,
    extraFields,
    client_generated_id: saleId,
    item_count: cartItems.reduce((sum, item) => sum + item.quantity, 0),
    seller_name: sellerName || '',
    created_by: userId,
  };
  const outboxOp = buildOutboxOp('REGISTER_SALE', outboxPayload, businessId);

  // Sale + items + stock decrements + outbox entry all commit atomically:
  // either the whole sale is saved together with its sync entry, or none of
  // it is. Previously these were separate awaits with no transaction — a
  // crash mid-loop left a partial sale (mismatched items/stock) with no
  // outbox entry, and a retry after an enqueue failure created a duplicate
  // sale with stock decremented twice for the same physical transaction.
  await db.transaction('rw', db.sales, db.sale_items, db.products, db.pending_operations, async () => {
    await db.sales.put(localSale);

    for (const item of cartItems) {
      const itemId = generateUUID();
      const supplierPrice = item.product.supplierPrice !== undefined && item.product.supplierPrice !== null
        ? Number(item.product.supplierPrice)
        : (item.product.supplier_price !== undefined && item.product.supplier_price !== null
          ? Number(item.product.supplier_price)
          : null);

      const localItem = {
        id: itemId,
        business_id: businessId,
        sale_id: saleId,
        product_id: item.product.id,
        product_name: item.product.name,
        product_brand: item.product.brand || '',
        category: item.product.category || '',
        image_url: item.product.imageData || '',
        quantity: item.quantity,
        price: item.product.price,
        subtotal: item.product.price * item.quantity,
        supplier_price: supplierPrice,
      };
      await db.sale_items.put(localItem);

      const prod = await db.products.get(item.product.id);
      if (prod) {
        const updatedStock = Math.max(0, prod.stock - item.quantity);
        await db.products.update(item.product.id, {
          stock: updatedStock,
          updated_at: now
        });
      }
    }

    await db.pending_operations.add(outboxOp);
  });

  // Refresh lists (after commit — side effects, not part of the atomic unit)
  notifySaleChanges(businessId);
  forceProductRefresh(businessId);
  try {
    notifyIncomeChanges(businessId);
  } catch (err) {
    console.error('Error refreshing income local views:', err);
  }
  await refreshOutboxState(businessId);

  return saleId;
}

export async function getTodaySales(businessId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sales = await db.sales.where('business_id').equals(businessId).toArray();
  // Filter today and sort desc
  return sales
    .filter((s) => new Date(s.created_at) >= today)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(mapSale);
}

export function subscribeToTodaySales(businessId, callback) {
  getTodaySales(businessId).then(callback).catch(console.error);
  todaySalesListeners.add(callback);
  return () => {
    todaySalesListeners.delete(callback);
  };
}

export async function getSales(businessId) {
  const sales = await db.sales.where('business_id').equals(businessId).toArray();
  // Sort desc
  return sales.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(mapSale);
}

export function subscribeToSales(businessId, callback) {
  getSales(businessId).then(callback).catch(console.error);
  allSalesListeners.add(callback);
  return () => {
    allSalesListeners.delete(callback);
  };
}

export async function getSaleItemsAll(businessId) {
  const items = await db.sale_items.where('business_id').equals(businessId).toArray();
  return items.map(mapSaleItem);
}

export function subscribeToSaleItems(businessId, callback) {
  getSaleItemsAll(businessId).then(callback).catch(console.error);
  saleItemsListeners.add(callback);
  return () => {
    saleItemsListeners.delete(callback);
  };
}

export async function getSaleItems(businessId, saleId) {
  const items = await db.sale_items.where('sale_id').equals(saleId).toArray();
  // Filter by businessId as well
  return items.filter((i) => i.business_id === businessId).map(mapSaleItem);
}

export async function exportDetailedCSV(businessId) {
  const sales = await getSales(businessId);
  const items = await getSaleItemsAll(businessId);

  const itemsBySale = {};
  items.forEach((item) => {
    if (!itemsBySale[item.saleId]) itemsBySale[item.saleId] = [];
    itemsBySale[item.saleId].push(item);
  });

  const rows = [];
  rows.push([
    'Fecha', 'Hora', 'Vendedor', 'Cliente', 'Método de pago',
    'Producto', 'Cantidad', 'Precio unitario', 'Subtotal', 'Total venta'
  ].join(','));

  sales.forEach((sale) => {
    const date = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date();
    const fechaStr = date.toLocaleDateString('es-BO');
    const horaStr = date.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
    const saleItems = itemsBySale[sale.id] || [];

    if (saleItems.length === 0) {
      rows.push([
        fechaStr, horaStr,
        `"${sale.sellerName || ''}"`,
        `"${sale.clientName || ''}"`,
        sale.paymentMethod || '',
        '', '', '', '',
        sale.total || 0
      ].join(','));
    } else {
      saleItems.forEach((item, idx) => {
        rows.push([
          fechaStr, horaStr,
          `"${sale.sellerName || ''}"`,
          `"${sale.clientName || ''}"`,
          sale.paymentMethod || '',
          `"${item.productName || ''}"`,
          item.quantity || 0,
          item.price || 0,
          item.subtotal || 0,
          idx === 0 ? (sale.total || 0) : ''
        ].join(','));
      });
    }
  });

  const csv = rows.join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ventas_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

if (typeof window !== 'undefined') {
  window.addEventListener('tuganancia-cache-synced', (e) => {
    if (e.detail && e.detail.businessId) {
      notifySaleChanges(e.detail.businessId);
    }
  });
}
