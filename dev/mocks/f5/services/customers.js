import { CUSTOMERS } from '../data.js';

export function getCustomers() {
  return Promise.resolve(CUSTOMERS);
}

export function addCustomer() {
  return Promise.resolve('cliente-demo');
}
