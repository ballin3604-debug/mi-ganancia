import { db, generateUUID } from './localDb';
import { buildOutboxOp, refreshOutboxState } from './syncEngine';
import { forceProductRefresh } from './products';
import { notifyIncomeChanges } from './expenses';
import { notifyBranchStock } from './branchStock';
import { calculateBaseQuantity, validateSellSelection } from '../utils/presentations';

function mapSale(s) {
  if (!s) return s;
  return {
    ...s,
    paymentMethod: s.payment_method,
    sellerName: s.seller_name || s.sellerName || '',
    createdBy: s.created_by || s.createdBy || null,
    itemCount: s.item_count,
    montoEfectivo: s.monto_efectivo,
    montoQR: s.monto_qr,
    branchId: s.branch_id || null,
    status: s.status || 'completed',
    cancelledAt: s.cancelled_at || null,
    cancelledBy: s.cancelled_by || null,
    cancellationReason: s.cancellation_reason || '',
    updatedAt: s.updated_at || null,
    createdAt: s.created_at ? { toDate: () => new Date(s.created_at) } : null,
  };
}

export function isSaleCancelled(sale) {
  return sale?.status === 'cancelled';
}

function mapSaleItem(item) {
  if (!item) return item;
  return {
    ...item,
    saleId: item.sale_id,
    productId: item.product_id,
    productName: item.product_name,
    productBrand: item.product_brand,
    presentation: item.presentation || '',
    presentationId: item.presentation_id || item.presentationId || null,
    presentationFactor: Number(item.presentation_factor || 1),
    variant: item.variant || '',
    supplierPrice: item.supplier_price ?? item.supplierPrice ?? null,
    imageUrl: item.image_url || item.imageUrl || '',
  };
}

function mapSaleChange(change) {
  if (!change) return change;
  return {
    ...change,
    saleId: change.sale_id,
    eventType: change.event_type,
    productId: change.product_id,
    productName: change.product_name || '',
    quantityBefore: change.quantity_before === null || change.quantity_before === undefined
      ? null
      : Number(change.quantity_before),
    quantityAfter: change.quantity_after === null || change.quantity_after === undefined
      ? null
      : Number(change.quantity_after),
    amountDelta: Number(change.amount_delta || 0),
    totalBefore: Number(change.total_before || 0),
    totalAfter: Number(change.total_after || 0),
    createdBy: change.created_by || null,
    branchId: change.branch_id || null,
    createdAt: change.created_at ? { toDate: () => new Date(change.created_at) } : null,
  };
}

const todaySalesListeners = new Set();
const allSalesListeners = new Set();
const saleItemsListeners = new Set();
const saleChangesListeners = new Set();

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

function notifyOrderChanges(businessId) {
  getSaleChangesAll(businessId).then((changes) => {
    saleChangesListeners.forEach((callback) => callback(changes));
  });
}

