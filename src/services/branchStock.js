import { db, generateUUID } from './localDb';
import { buildOutboxOp, refreshOutboxState } from './syncEngine';
import { updateProduct } from './products';

// ─────────────────────────────────────────────────────────────
// Fase 2: stock por sede. branch_stock (sede × producto) es la fuente;
// products.stock se mantiene como TOTAL por deltas.
// ─────────────────────────────────────────────────────────────

export function branchStockId(branchId, productId) {
  return `${branchId}:${productId}`;
}

const stockListeners = new Set();

export function subscribeBranchStock(businessId, callback) {
  getBranchStocks(businessId).then(callback).catch(console.error);
  const entry = { businessId, callback };
  stockListeners.add(entry);
  return () => {
    stockListeners.delete(entry);
  };
}

export function notifyBranchStock(businessId) {
  getBranchStocks(businessId).then((rows) => {
    stockListeners.forEach((entry) => {
      if (entry.businessId === businessId) entry.callback(rows);
    });
  }).catch(console.error);
}

export async function getBranchStocks(businessId) {
  return db.branch_stock.where('business_id').equals(businessId).toArray();
}

// Mapa "branchId:productId" → stock (para lecturas rápidas en UI)
export function toStockMap(rows) {
  const map = new Map();
  (rows || []).forEach((r) => {
    map.set(`${r.branch_id}:${r.product_id}`, Number(r.stock || 0));
  });
  return map;
}

// Stock de un producto en una sede (fallback al total legacy si no hay filas)
export function stockIn(map, branchId, product, hasRows) {
  if (hasRows) return Number(map.get(`${branchId}:${product.id}`) || 0);
  return Number(product.stock || 0);
}

// Backfill local (una vez por negocio): todo el stock actual pertenece a
// la principal. Requiere el id de la principal (viene de BranchContext).
export async function ensureBranchStockBackfill(businessId, mainBranchId) {
  if (!businessId || !mainBranchId) return false;
  let flag = false;
  try {
    flag = localStorage.getItem(`mg-branch-backfill-${businessId}`) === '1';
  } catch { /* ignore */ }
  if (flag) return false;
  const existing = await db.branch_stock.where('business_id').equals(businessId).count();
  if (existing > 0) {
    try { localStorage.setItem(`mg-branch-backfill-${businessId}`, '1'); } catch { /* ignore */ }
    return false;
  }
  const products = await db.products.where('business_id').equals(businessId).toArray();
  if (products.length === 0) return false;
  const now = new Date().toISOString();
  await db.branch_stock.bulkPut(products.map((p) => ({
    id: branchStockId(mainBranchId, p.id),
    business_id: businessId,
    branch_id: mainBranchId,
    product_id: p.id,
    stock: Number(p.stock || 0),
    updated_at: now,
  })));
  try { localStorage.setItem(`mg-branch-backfill-${businessId}`, '1'); } catch { /* ignore */ }
  notifyBranchStock(businessId);
  return true;
}

// Fija el stock ABSOLUTO de un producto en una sede (ajusta el total por delta)
export async function setBranchStock(businessId, product, branchId, newBranchStock, { sync = true } = {}) {
  const now = new Date().toISOString();
  const current = await db.branch_stock.get(branchStockId(branchId, product.id));
  const oldBranch = current ? Number(current.stock || 0) : Number(product.stock || 0);
  const value = Math.max(0, Number(newBranchStock || 0));
  const delta = value - oldBranch;

  await db.transaction('rw', db.branch_stock, db.products, db.pending_operations, async () => {
    await db.branch_stock.put({
      id: branchStockId(branchId, product.id),
      business_id: businessId,
      branch_id: branchId,
      product_id: product.id,
      stock: value,
      updated_at: now,
    });
    const existing = await db.products.get(product.id);
    if (existing) {
      await db.products.update(product.id, {
        stock: Math.max(0, Number(existing.stock || 0) + delta),
        updated_at: now,
      });
    }
    if (sync) {
      await db.pending_operations.add(buildOutboxOp('SET_BRANCH_STOCK', {
        branch_id: branchId,
        product_id: product.id,
        stock: value,
      }, businessId));
    }
  });
  notifyBranchStock(businessId);
  try {
    if (sync) await refreshOutboxState(businessId);
  } catch { /* offline: queda encolado */ }
  return value;
}

