import { SALES, ITEMS } from '../data.js';

export function subscribeToSales(businessId, callback) {
  callback(SALES);
  return () => {};
}

export function subscribeToSaleItems(businessId, callback) {
  callback(ITEMS);
  return () => {};
}
