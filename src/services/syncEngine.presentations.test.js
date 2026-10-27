import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./localDb', async (importOriginal) => {
  const actual = await importOriginal();
  const isolatedDb = new actual.db.constructor('MiGananciaPresentationSyncTestDB');
  isolatedDb.version(1).stores({
    products: 'id, business_id, updated_at',
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
    branch_stock: 'id, business_id, branch_id, product_id, updated_at',
    transfers: 'id, business_id, product_id, created_at',
    sync_state: 'business_id',
  });
  return { ...actual, db: isolatedDb };
});

vi.mock('../config/environment', () => ({
  SUPABASE_URL: 'https://local-test.invalid',
  SUPABASE_ANON_KEY: 'synthetic-test-key',
}));

vi.mock('./supabaseClient', () => {
  const createdSaleIds = new Set();
  const rpcCalls = [];
  const salesUpdates = [];
  let serverStock = 30;
  const client = {
    rpc: vi.fn(async (name, args) => {
      rpcCalls.push({ name, args });
      if (name !== 'registrar_venta_presentaciones') {
        return { data: null, error: { code: 'PGRST202', message: 'unexpected rpc' } };
      }
      if (createdSaleIds.has(args.p_client_generated_id)) return { data: args.p_client_generated_id, error: null };
      createdSaleIds.add(args.p_client_generated_id);
      serverStock -= Number(args.p_items[0].quantity) * Number(args.p_items[0].presentation_factor);
      return { data: null, error: { code: 'ETIMEDOUT', message: 'response lost after commit' } };
    }),
    from: vi.fn((table) => {
      const result = { data: [], error: null };
      const query = {};
      ['select', 'eq', 'in', 'gte', 'gt', 'lte', 'lt', 'order'].forEach((method) => {
        query[method] = vi.fn(() => query);
      });
      query.range = vi.fn(async () => result);
      query.limit = vi.fn(async () => result);
      query.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
      query.single = vi.fn(async () => ({ data: null, error: null }));
      query.upsert = vi.fn(async () => result);
      query.insert = vi.fn(async () => result);
      query.update = vi.fn((values) => {
        if (table === 'sales') salesUpdates.push(values);
        return query;
      });
      query.delete = vi.fn(async () => result);
      return query;
    }),
    __rpcCalls: rpcCalls,
    __salesUpdates: salesUpdates,
    __serverStock: () => serverStock,
  };
  return {
    supabase: client,
    isSupabaseConfigured: true,
    supabaseConfigError: '',
    assertSupabase: () => client,
    __mockClient: client,
  };
});

import { db, generateUUID } from './localDb';
import { buildOutboxOp, triggerSync } from './syncEngine';

describe('sync de ventas con presentaciones', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200 })));
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('reintenta el mismo RPC con el mismo idempotency key sin descontar dos veces', async () => {
    const { __mockClient } = await import('./supabaseClient');
    const businessId = generateUUID();
    const userId = generateUUID();
    const saleId = generateUUID();
    const productId = generateUUID();
    const branchId = generateUUID();
    const now = new Date().toISOString();
    const payload = {
      business_id: businessId,
      client_name: 'Cliente de prueba',
      client_nit: '0',
      payment_method: 'cash',
      total: 65,
      p_items: [{
        product_id: productId,
        product_name: 'Bebida ficticia',
        product_brand: 'Marca ficticia',
        category: 'Cervezas',
        quantity: 1,
        price: 65,
        supplier_price: 5,
        presentation_id: 'sixpack',
        presentation: 'Six-pack x6',
        presentation_factor: 6,
        variant: '',
      }],
      p_factors: [],
      extraFields: { branchId, montoEfectivo: 40, montoQR: 25 },
      client_generated_id: saleId,
      item_count: 6,
      seller_name: 'Cajero',
      created_by: userId,
    };
    const op = buildOutboxOp('REGISTER_PRESENTATION_SALE', payload, businessId, { userId, branchId });
    await db.products.add({ id: productId, business_id: businessId, name: 'Bebida ficticia', stock: 24, updated_at: now });
    await db.sales.add({
      id: saleId,
      business_id: businessId,
      total: 65,
      created_at: now,
      sync_status: 'local',
    });
    await db.pending_operations.add(op);

    await triggerSync(businessId);
    let pending = await db.pending_operations.get(op.id);
    expect(pending.status).toBe('pending');
    expect(pending.retry_count).toBe(1);
    expect(__mockClient.__serverStock()).toBe(24);

    await db.pending_operations.update(op.id, { retry_count: 0, last_attempt_at: null, status: 'pending' });
    await triggerSync(businessId);

    expect(__mockClient.__rpcCalls).toHaveLength(2);
    expect(__mockClient.__rpcCalls.map((call) => call.name)).toEqual([
      'registrar_venta_presentaciones',
      'registrar_venta_presentaciones',
    ]);
    expect(__mockClient.__rpcCalls[0].args.p_client_generated_id).toBe(saleId);
    expect(__mockClient.__rpcCalls[1].args.p_client_generated_id).toBe(saleId);
    expect(__mockClient.__salesUpdates).toEqual([
      { monto_efectivo: 40, monto_qr: 25 },
    ]);
    expect(__mockClient.__serverStock()).toBe(24);
    expect(await db.pending_operations.get(op.id)).toBeUndefined();
    expect((await db.products.get(productId)).stock).toBe(24);
    expect((await db.sales.get(saleId)).sync_status).toBe('confirmed');
  });
});