// Suma stock a una sede (compras). Devuelve { branchStock, totalStock }.
export async function addBranchStock(businessId, product, branchId, qty) {
  const current = await db.branch_stock.get(branchStockId(branchId, product.id));
  const hasRows = (await db.branch_stock.where('business_id').equals(businessId).count()) > 0;
  const oldBranch = current ? Number(current.stock || 0) : (hasRows ? 0 : Number(product.stock || 0));
  return setBranchStock(businessId, { ...product, stock: oldBranch }, branchId, oldBranch + Number(qty || 0));
}

// Traspaso entre sedes: valida origen, mueve, registra historial y encola sync.
export async function transferStock(businessId, userId, product, fromBranchId, toBranchId, qty) {
  const amount = Math.floor(Number(qty || 0));
  if (!fromBranchId || !toBranchId || fromBranchId === toBranchId) {
    throw new Error('Elige dos sedes distintas.');
  }
  if (!(amount > 0)) throw new Error('Poné una cantidad mayor a 0.');

  const now = new Date().toISOString();

  await db.transaction('rw', db.branch_stock, db.products, db.pending_operations, async () => {
    const fromRow = await db.branch_stock.get(branchStockId(fromBranchId, product.id));
    const toRow = await db.branch_stock.get(branchStockId(toBranchId, product.id));
    const hasRows = (await db.branch_stock.where('business_id').equals(businessId).count()) > 0;
    const fromStock = fromRow ? Number(fromRow.stock || 0) : (hasRows ? 0 : Number(product.stock || 0));
    if (fromStock < amount) {
      throw new Error(`La sede origen solo tiene ${fromStock} und.`);
    }
    const toStock = toRow ? Number(toRow.stock || 0) : 0;

    await db.branch_stock.put({
      id: branchStockId(fromBranchId, product.id),
      business_id: businessId, branch_id: fromBranchId, product_id: product.id,
      stock: fromStock - amount, updated_at: now,
    });
    await db.branch_stock.put({
      id: branchStockId(toBranchId, product.id),
      business_id: businessId, branch_id: toBranchId, product_id: product.id,
      stock: toStock + amount, updated_at: now,
    });

    await db.pending_operations.add(buildOutboxOp('TRANSFER_STOCK', {
      transfer_id: generateUUID(),
      product_id: product.id,
      from_branch_id: fromBranchId,
      to_branch_id: toBranchId,
      quantity: amount,
      created_by: userId || null,
    }, businessId));
  });

  notifyBranchStock(businessId);
  try {
    await refreshOutboxState(businessId);
  } catch { /* offline */ }
}

export async function getTransfers(businessId, productId = null, limit = 20) {
  let col = db.transfers.where('business_id').equals(businessId);
  if (productId) col = col.and((t) => t.product_id === productId);
  const all = await col.toArray();
  return all
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit);
}

// Aplica una COMPRA: suma a la sede elegida y al total, con los demás
// campos de la ficha. Si aún no hay filas por sede (legado), solo total.
// fields = todo lo que updateProduct necesita MENOS stock.
export async function applyPurchaseStock({ businessId, product, branchId, qty, fields }) {
  const amount = Number(qty || 0);
  const globalCur = Number((await db.products.get(product.id))?.stock || 0);
  await updateProduct(product.id, {
    ...fields,
    stock: globalCur + amount,
    expectedStock: globalCur,
  });

  const hasRows = (await db.branch_stock.where('business_id').equals(businessId).count()) > 0;
  if (hasRows && branchId) {
    const row = await db.branch_stock.get(branchStockId(branchId, product.id));
    const newBranch = (row ? Number(row.stock || 0) : 0) + amount;
    const now = new Date().toISOString();
    await db.branch_stock.put({
      id: branchStockId(branchId, product.id),
      business_id: businessId,
      branch_id: branchId,
      product_id: product.id,
      stock: newBranch,
      updated_at: now,
    });
    await db.pending_operations.add(buildOutboxOp('SET_BRANCH_STOCK', {
      branch_id: branchId,
      product_id: product.id,
      stock: newBranch,
    }, businessId));
    notifyBranchStock(businessId);
    try {
      await refreshOutboxState(businessId);
    } catch { /* offline */ }
  }
}
