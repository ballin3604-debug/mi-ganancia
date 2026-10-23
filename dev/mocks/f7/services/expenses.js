import { EXPENSES } from '../data.js';

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

export function notifyIncomeChanges() {}

export async function addExpense(businessId, data) {
  return { id: `e-${Date.now()}`, ...data };
}

export async function updateExpense(expenseId, patch) {
  return { id: expenseId, ...patch };
}

export function exportExpensesCsv() {
  return 'csv-demo';
}

export async function getThisMonthExpenses() {
  return EXPENSES;
}

export async function getRecentExpenses() {
  return EXPENSES;
}

export async function deleteExpense() {
  return true;
}

export async function getThisMonthIncome() {
  return 12450;
}

export function subscribeToThisMonthIncome(businessId, callback) {
  callback(12450);
  return () => {};
}

export function subscribeToExpenses(businessId, callback) {
  callback(EXPENSES);
  return () => {};
}