export function notifySaleChanges(businessId) {
  notifyTodaySales(businessId);
  notifyAllSales(businessId);
  notifySaleItems(businessId);
  notifyOrderChanges(businessId);
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
  if (!businessId || !Array.isArray(cartItems) || cartItems.length === 0) {
    throw new Error('La venta necesita un negocio y al menos un producto.');
  }
  cartItems.forEach((item) => {
    if (!item?.product?.id || item.product.business_id !== businessId) {
      throw new Error('El producto no pertenece al negocio de esta venta.');
    }
    validateSellSelection(item.product, item);
  });

  const saleId = generateUUID();
  const now = new Date().toISOString();
  // Sede operativa (Fase 1 sucursales): viaja en extraFields para no cambiar
  // la firma. El RPC no la conoce: se estampa en el servidor post-RPC.
  const branchId = extraFields.branchId || null;
  // Totales por PRESENTACIÓN: precio de la presentación × cantidad.
  // factor = unidades base por presentación (1 en unidad, N en paquete).
  const total = cartItems.reduce(
    (sum, item) => sum + Number(item.unitPrice ?? item.product.price) * Number(item.quantity), 0
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
    branch_id: branchId,
    item_count: cartItems.reduce((sum, item) => sum + Number(item.quantity) * Number(item.factor || 1), 0),
    created_at: now,
    client_generated_id: saleId,
    monto_efectivo: extraFields.montoEfectivo !== undefined ? Number(extraFields.montoEfectivo) : null,
    monto_qr: extraFields.montoQR !== undefined ? Number(extraFields.montoQR) : null,
    status: 'completed',
    updated_at: now,
    sync_status: 'local',
  };

  const p_items = cartItems.map((item) => {
    const supplierPrice = item.product.supplierPrice !== undefined && item.product.supplierPrice !== null
      ? Number(item.product.supplierPrice)
      : (item.product.supplier_price !== undefined && item.product.supplier_price !== null
        ? Number(item.product.supplier_price)
        : null);
    const factor = Number(item.factor || 1);

    return {
      product_id: item.product.id,
      product_name: item.product.name,
      product_brand: item.product.brand || '',
      category: item.product.category || 'Otros',
      quantity: Number(item.quantity),
      price: Number(item.unitPrice ?? item.product.price),
      supplier_price: supplierPrice,
      presentation_id: item.presentationId || null,
      presentation: item.presLabel || '',
      presentation_factor: Number(item.factor),
      variant: item.variant || '',
    };
  });

  // Factores para la compensación de stock en el servidor (no se envían al RPC).
  const p_factors = cartItems.map((item) => ({
    product_id: item.product.id,
    quantity: Number(item.quantity),
    factor: Number(item.factor || 1),
    price: Number(item.unitPrice ?? item.product.price),
    presentation: item.presLabel || '',
    presentation_id: item.presentationId || null,
    variant: item.variant || '',
  }));

  const outboxPayload = {
    business_id: businessId,
    client_name: clientName || 'S/N',
    client_nit: clientNit || '0',
    payment_method: paymentMethod || 'cash',
    total,
    p_items,
    p_factors,
    extraFields,
    client_generated_id: saleId,
    item_count: cartItems.reduce((sum, item) => sum + Number(item.quantity) * Number(item.factor || 1), 0),
    seller_name: sellerName || '',
    created_by: userId,
  };
  const operationType = cartItems.some((item) => !!item.presentationId)
    ? 'REGISTER_PRESENTATION_SALE'
    : 'REGISTER_SALE';
  const outboxOp = buildOutboxOp(operationType, outboxPayload, businessId, {
    userId,
    branchId,
    origin: 'offline',
  });

  // Sale + items + stock decrements + outbox entry all commit atomically:
  // either the whole sale is saved together with its sync entry, or none of
  // it is. Previously these were separate awaits with no transaction — a
  // crash mid-loop left a partial sale (mismatched items/stock) with no
  // outbox entry, and a retry after an enqueue failure created a duplicate
  // sale with stock decremented twice for the same physical transaction.
  const saleBranchId = extraFields.branchId || null;

  await db.transaction('rw', db.sales, db.sale_items, db.products, db.branch_stock, db.pending_operations, async () => {
    const hasBranchRows = saleBranchId
      ? (await db.branch_stock.where('business_id').equals(businessId).count()) > 0
      : false;
    await db.sales.put(localSale);

    for (const item of cartItems) {
      const itemId = generateUUID();
      const supplierPrice = item.product.supplierPrice !== undefined && item.product.supplierPrice !== null
        ? Number(item.product.supplierPrice)
        : (item.product.supplier_price !== undefined && item.product.supplier_price !== null
          ? Number(item.product.supplier_price)
          : null);
      const factor = Number(item.factor || 1);
      const unitPrice = Number(item.unitPrice ?? item.product.price);
      const qty = Number(item.quantity);

      const localItem = {
        id: itemId,
        business_id: businessId,
        sale_id: saleId,
        product_id: item.product.id,
        product_name: item.product.name,
        product_brand: item.product.brand || '',
        category: item.product.category || '',
        image_url: item.product.imageData || '',
        quantity: qty,
        price: unitPrice,
        subtotal: unitPrice * qty,
        supplier_price: supplierPrice,
        presentation: item.presLabel || '',
        presentation_id: item.presentationId || null,
        presentation_factor: factor,
        variant: item.variant || '',
      };
      await db.sale_items.put(localItem);

      const prod = await db.products.get(item.product.id);
      if (!prod || prod.business_id !== businessId) {
        throw new Error('El producto ya no está disponible en este negocio.');
      }
      validateSellSelection(prod, item);
      const baseQty = calculateBaseQuantity(qty, factor);
      // Plato: se vende sin inventario. La línea de venta se guarda igual
      // (ticket y reportes), pero no se toca el stock ni global ni por sede.
      if (prod.is_dish) continue;
      const currentStock = Number(prod.stock || 0);
      if (currentStock < baseQty) {
        throw new Error(`Stock insuficiente de ${prod.name}: quedan ${currentStock} unidades base.`);
      }
      await db.products.update(item.product.id, {
        stock: currentStock - baseQty,
        updated_at: now
      });
      if (saleBranchId && hasBranchRows) {
        const rowId = `${saleBranchId}:${item.product.id}`;
        const row = await db.branch_stock.get(rowId);
        if (!row || row.business_id !== businessId || row.branch_id !== saleBranchId) {
          throw new Error('No hay stock registrado para el producto en esta sucursal.');
        }
        const branchQty = Number(row.stock || 0);
        if (branchQty < baseQty) {
          throw new Error(`Stock insuficiente en la sucursal: quedan ${branchQty} unidades base.`);
        }
        await db.branch_stock.put({
          ...row,
          stock: branchQty - baseQty,
          updated_at: now,
        });
      }
    }

    await db.pending_operations.add(outboxOp);
  });

  // Refresh lists (after commit — side effects, not part of the atomic unit)
  notifySaleChanges(businessId);
  forceProductRefresh(businessId);
  notifyBranchStock(businessId);
  try {
    notifyIncomeChanges(businessId);
  } catch (err) {
    console.error('Error refreshing income local views:', err);
  }
  await refreshOutboxState(businessId);

  return saleId;
}

