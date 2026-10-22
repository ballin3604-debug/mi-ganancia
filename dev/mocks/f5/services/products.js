import { PRODUCTS } from '../data.js';

export function getProducts() {
  return Promise.resolve(PRODUCTS);
}

export function subscribeToProducts(businessId, callback) {
  callback(PRODUCTS);
  return () => {};
}

export function subscribeToReplenishments(businessId, callback) {
  callback([]);
  return () => {};
}
