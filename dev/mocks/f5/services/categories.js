import { CATEGORIES } from '../data.js';

export function subscribeToCategories(businessId, callback) {
  callback(CATEGORIES);
  return () => {};
}
