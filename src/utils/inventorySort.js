export function inventorySortValue(product, key, entries = {}, exits = {}) {
  switch (key) {
    case 'producto': return product.name || '';
    case 'categoria': return product.category || 'Otros';
    case 'stock': return Number(product.stock || 0);
    case 'precioUnitario': return Number(product.price || 0);
    case 'valorTotal': return Number(product.stock || 0) * Number(product.price || 0);
    case 'entradas': return Number(entries[product.id] || 0);
    case 'salidas': return Number(exits[product.id] || 0);
    default: return null;
  }
}

// Mismo criterio que DataTable: orden estable y descendente real.
export function sortInventoryRows(rows, sort, entries = {}, exits = {}) {
  if (!sort) return rows;
  const direction = sort.dir === 'desc' ? -1 : 1;
  const withValue = rows.map((row, index) => ({
    row,
    index,
    value: inventorySortValue(row, sort.key, entries, exits),
  }));
  withValue.sort((a, b) => {
    if (a.value == null && b.value == null) return a.index - b.index;
    if (a.value == null) return 1;
    if (b.value == null) return -1;
    const cmp = typeof a.value === 'number' && typeof b.value === 'number'
      ? a.value - b.value
      : String(a.value).localeCompare(String(b.value), 'es');
    if (cmp === 0) return a.index - b.index;
    return cmp * direction;
  });
  return withValue.map((w) => w.row);
}
