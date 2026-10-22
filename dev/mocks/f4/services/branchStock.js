export function toStockMap(rows = []) {
  const map = new Map();
  rows.forEach((row) => {
    map.set(`${row.branch_id}:${row.product_id}`, row.stock);
  });
  return map;
}
