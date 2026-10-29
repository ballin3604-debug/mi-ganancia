import { db, generateUUID } from './localDb';
import { buildOutboxOp, refreshOutboxState } from './syncEngine';

export const EXPENSE_CATEGORIES = [
  'Mercadería',
  'Servicios básicos',
  'Alquiler',
  'Transporte',
  'Empleados',
  'Limpieza',
  'Otros',
];

export const EXPENSE_PAYMENT_METHODS = ['efectivo', 'qr', 'transferencia', 'tarjeta'];

export const EXPENSE_PAYMENT_LABELS = {
  efectivo: 'Efectivo (Caja)',
  qr: 'QR Simple',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
};

function mapExpense(e) {
  if (!e) return e;
  return {
    ...e,
    expenseType: e.expense_type,
    createdAt: e.created_at ? { toDate: () => new Date(e.created_at) } : null,
  };
}

const expenseListeners = new Set();
const incomeListeners = new Set();

function notifyExpenseChanges(businessId) {
  getAllExpenses(businessId).then((exps) => {
    expenseListeners.forEach((callback) => callback(exps));
  });
}

export function notifyIncomeChanges(businessId) {
  getThisMonthIncome(businessId).then((total) => {
    incomeListeners.forEach((callback) => callback(total));
  });
}

export async function addExpense(businessId, data) {
  const id = generateUUID();
  const now = new Date().toISOString();

  const localExpense = {
    id,
    business_id: businessId,
    description: data.description.trim(),
    supplier: (data.supplier || '').trim(),
    amount: Number(data.amount),
    category: data.category || 'Otros',
    expense_type: data.expenseType || data.expense_type || 'daily',
    payment_method: data.paymentMethod || data.payment_method || 'efectivo',
    invoice_number: (data.invoiceNumber || data.invoice_number || '').trim(),
    notes: (data.notes || '').trim(),
    created_at: now,
  };

  const outboxOp = buildOutboxOp('ADD_EXPENSE', localExpense, businessId);
  await db.transaction('rw', db.expenses, db.pending_operations, async () => {
    await db.expenses.put(localExpense);
    await db.pending_operations.add(outboxOp);
  });
  notifyExpenseChanges(businessId);
  await refreshOutboxState(businessId);

  return mapExpense(localExpense);
}

export async function updateExpense(expenseId, patch) {
  const existing = await db.expenses.get(expenseId);
  if (!existing) throw new Error('Egreso no encontrado.');

  const next = {
    ...existing,
    ...(patch.description !== undefined ? { description: String(patch.description).trim().slice(0, 100) } : {}),
    ...(patch.supplier !== undefined ? { supplier: String(patch.supplier).trim().slice(0, 80) } : {}),
    ...(patch.amount !== undefined ? { amount: Number(patch.amount) } : {}),
    ...(patch.category !== undefined ? { category: patch.category } : {}),
    ...(patch.expenseType !== undefined || patch.expense_type !== undefined
      ? { expense_type: patch.expenseType || patch.expense_type } : {}),
    ...(patch.paymentMethod !== undefined || patch.payment_method !== undefined
      ? { payment_method: patch.paymentMethod || patch.payment_method } : {}),
    ...(patch.invoiceNumber !== undefined || patch.invoice_number !== undefined
      ? { invoice_number: String(patch.invoiceNumber ?? patch.invoice_number ?? '').trim().slice(0, 40) } : {}),
    ...(patch.notes !== undefined ? { notes: String(patch.notes).trim().slice(0, 200) } : {}),
  };

  if (!next.description || !(Number(next.amount) > 0)) {
    throw new Error('Completa la descripción y un monto mayor a 0.');
  }

  const outboxOp = buildOutboxOp('UPDATE_EXPENSE', next, existing.business_id);
  await db.transaction('rw', db.expenses, db.pending_operations, async () => {
    await db.expenses.put(next);
    await db.pending_operations.add(outboxOp);
  });
  notifyExpenseChanges(existing.business_id);
  await refreshOutboxState(existing.business_id);

  return mapExpense(next);
}

export function exportExpensesCsv(expenses, businessName = 'MiNegocio') {
  const header = 'Fecha,Concepto,Categoria,Tipo,Proveedor,Comprobante,Metodo,Monto(Bs),Notas';
  const lines = (expenses || []).map((e) => {
    const d = e.createdAt?.toDate ? e.createdAt.toDate() : (e.created_at ? new Date(e.created_at) : new Date());
    const fecha = Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-BO');
    const tipo = (e.expense_type || e.expenseType) === 'fixed' ? 'Fijo' : 'Diario';
    const cells = [
      fecha, e.description || '', e.category || '', tipo,
      e.supplier || '', e.invoice_number || '', e.payment_method || 'efectivo',
      Number(e.amount || 0).toFixed(2), (e.notes || '').replace(/\n/g, ' '),
    ];
    return cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',');
  });
  const csv = [header, ...lines].join('\n');
  const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Egresos_${String(businessName).replace(/\s+/g, '')}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function getThisMonthExpenses(businessId) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const list = await db.expenses.where('business_id').equals(businessId).toArray();
  return list
    .filter((e) => new Date(e.created_at) >= startOfMonth)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(mapExpense);
}

export async function getRecentExpenses(businessId, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const list = await db.expenses.where('business_id').equals(businessId).toArray();
  return list
    .filter((e) => new Date(e.created_at) >= since)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(mapExpense);
}

export async function deleteExpense(expenseId) {
  const existing = await db.expenses.get(expenseId);
  if (!existing) return;

  const outboxOp = buildOutboxOp('DELETE_EXPENSE', { id: expenseId }, existing.business_id);
  await db.transaction('rw', db.expenses, db.pending_operations, async () => {
    await db.expenses.delete(expenseId);
    await db.pending_operations.add(outboxOp);
  });
  notifyExpenseChanges(existing.business_id);
  await refreshOutboxState(existing.business_id);
}

export async function getThisMonthIncome(businessId) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const sales = await db.sales.where('business_id').equals(businessId).toArray();
  const monthSales = sales.filter((s) => s.status !== 'cancelled' && new Date(s.created_at) >= startOfMonth);
  return monthSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
}

export function subscribeToThisMonthIncome(businessId, callback) {
  getThisMonthIncome(businessId).then(callback).catch(console.error);
  incomeListeners.add(callback);
  return () => {
    incomeListeners.delete(callback);
  };
}

export async function getAllExpenses(businessId) {
  const list = await db.expenses.where('business_id').equals(businessId).toArray();
  return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(mapExpense);
}

export function subscribeToExpenses(businessId, callback) {
  getAllExpenses(businessId).then(callback).catch(console.error);
  expenseListeners.add(callback);
  return () => {
    expenseListeners.delete(callback);
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener('tuganancia-cache-synced', (e) => {
    if (e.detail && e.detail.businessId) {
      notifyExpenseChanges(e.detail.businessId);
      notifyIncomeChanges(e.detail.businessId);
    }
  });
}
