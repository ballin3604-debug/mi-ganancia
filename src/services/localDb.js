import Dexie from 'dexie';

export const db = new Dexie('MiGananciaDB');

// Version 1 schema
db.version(1).stores({
  products: 'id, name, category, stock, business_id',
  sales: 'id, payment_method, total, created_at, business_id, client_generated_id',
  sale_items: 'id, sale_id, product_id, business_id',
  debts: 'id, client_name, status, created_at, business_id',
  expenses: 'id, category, amount, created_at, business_id',
  replenishments: 'id, product_id, created_at, business_id',
  clientes: 'id, name, nit, business_id',
  pending_operations: 'id, operation_type, status, created_at, retry_count, last_attempt_at'
});

// Version 2 schema: adds business_settings table
db.version(2).stores({
  products: 'id, name, category, stock, business_id',
  sales: 'id, payment_method, total, created_at, business_id, client_generated_id',
  sale_items: 'id, sale_id, product_id, business_id',
  debts: 'id, client_name, status, created_at, business_id',
  expenses: 'id, category, amount, created_at, business_id',
  replenishments: 'id, product_id, created_at, business_id',
  clientes: 'id, name, nit, business_id',
  pending_operations: 'id, operation_type, status, created_at, retry_count, last_attempt_at',
  business_settings: 'business_id'
});

// Version 3 schema: adds profiles table for offline profile caching
db.version(3).stores({
  products: 'id, name, category, stock, business_id',
  sales: 'id, payment_method, total, created_at, business_id, client_generated_id',
  sale_items: 'id, sale_id, product_id, business_id',
  debts: 'id, client_name, status, created_at, business_id',
  expenses: 'id, category, amount, created_at, business_id',
  replenishments: 'id, product_id, created_at, business_id',
  clientes: 'id, name, nit, business_id',
  pending_operations: 'id, operation_type, status, created_at, retry_count, last_attempt_at',
  business_settings: 'business_id',
  profiles: 'id'
});

// Version 4 schema: adds cart_drafts table for in-progress sale recovery
db.version(4).stores({
  products: 'id, name, category, stock, business_id',
  sales: 'id, payment_method, total, created_at, business_id, client_generated_id',
  sale_items: 'id, sale_id, product_id, business_id',
  debts: 'id, client_name, status, created_at, business_id',
  expenses: 'id, category, amount, created_at, business_id',
  replenishments: 'id, product_id, created_at, business_id',
  clientes: 'id, name, nit, business_id',
  pending_operations: 'id, operation_type, status, created_at, retry_count, last_attempt_at',
  business_settings: 'business_id',
  profiles: 'id',
  cart_drafts: 'id, business_id, user_id'
});

// Version 5 schema: scopes pending_operations by business_id (was unscoped —
// on a shared device with more than one business, queued writes/errors from
// one business could be processed or shown under another business's session)
db.version(5).stores({
  products: 'id, name, category, stock, business_id',
  sales: 'id, payment_method, total, created_at, business_id, client_generated_id',
  sale_items: 'id, sale_id, product_id, business_id',
  debts: 'id, client_name, status, created_at, business_id',
  expenses: 'id, category, amount, created_at, business_id',
  replenishments: 'id, product_id, created_at, business_id',
  clientes: 'id, name, nit, business_id',
  pending_operations: 'id, operation_type, status, created_at, retry_count, last_attempt_at, business_id',
  business_settings: 'business_id',
  profiles: 'id',
  cart_drafts: 'id, business_id, user_id'
});

// Version 6 schema: adds purchase_drafts table, análogo a cart_drafts pero
// para una compra en curso (Compras) — antes, salir de la app a mitad de
// registrar una compra (p.ej. abrir la calculadora del celular) perdía todo
// lo tipeado porque nada se persistía hasta el submit final.
db.version(6).stores({
  products: 'id, name, category, stock, business_id',
  sales: 'id, payment_method, total, created_at, business_id, client_generated_id',
  sale_items: 'id, sale_id, product_id, business_id',
  debts: 'id, client_name, status, created_at, business_id',
  expenses: 'id, category, amount, created_at, business_id',
  replenishments: 'id, product_id, created_at, business_id',
  clientes: 'id, name, nit, business_id',
  pending_operations: 'id, operation_type, status, created_at, retry_count, last_attempt_at, business_id',
  business_settings: 'business_id',
  profiles: 'id',
  cart_drafts: 'id, business_id, user_id',
  purchase_drafts: 'id, business_id, user_id'
});

export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers or insecure contexts
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
