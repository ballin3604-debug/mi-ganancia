function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function asDate(value) {
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function buildMonthlyPerformance(sales, items, expenses, branchId = 'all', mainBranchId = null) {
  const buckets = new Map();
  const saleInfo = {};
  const inBranch = (id) => branchId === 'all' || (id || mainBranchId) === branchId;

  (sales || []).forEach((sale) => {
    const date = asDate(sale.createdAt || sale.created_at);
    if (!date) return;
    const branch = sale.branchId || sale.branch_id || null;
    saleInfo[sale.id] = { date, branch };
    if (!inBranch(branch)) return;

    const key = monthKey(date);
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        label: date.toLocaleDateString('es-BO', { month: 'short' }).replace('.', ''),
        income: 0,
        cogs: 0,
        exp: 0,
      });
    }
    if (sale.paymentMethod !== 'fiado' && sale.payment_method !== 'fiado') {
      buckets.get(key).income += Number(sale.total || 0);
    }
  });

  (items || []).forEach((item) => {
    const info = saleInfo[item.saleId || item.sale_id];
    if (!info || !inBranch(info.branch)) return;
    const bucket = buckets.get(monthKey(info.date));
    if (!bucket) return;
    const cost = item.supplier_price ?? item.supplierPrice;
    if (cost === null || cost === undefined) return;
    const factor = Number(item.presentation_factor ?? item.presentationFactor ?? 1);
    bucket.cogs += Number(cost) * Number(item.quantity || 0) * factor;
  });

  (expenses || []).forEach((expense) => {
    const date = asDate(expense.createdAt || expense.created_at);
    if (!date || !inBranch(expense.branch_id || expense.branchId)) return;
    const bucket = buckets.get(monthKey(date));
    if (bucket) bucket.exp += Number(expense.amount || 0);
  });

  return [...buckets.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((bucket) => ({ ...bucket, net: bucket.income - bucket.cogs - bucket.exp }));
}
