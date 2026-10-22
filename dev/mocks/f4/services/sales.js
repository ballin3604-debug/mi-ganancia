import { ALL_SALES, TODAY_SALES, SALE_ITEMS } from '../data.js';

export function subscribeToTodaySales(businessId, callback) {
  callback(TODAY_SALES);
  return () => {};
}

export function getSaleItems(businessId, saleId) {
  return Promise.resolve(SALE_ITEMS[saleId] || []);
}

export function getSaleItemsAll() {
  return Promise.resolve(Object.values(SALE_ITEMS).flat());
}

export function getSales() {
  return Promise.resolve(ALL_SALES);
}

export function exportDetailedCSV() {
  return Promise.resolve();
}
