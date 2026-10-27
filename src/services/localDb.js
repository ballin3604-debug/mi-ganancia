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

// Version 8 schema: branch_stock + transfers (Fase 2: stock por sede).
// products.stock queda como TOTAL (caché mantenido por deltas).
db.version(8).stores({
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
  purchase_drafts: 'id, business_id, user_id',
  branch_stock: 'id, business_id, branch_id, product_id',
  transfers: 'id, business_id, product_id, created_at'
});

// Version 9 schema: adds sync_state, donde el sync incremental guarda sus
// watermarks por tabla (máximo updated_at/created_at ya visto del servidor).
// Sin esto no hay memoria de "hasta dónde bajé" y se volvería a bajar todo.
db.version(9).stores({
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
  purchase_drafts: 'id, business_id, user_id',
  branch_stock: 'id, business_id, branch_id, product_id',
  transfers: 'id, business_id, product_id, created_at',
  sync_state: 'business_id'
});

// Version 10 schema: enriches pending_operations with audit metadata
// (created_by, branch_id, device_id, origin, server_confirmed_at) and
// adds an index on status so the UI can quickly query pending/error/confirmed
// operations without scanning the whole table.
db.version(10).stores({
  products: 'id, name, category, stock, business_id',
  sales: 'id, payment_method, total, created_at, business_id, client_generated_id',
  sale_items: 'id, sale_id, product_id, business_id',
  debts: 'id, client_name, status, created_at, business_id',
  expenses: 'id, category, amount, created_at, business_id',
  replenishments: 'id, product_id, created_at, business_id',
  clientes: 'id, name, nit, business_id',
  pending_operations: 'id, operation_type, status, created_at, retry_count, last_attempt_at, business_id, created_by, branch_id, device_id, [status+business_id]',
  business_settings: 'business_id',
  profiles: 'id',
  cart_drafts: 'id, business_id, user_id',
  purchase_drafts: 'id, business_id, user_id',
  branch_stock: 'id, business_id, branch_id, product_id',
  transfers: 'id, business_id, product_id, created_at',
  sync_state: 'business_id'
}).upgrade(async (tx) => {
  // Backfill missing metadata for older pending_operations rows.
  await tx.table('pending_operations').toCollection().modify((op) => {
    if (op.status === undefined || op.status === null) op.status = 'pending';
    if (op.created_by === undefined) op.created_by = null;
    if (op.branch_id === undefined) op.branch_id = null;
    if (op.device_id === undefined) op.device_id = null;
    if (op.origin === undefined) op.origin = 'offline';
    if (op.server_confirmed_at === undefined) op.server_confirmed_at = null;
  });
});

// Version 11 schema: adds sync_status to sales so the UI can distinguish
// sales that are still local-only from those confirmed by the server.
db.version(11).stores({
  products: 'id, name, category, stock, business_id',
  sales: 'id, payment_method, total, created_at, business_id, client_generated_id, sync_status',
  sale_items: 'id, sale_id, product_id, business_id',
  debts: 'id, client_name, status, created_at, business_id',
  expenses: 'id, category, amount, created_at, business_id',
  replenishments: 'id, product_id, created_at, business_id',
  clientes: 'id, name, nit, business_id',
  pending_operations: 'id, operation_type, status, created_at, retry_count, last_attempt_at, business_id, created_by, branch_id, device_id, [status+business_id]',
  business_settings: 'business_id',
  profiles: 'id',
  cart_drafts: 'id, business_id, user_id',
  purchase_drafts: 'id, business_id, user_id',
  branch_stock: 'id, business_id, branch_id, product_id',
  transfers: 'id, business_id, product_id, created_at',
  sync_state: 'business_id'
}).upgrade(async (tx) => {
  // Existing sales created before this schema are assumed confirmed because
  // they were written by an older app version that deleted the outbox op
  // immediately after the server call. New sales will start as 'local'.
  await tx.table('sales').toCollection().modify((sale) => {
    if (sale.sync_status === undefined) sale.sync_status = 'confirmed';
  });
});

// Version 12 schema: cachea sedes y el negocio para que la app pueda arrancar
// y vender sin internet desde el primer uso posterior a la sincronización.
// Antes, BranchContext fallaba al no poder leer `branches` y los recibos
// perdían el nombre real del negocio.
db.version(12).stores({
  products: 'id, name, category, stock, business_id',
  sales: 'id, payment_method, total, created_at, business_id, client_generated_id, sync_status',
  sale_items: 'id, sale_id, product_id, business_id',
  debts: 'id, client_name, status, created_at, business_id',
  expenses: 'id, category, amount, created_at, business_id',
  replenishments: 'id, product_id, created_at, business_id',
  clientes: 'id, name, nit, business_id',
  pending_operations: 'id, operation_type, status, created_at, retry_count, last_attempt_at, business_id, created_by, branch_id, device_id, [status+business_id]',
  business_settings: 'business_id',
  profiles: 'id',
  cart_drafts: 'id, business_id, user_id',
  purchase_drafts: 'id, business_id, user_id',
  branch_stock: 'id, business_id, branch_id, product_id',
  transfers: 'id, business_id, product_id, created_at',
  sync_state: 'business_id',
  branches: 'id, business_id, is_main, name',
  businesses: 'id, name'
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