function normalizeEditLine(line) {
  const quantity = Number(line?.quantity);
  const price = Number(line?.price);
  const factor = Math.max(1, Number(line?.presentationFactor || 1));
  if (!line?.id || !line?.productId || !Number.isFinite(quantity) || quantity <= 0
      || !Number.isFinite(price) || price < 0 || !Number.isFinite(factor)) {
    throw new Error('Hay una línea del pedido con cantidad o precio inválido.');
  }
  return {
    id: line.id,
    productId: line.productId,
    productName: line.productName || 'Producto',
    productBrand: line.productBrand || '',
    category: line.category || 'Otros',
    imageUrl: line.imageUrl || '',
    quantity,
    price,
    supplierPrice: line.supplierPrice ?? line.supplier_price ?? null,
    presentation: line.presentation || '',
    presentationId: line.presentationId || null,
    presentationFactor: factor,
    variant: line.variant || '',
  };
}

function lineBaseQty(line) {
  return Number(line.quantity || 0) * Math.max(1, Number(line.presentationFactor || 1));
}

function toServerOrderItem(line) {
  return {
    id: line.id,
    product_id: line.productId,
    product_name: line.productName,
    product_brand: line.productBrand || '',
    category: line.category || 'Otros',
    quantity: line.quantity,
    price: line.price,
    supplier_price: line.supplierPrice,
    presentation: line.presentation || '',
    presentation_id: line.presentationId || null,
    presentation_factor: line.presentationFactor,
    variant: line.variant || '',
  };
}

function toServerChangeEvent(event) {
  const { sync_status, ...rest } = event;
  return rest;
}

function buildOrderChange({
  businessId, saleId, eventType, line = null, quantityBefore = null,
  quantityAfter = null, amountDelta = 0, totalBefore, totalAfter,
  reason = '', userId, branchId, now,
}) {
  return {
    id: generateUUID(),
    business_id: businessId,
    sale_id: saleId,
    event_type: eventType,
    product_id: line?.productId || null,
    product_name: line?.productName || null,
    quantity_before: quantityBefore,
    quantity_after: quantityAfter,
    amount_delta: Number(amountDelta || 0),
    total_before: Number(totalBefore || 0),
    total_after: Number(totalAfter || 0),
    reason: reason || null,
    created_by: userId || null,
    branch_id: branchId || null,
    created_at: now,
    sync_status: 'local',
  };
}

