export const STOCK_ROWS = [
  { branch_id: 'b-centro', product_id: 'p1', stock: 4 },
  { branch_id: 'b-centro', product_id: 'p2', stock: 24 },
  { branch_id: 'b-centro', product_id: 'p3', stock: 3 },
  { branch_id: 'b-centro', product_id: 'p4', stock: 6 },
  { branch_id: 'b-centro', product_id: 'p5', stock: 18 },
  { branch_id: 'b-mercado', product_id: 'p1', stock: 8 },
  { branch_id: 'b-mercado', product_id: 'p2', stock: 12 },
  { branch_id: 'b-deposito', product_id: 'p2', stock: 60 },
  { branch_id: 'b-deposito', product_id: 'p5', stock: 30 },
];

export function branchStockId(branchId, productId) {
  return `${branchId}:${productId}`;
}

export function subscribeBranchStock(businessId, callback) {
  callback(STOCK_ROWS);
  return () => {};
}

export function notifyBranchStock() {}

export async function getBranchStocks() {
  return STOCK_ROWS;
}

export function toStockMap(rows = []) {
  const map = new Map();
  rows.forEach((row) => map.set(`${row.branch_id}:${row.product_id}`, Number(row.stock || 0)));
  return map;
}

export function stockIn(map, branchId, product, hasRows) {
  if (!hasRows) return product.stock || 0;
  return Number(map.get(`${branchId}:${product.id}`) || 0);
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
