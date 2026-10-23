export function branchStockId(branchId, productId) {
  return `${branchId}:${productId}`;
}

export function subscribeBranchStock(businessId, callback) {
  callback([]);
  return () => {};
}

export function notifyBranchStock() {}

export async function getBranchStocks() {
  return [];
}

export function toStockMap(rows = []) {
  return rows.reduce((map, row) => {
    map[`${row.branch_id}:${row.product_id}`] = row.stock;
    return map;
  }, {});
}

export function stockIn(map, branchId, product, hasRows) {
  if (!hasRows) return product.stock || 0;
  return map[`${branchId}:${product.id}`] ?? product.stock ?? 0;
}

export async function ensureBranchStockBackfill() {
  return true;
}

export async function setBranchStock() {
  return true;
}

export async function addBranchStock() {
  return true;
}

export async function transferStock() {
  return true;
}

export async function getTransfers() {
  return [];
}

export async function applyPurchaseStock() {
  return true;
}