export async function updateSale(businessId, userId, saleId, lines, options = {}) {
  if (!businessId || !saleId || !Array.isArray(lines) || lines.length === 0) {
    throw new Error('El pedido necesita al menos un producto.');
  }
  const reason = (options.reason || '').trim();
  const now = new Date().toISOString();
  const normalized = lines.map(normalizeEditLine);
  const uniqueIds = new Set(normalized.map((line) => line.id));
  if (uniqueIds.size !== normalized.length) {
    throw new Error('Hay productos repetidos en el pedido.');
  }

  let result;
  await db.transaction('rw', db.sales, db.sale_items, db.products, db.branch_stock, db.pending_operations, db.sale_changes, async () => {
    const sale = await db.sales.get(saleId);
    if (!sale || sale.business_id !== businessId) {
      throw new Error('El pedido ya no está disponible en este negocio.');
    }
    if (sale.status === 'cancelled') {
      throw new Error('Este pedido ya fue cancelado.');
    }

    const existing = await db.sale_items.where('sale_id').equals(saleId).toArray();
    const existingById = new Map(existing.map((item) => [item.id, item]));
    const oldBaseByProduct = new Map();
    existing.forEach((item) => {
      if (!item.product_id) return;
      oldBaseByProduct.set(
        item.product_id,
        (oldBaseByProduct.get(item.product_id) || 0) + lineBaseQty(item)
      );
    });
    const newBaseByProduct = new Map();
    normalized.forEach((line) => {
      newBaseByProduct.set(
        line.productId,
        (newBaseByProduct.get(line.productId) || 0) + lineBaseQty(line)
      );
    });

    const productIds = new Set([...oldBaseByProduct.keys(), ...newBaseByProduct.keys()]);
    const productsById = {};
    for (const productId of productIds) {
      productsById[productId] = await db.products.get(productId);
    }

    const saleBranchId = sale.branch_id || null;
    const hasBranchRows = saleBranchId
      ? (await db.branch_stock.where('business_id').equals(businessId).count()) > 0
      : false;

    for (const [productId, newBase] of newBaseByProduct.entries()) {
      const product = productsById[productId];
      if (!product || product.business_id !== businessId) {
        throw new Error('El producto ya no está disponible en este negocio.');
      }
      if (product.is_dish) continue;
      const oldBase = oldBaseByProduct.get(productId) || 0;
      const available = Number(product.stock || 0) + oldBase;
      if (newBase > available + 0.0001) {
        throw new Error(`Stock insuficiente de ${product.name}: quedan ${Math.max(0, available)} unidades base.`);
      }
      if (saleBranchId && hasBranchRows) {
        const row = await db.branch_stock.get(`${saleBranchId}:${productId}`);
        if (!row || row.business_id !== businessId || row.branch_id !== saleBranchId) {
          throw new Error('No hay stock registrado para el producto en esta sucursal.');
        }
        const branchAvailable = Number(row.stock || 0) + oldBase;
        if (newBase > branchAvailable + 0.0001) {
          throw new Error(`Stock insuficiente en la sucursal: quedan ${Math.max(0, branchAvailable)} unidades base.`);
        }
      }
    }

    const allProductIds = new Set([...oldBaseByProduct.keys(), ...newBaseByProduct.keys()]);
    for (const productId of allProductIds) {
      const product = productsById[productId];
      if (!product || product.is_dish) continue;
      const oldBase = oldBaseByProduct.get(productId) || 0;
      const newBase = newBaseByProduct.get(productId) || 0;
      const delta = newBase - oldBase;
      if (Math.abs(delta) < 0.0001) continue;
      await db.products.update(productId, {
        stock: Number(product.stock || 0) - delta,
        updated_at: now,
      });
      if (saleBranchId && hasBranchRows) {
        const row = await db.branch_stock.get(`${saleBranchId}:${productId}`);
        if (row) {
          await db.branch_stock.put({
            ...row,
            stock: Number(row.stock || 0) - delta,
            updated_at: now,
          });
        }
      }
    }

    const keepIds = new Set(normalized.map((line) => line.id));
    for (const oldItem of existing) {
      if (!keepIds.has(oldItem.id)) {
        await db.sale_items.delete(oldItem.id);
      }
    }

    const totalBefore = Number(sale.total || 0);
    const totalAfter = normalized.reduce((sum, line) => sum + line.quantity * line.price, 0);
    const itemCount = normalized.reduce((sum, line) => sum + lineBaseQty(line), 0);
    const changes = [];

    for (const oldItem of existing) {
      if (keepIds.has(oldItem.id)) continue;
      changes.push(buildOrderChange({
        businessId, saleId, eventType: 'item_removed',
        line: {
          productId: oldItem.product_id,
          productName: oldItem.product_name,
        },
        quantityBefore: Number(oldItem.quantity || 0),
        quantityAfter: 0,
        amountDelta: -Number(oldItem.subtotal || 0),
        totalBefore, totalAfter, reason, userId, branchId: saleBranchId, now,
      }));
    }

    for (const line of normalized) {
      const oldItem = existingById.get(line.id);
      const item = {
        id: line.id,
        business_id: businessId,
        sale_id: saleId,
        product_id: line.productId,
        product_name: line.productName,
        product_brand: line.productBrand,
        category: line.category,
        image_url: line.imageUrl || oldItem?.image_url || '',
        quantity: line.quantity,
        price: line.price,
        subtotal: line.quantity * line.price,
        supplier_price: line.supplierPrice,
        presentation: line.presentation,
        presentation_id: line.presentationId,
        presentation_factor: line.presentationFactor,
        variant: line.variant,
      };
      await db.sale_items.put(item);

      if (!oldItem) {
        changes.push(buildOrderChange({
          businessId, saleId, eventType: 'item_added', line,
          quantityBefore: 0,
          quantityAfter: line.quantity,
          amountDelta: item.subtotal,
          totalBefore, totalAfter, reason, userId, branchId: saleBranchId, now,
        }));
      } else if (Number(oldItem.quantity) !== line.quantity) {
        const increased = line.quantity > Number(oldItem.quantity);
        changes.push(buildOrderChange({
          businessId, saleId,
          eventType: increased ? 'qty_increased' : 'qty_decreased',
          line,
          quantityBefore: Number(oldItem.quantity),
          quantityAfter: line.quantity,
          amountDelta: item.subtotal - Number(oldItem.subtotal || 0),
          totalBefore, totalAfter, reason, userId, branchId: saleBranchId, now,
        }));
      }
    }

    if (changes.length === 0) {
      throw new Error('No hiciste ningún cambio en el pedido.');
    }

    await db.sales.update(saleId, {
      total: totalAfter,
      item_count: Math.round(itemCount),
      status: 'completed',
      updated_at: now,
    });

    for (const change of changes) {
      await db.sale_changes.put(change);
    }

    const outboxOp = buildOutboxOp('UPDATE_SALE', {
      sale_id: saleId,
      business_id: businessId,
      items: normalized.map(toServerOrderItem),
      events: changes.map(toServerChangeEvent),
      total: totalAfter,
      item_count: Math.round(itemCount),
      reason,
      actor: userId || null,
      branch_id: saleBranchId,
      affected_product_ids: [...allProductIds],
    }, businessId, { userId, branchId: saleBranchId, origin: 'offline' });
    await db.pending_operations.add(outboxOp);

    result = { totalBefore, totalAfter, changes };
  });

  notifySaleChanges(businessId);
  forceProductRefresh(businessId);
  notifyBranchStock(businessId);
  try {
    notifyIncomeChanges(businessId);
  } catch (err) {
    console.error('Error refreshing income local views:', err);
  }
  await refreshOutboxState(businessId);
  return result;
}

