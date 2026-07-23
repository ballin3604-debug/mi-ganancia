import { db, generateUUID } from './localDb';
import { buildOutboxOp, refreshOutboxState } from './syncEngine';

export const EXPENSE_CATEGORIES = [
  'Mercadería',
  'Servicios básicos',
  'Alquiler',
  'Transporte',
  'Empleados',
  'Otros',
];

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
    expense_type: data.expenseType || 'daily',
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
  const monthSales = sales.filter((s) => new Date(s.created_at) >= startOfMonth);
  return monthSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
}

export function subscribeToThisMonthIncome(businessId, callback) {
  getThisMonthIncome(businessId).then(callback).catch(console.error);
  incomeListeners.add(callback);
  return () => {
    incomeListeners.delete(callback);
  };
}

async function getAllExpenses(businessId) {
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
