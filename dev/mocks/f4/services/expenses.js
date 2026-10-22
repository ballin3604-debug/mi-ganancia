import { EXPENSES } from '../data.js';

export function subscribeToExpenses(businessId, callback) {
  callback(EXPENSES);
  return () => {};
}

export function getRecentExpenses() {
  return Promise.resolve(EXPENSES);
}