export async function cancelSale(businessId, userId, saleId, options = {}) {
  if (!businessId || !saleId) {
    throw new Error('No se indicó qué pedido cancelar.');
  }
  const reason = (options.reason || '').trim();
  const now = new Date().toISOString();
  let result;
  await db.transaction('rw', db.sales, db.sale_items, db.products, db.branch_stock, db.pending_operations, db.sale_changes, async () => {
    const sale = await db.sales.get(saleId);
    if (!sale || sale.business_id !== businessId) {
      throw new Error('El pedido ya no está disponible en este negocio.');
    }
    if (sale.status === 'cancelled') {
      throw new Error('Este pedido ya fue cancelado.');
    }

    const items = await db.sale_items.where('sale_id').equals(saleId).toArray();
    const baseByProduct = new Map();
    items.forEach((item) => {
      if (!item.product_id) return;
      baseByProduct.set(
        item.product_id,
        (baseByProduct.get(item.product_id) || 0) + lineBaseQty(item)
      );
    });

    const saleBranchId = sale.branch_id || null;
    const hasBranchRows = saleBranchId
      ? (await db.branch_stock.where('business_id').equals(businessId).count()) > 0
      : false;

    for (const [productId, baseQty] of baseByProduct.entries()) {
      const product = await db.products.get(productId);
      if (!product || product.business_id !== businessId || product.is_dish) continue;
      await db.products.update(productId, {
        stock: Number(product.stock || 0) + baseQty,
        updated_at: now,
      });
      if (saleBranchId && hasBranchRows) {
        const row = await db.branch_stock.get(`${saleBranchId}:${productId}`);
        if (row) {
          await db.branch_stock.put({
            ...row,
            stock: Number(row.stock || 0) + baseQty,
            updated_at: now,
          });
        }
      }
    }

    const totalBefore = Number(sale.total || 0);
    const change = buildOrderChange({
      businessId, saleId, eventType: 'sale_cancelled',
      amountDelta: -totalBefore,
      totalBefore, totalAfter: 0,
      reason, userId, branchId: saleBranchId, now,
    });

    await db.sales.update(saleId, {
      status: 'cancelled',
      cancelled_at: now,
      cancelled_by: userId || null,
      cancellation_reason: reason || null,
      updated_at: now,
    });
    await db.sale_changes.put(change);

    const outboxOp = buildOutboxOp('CANCEL_SALE', {
      sale_id: saleId,
      business_id: businessId,
      event: toServerChangeEvent(change),
      items: items.map((item) => ({ product_id: item.product_id })),
      reason,
      actor: userId || null,
      branch_id: saleBranchId,
    }, businessId, { userId, branchId: saleBranchId, origin: 'offline' });
    await db.pending_operations.add(outboxOp);

    result = { totalBefore, change };
  });

  notifySaleChanges(businessId);
  forceProductRefresh(businessId);
  notifyBranchStock(businessId);
  try {
    notifyIncomeChanges(businessId);
  } catch (err) {
    console.error('Error refreshing income local views:', err);
  }
  await refreshOutboxState(businessId);
  return result;
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

export async function getSaleById(businessId, saleId) {
  const sale = await db.sales.get(saleId);
  if (!sale || sale.business_id !== businessId) return null;
  return mapSale(sale);
}

export async function getSaleChangesAll(businessId) {
  if (!businessId || !db.sale_changes) return [];
  const changes = await db.sale_changes.where('business_id').equals(businessId).toArray();
  return changes
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(mapSaleChange);
}

export async function getTodaySaleChanges(businessId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const changes = await getSaleChangesAll(businessId);
  return changes.filter((change) => {
    const d = change.createdAt?.toDate ? change.createdAt.toDate() : new Date(change.created_at);
    return d >= today;
  });
}

export function subscribeToSaleChanges(businessId, callback) {
  getSaleChangesAll(businessId).then(callback).catch(console.error);
  saleChangesListeners.add(callback);
  return () => {
    saleChangesListeners.delete(callback);
  };
}

export async function exportDetailedCSV(businessId) {
  const sales = (await getSales(businessId)).filter((sale) => sale.status !== 'cancelled');
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
        const pres = item.presentation ? ` [${item.presentation}]` : '';
        rows.push([
          fechaStr, horaStr,
          `"${sale.sellerName || ''}"`,
          `"${sale.clientName || ''}"`,
          sale.paymentMethod || '',
          `"${(item.productName || '') + pres}"`,
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
