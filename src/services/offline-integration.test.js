import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db, generateUUID } from './localDb';
import { registerSale, getSaleById, getSaleItems } from './sales';
import { getPendingOperations, triggerSync, retryOperation, initializeSyncEngine, waitForSyncIdle } from './syncEngine';

vi.mock('../config/environment', () => ({
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_ANON_KEY: 'test-anon-key',
}));

// Simulated Supabase server state and client.
// Defined inside the factory because vi.mock is hoisted.
vi.mock('./supabaseClient', () => {
  const createdSaleIds = new Set();
  let rpcBehavior = { type: 'success' };
  const rpcCalls = [];

  function chain(returnValue = { data: [], error: null }) {
    const self = {
      ...returnValue,
      eq: vi.fn(() => self),
      in: vi.fn(() => self),
      gte: vi.fn(() => self),
      gt: vi.fn(() => self),
      lte: vi.fn(() => self),
      lt: vi.fn(() => self),
      order: vi.fn(() => self),
      range: vi.fn(() => Promise.resolve(returnValue)),
      limit: vi.fn(() => Promise.resolve(returnValue)),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      upsert: vi.fn(() => Promise.resolve(returnValue)),
      insert: vi.fn(() => Promise.resolve(returnValue)),
      update: vi.fn(() => self),
      delete: vi.fn(() => Promise.resolve(returnValue)),
    };
    return self;
  }

  function createMockClient() {
    return {
      rpc: vi.fn((name, args) => {
        rpcCalls.push({ name, args });

        if (name !== 'registrar_venta' && name !== 'registrar_venta_presentaciones') {
          return Promise.resolve({ data: null, error: null });
        }

        const saleId = args.p_client_generated_id;

        if (rpcBehavior.type === 'error') {
          return Promise.resolve({ data: null, error: rpcBehavior.error });
        }

        if (rpcBehavior.type === 'missing-function') {
          return Promise.resolve({
            data: null,
            error: { code: 'PGRST202', message: 'Could not find the function public.registrar_venta_presentaciones' },
          });
        }

        if (rpcBehavior.type === 'timeout-after-create') {
          // Server creates the sale but the response never reaches the client.
          createdSaleIds.add(saleId);
          return Promise.resolve({ data: null, error: { message: 'Timeout', code: 'ETIMEDOUT' } });
        }

        if (rpcBehavior.type === 'success') {
          createdSaleIds.add(saleId);
          return Promise.resolve({ data: null, error: null });
        }

        return Promise.resolve({ data: null, error: { message: 'Unexpected mock behavior', code: 'MOCK' } });
      }),
      from: vi.fn((table) => {
        if (table === 'sales') {
          return {
            select: vi.fn((cols) => ({
              eq: vi.fn((col, id) => ({
                maybeSingle: vi.fn(() => {
                  const exists = createdSaleIds.has(id);
                  return Promise.resolve(exists ? { data: { id }, error: null } : { data: null, error: null });
                }),
                limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
                gte: vi.fn(() => chain()),
                order: vi.fn(() => chain()),
                range: vi.fn(() => Promise.resolve({ data: [], error: null })),
              })),
              in: vi.fn(() => chain()),
              gte: vi.fn(() => chain()),
              order: vi.fn(() => chain()),
              range: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ error: null })),
            })),
            insert: vi.fn(() => Promise.resolve({ error: null })),
            delete: vi.fn(() => Promise.resolve({ error: null })),
            upsert: vi.fn(() => Promise.resolve({ error: null })),
          };
        }
        return {
          select: vi.fn(() => chain()),
          insert: vi.fn(() => Promise.resolve({ error: null })),
          update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
          upsert: vi.fn(() => Promise.resolve({ error: null })),
          delete: vi.fn(() => Promise.resolve({ error: null })),
        };
      }),
      auth: {
        getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
        onAuthStateChange: vi.fn(() => ({ subscription: { unsubscribe: vi.fn() } })),
      },
      channel: vi.fn(() => ({
        on: vi.fn(function () { return this; }),
        subscribe: vi.fn(() => {}),
      })),
      removeChannel: vi.fn(),
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(() => Promise.resolve({ error: null })),
          getPublicUrl: vi.fn(() => ({ data: { publicUrl: '' } })),
        })),
      },
      __createdSaleIds: createdSaleIds,
      __rpcCalls: rpcCalls,
      __setRpcBehavior: (behavior) => { rpcBehavior = behavior; },
      __getRpcBehavior: () => rpcBehavior,
      __clear: () => {
        createdSaleIds.clear();
        rpcCalls.length = 0;
        rpcBehavior = { type: 'success' };
      },
    };
  }

  const mockClient = createMockClient();
  return {
    supabase: mockClient,
    isSupabaseConfigured: true,
    supabaseConfigError: '',
    assertSupabase: () => mockClient,
    __mockClient: mockClient,
  };
});

function flushPromises(ms = 100) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeProduct(overrides = {}) {
  return {
    id: generateUUID(),
    business_id: overrides.business_id,
    name: 'Producto de prueba',
    price: 10,
    stock: 100,
    category: 'Otros',
    supplier_price: 5,
    ...overrides,
  };
}

async function getMockClient() {
  const { __mockClient } = await import('./supabaseClient');
  return __mockClient;
}

describe('offline → online integration', () => {
  beforeEach(async () => {
    const mockClient = await getMockClient();
    mockClient.__clear();

    await db.delete();
    await db.open();

    vi.clearAllMocks();
    vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200 })));
  });

  afterEach(async () => {
    await waitForSyncIdle();
    vi.unstubAllEnvs();
  });

  it('saves sale, items and pending op in the same local transaction', async () => {
    const mockClient = await getMockClient();
    mockClient.__setRpcBehavior({ type: 'error', error: { message: 'Failed to fetch', code: 'ERR_NETWORK' } });

    const businessId = generateUUID();
    const userId = generateUUID();
    const product = makeProduct({ business_id: businessId });
    await db.products.add(product);

    const saleId = await registerSale(
      businessId,
      userId,
      [{ product, quantity: 2, factor: 1, unitPrice: product.price }],
      'Cliente Offline',
      '111',
      'cash',
      'Vendedor Test',
      {}
    );

    await waitForSyncIdle();

    const sale = await getSaleById(businessId, saleId);
    expect(sale.sync_status).toBe('local');
    expect(sale.total).toBe(20);

    const items = await getSaleItems(businessId, saleId);
    expect(items.length).toBe(1);
    expect(items[0].quantity).toBe(2);

    const pending = await getPendingOperations(businessId, 'pending');
    expect(pending.length).toBe(1);
    expect(pending[0].operation_type).toBe('REGISTER_SALE');
    expect(pending[0].payload.client_generated_id).toBe(saleId);

    // Stock was decremented within the same transaction.
    const storedProduct = await db.products.get(product.id);
    expect(storedProduct.stock).toBe(98);
  });

  it('keeps the operation pending if the network fails during send', async () => {
    const mockClient = await getMockClient();
    mockClient.__setRpcBehavior({ type: 'error', error: { message: 'Failed to fetch', code: 'ERR_NETWORK' } });

    const businessId = generateUUID();
    const userId = generateUUID();
    const product = makeProduct({ business_id: businessId });
    await db.products.add(product);

    const saleId = await registerSale(
      businessId,
      userId,
      [{ product, quantity: 1, factor: 1, unitPrice: product.price }],
      '',
      '',
      'cash',
      '',
      {}
    );

    await waitForSyncIdle();
    await triggerSync(businessId);

    const sale = await getSaleById(businessId, saleId);
    expect(sale.sync_status).toBe('local');

    const pending = await getPendingOperations(businessId);
    expect(pending.length).toBe(1);
    expect(pending[0].status).toBe('pending');
    expect(pending[0].retry_count).toBe(1);
  });

  it('confirms the sale after the retry backoff expires', async () => {
    const mockClient = await getMockClient();
    mockClient.__setRpcBehavior({ type: 'error', error: { message: 'Failed to fetch', code: 'ERR_NETWORK' } });

    const businessId = generateUUID();
    const userId = generateUUID();
    const product = makeProduct({ business_id: businessId });
    await db.products.add(product);

    const saleId = await registerSale(
      businessId,
      userId,
      [{ product, quantity: 1, factor: 1, unitPrice: product.price }],
      '',
      '',
      'cash',
      '',
      {}
    );

    await waitForSyncIdle();

    let pending = await getPendingOperations(businessId, 'pending');
    expect(pending.length).toBe(1);
    expect(pending[0].retry_count).toBe(1);
    const lastAttempt = new Date(pending[0].last_attempt_at).getTime();

    // Backoff for retry_count=1 is 2^1 * 10 = 20 seconds.
    // Advance time without fake timers so Dexie transactions keep working.
    const afterBackoff = lastAttempt + 25_000;
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(afterBackoff);

    try {
      // Reconnect: server now succeeds.
      mockClient.__setRpcBehavior({ type: 'success' });
      await triggerSync(businessId);

      const sale = await getSaleById(businessId, saleId);
      expect(sale.sync_status).toBe('confirmed');

      pending = await getPendingOperations(businessId, 'pending');
      expect(pending.length).toBe(0);
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it('does not duplicate the sale when the server response is lost', async () => {
    const mockClient = await getMockClient();
    mockClient.__setRpcBehavior({ type: 'timeout-after-create' });

    const businessId = generateUUID();
    const userId = generateUUID();
    const product = makeProduct({ business_id: businessId });
    await db.products.add(product);

    const saleId = await registerSale(
      businessId,
      userId,
      [{ product, quantity: 1, factor: 1, unitPrice: product.price }],
      '',
      '',
      'cash',
      '',
      {}
    );

    await waitForSyncIdle();

    // First sync: server creates sale but response is lost.
    await triggerSync(businessId);

    let sale = await getSaleById(businessId, saleId);
    expect(sale.sync_status).toBe('local');

    // Retry (bypass backoff via the legitimate retry action).
    let pending = await getPendingOperations(businessId, 'pending');
    expect(pending.length).toBe(1);

    // Server now responds OK and the existing sale is detected.
    mockClient.__setRpcBehavior({ type: 'success' });
    await retryOperation(pending[0].id, businessId);
    await waitForSyncIdle();

    sale = await getSaleById(businessId, saleId);
    expect(sale.sync_status).toBe('confirmed');

    // Only one server-side creation attempt should have been made.
    const registrarCalls = mockClient.__rpcCalls.filter((c) => c.name === 'registrar_venta');
    expect(registrarCalls.length).toBe(1);
  });

  it('reintenta una venta configurable con el mismo id y sin volver a descontar stock local', async () => {
    const mockClient = await getMockClient();
    mockClient.__setRpcBehavior({ type: 'timeout-after-create' });

    const businessId = generateUUID();
    const userId = generateUUID();
    const product = makeProduct({
      business_id: businessId,
      stock: 20,
      presentations: [
        { id: 'unit', name: 'Unidad', factor: 1, price: 10, isBase: true },
        { id: 'pack', name: 'Paquete', factor: 6, price: 55, isBase: false },
      ],
    });
    await db.products.add(product);

    const saleId = await registerSale(
      businessId,
      userId,
      [{
        product,
        quantity: 1,
        presentationId: 'pack',
        presId: 'configured',
        variant: '',
        unitPrice: 55,
        factor: 6,
        presLabel: 'Paquete x6',
      }],
      '', '', 'cash', '', {},
    );
    await waitForSyncIdle();

    let pending = await getPendingOperations(businessId, 'pending');
    expect(pending).toHaveLength(1);
    expect(pending[0].operation_type).toBe('REGISTER_PRESENTATION_SALE');
    expect((await db.products.get(product.id)).stock).toBe(14);

    mockClient.__setRpcBehavior({ type: 'success' });
    await retryOperation(pending[0].id, businessId);
    await waitForSyncIdle();

    pending = await getPendingOperations(businessId, 'pending');
    const sale = await getSaleById(businessId, saleId);
    const calls = mockClient.__rpcCalls.filter((call) => call.name === 'registrar_venta_presentaciones');
    expect(calls).toHaveLength(2);
    expect(calls.map((call) => call.args.p_client_generated_id)).toEqual([saleId, saleId]);
    expect(sale.sync_status).toBe('confirmed');
    expect(pending).toHaveLength(0);
    expect(await db.sales.where('id').equals(saleId).count()).toBe(1);
    expect((await db.products.get(product.id)).stock).toBe(14);
  });

  it('mantiene pendiente la venta configurable si el servidor aún no tiene el RPC nuevo', async () => {
    const mockClient = await getMockClient();
    mockClient.__setRpcBehavior({ type: 'missing-function' });

    const businessId = generateUUID();
    const product = makeProduct({
      business_id: businessId,
      presentations: [
        { id: 'unit', name: 'Unidad', factor: 1, price: 10, isBase: true },
        { id: 'pack', name: 'Paquete', factor: 6, price: 55, isBase: false },
      ],
    });
    await db.products.add(product);

    const saleId = await registerSale(businessId, generateUUID(), [{
      product,
      quantity: 1,
      presentationId: 'pack',
      presId: 'configured',
      variant: '',
      unitPrice: 55,
      factor: 6,
      presLabel: 'Paquete x6',
    }]);
    await waitForSyncIdle();

    const [pending] = await getPendingOperations(businessId, 'pending');
    expect(pending.payload.client_generated_id).toBe(saleId);
    expect(pending.retry_count).toBe(1);
    expect(await getPendingOperations(businessId, 'error')).toHaveLength(0);
    expect((await getSaleById(businessId, saleId)).sync_status).toBe('local');
    expect((await db.products.get(product.id)).stock).toBe(94);
  });

  it('only marks confirmed after a real server confirmation', async () => {
    const mockClient = await getMockClient();
    mockClient.__setRpcBehavior({ type: 'error', error: { message: 'Failed to fetch', code: 'ERR_NETWORK' } });

    const businessId = generateUUID();
    const userId = generateUUID();
    const product = makeProduct({ business_id: businessId });
    await db.products.add(product);

    const saleId = await registerSale(
      businessId,
      userId,
      [{ product, quantity: 1, factor: 1, unitPrice: product.price }],
      '',
      '',
      'cash',
      '',
      {}
    );

    await waitForSyncIdle();

    let sale = await getSaleById(businessId, saleId);
    expect(sale.sync_status).toBe('local');

    // Reconnect but server still errors.
    await triggerSync(businessId);

    sale = await getSaleById(businessId, saleId);
    expect(sale.sync_status).toBe('local');

    // Now server succeeds.
    mockClient.__setRpcBehavior({ type: 'success' });
    const pending = await getPendingOperations(businessId, 'pending');
    await retryOperation(pending[0].id, businessId);
    await waitForSyncIdle();

    sale = await getSaleById(businessId, saleId);
    expect(sale.sync_status).toBe('confirmed');
  });

  it('moves permanent errors to error status and stops retrying', async () => {
    const mockClient = await getMockClient();
    mockClient.__setRpcBehavior({ type: 'error', error: { message: 'duplicate key value violates unique constraint', code: '23505' } });

    const businessId = generateUUID();
    const userId = generateUUID();
    const product = makeProduct({ business_id: businessId });
    await db.products.add(product);

    const saleId = await registerSale(
      businessId,
      userId,
      [{ product, quantity: 1, factor: 1, unitPrice: product.price }],
      '',
      '',
      'cash',
      '',
      {}
    );

    await waitForSyncIdle();
    await triggerSync(businessId);

    const sale = await getSaleById(businessId, saleId);
    expect(sale.sync_status).toBe('local');

    const pending = await getPendingOperations(businessId, 'error');
    expect(pending.length).toBe(1);
    expect(pending[0].status).toBe('error');
    expect(pending[0].retry_count).toBe(1);
  });

  it('reintenta una vez las ventas que quedaron en error por stock negativo', async () => {
    const mockClient = await getMockClient();
    mockClient.__setRpcBehavior({ type: 'success' });

    const businessId = generateUUID();
    const saleId = generateUUID();
    const op = {
      id: generateUUID(),
      operation_type: 'REGISTER_SALE',
      payload: {
        business_id: businessId,
        client_generated_id: saleId,
        client_name: 'Stock desfasado',
        client_nit: '0',
        payment_method: 'cash',
        total: 10,
        item_count: 1,
        p_items: [],
        p_factors: [],
        extraFields: {},
      },
      business_id: businessId,
      status: 'error',
      created_at: new Date().toISOString(),
      retry_count: 5,
      last_attempt_at: new Date().toISOString(),
      error_details: 'El stock no puede ser negativo.',
    };
    await db.pending_operations.add(op);

    await triggerSync(businessId);

    const registrarCalls = mockClient.__rpcCalls.filter((c) => c.name === 'registrar_venta');
    expect(registrarCalls.length).toBe(1);
    expect(await getPendingOperations(businessId)).toHaveLength(0);
  });

  it('recovers the pending queue after closing and reopening the local database', async () => {
    const mockClient = await getMockClient();
    mockClient.__setRpcBehavior({ type: 'error', error: { message: 'Failed to fetch', code: 'ERR_NETWORK' } });

    const businessId = generateUUID();
    const userId = generateUUID();
    const product = makeProduct({ business_id: businessId });
    await db.products.add(product);

    const saleId = await registerSale(
      businessId,
      userId,
      [{ product, quantity: 1, factor: 1, unitPrice: product.price }],
      '',
      '',
      'cash',
      '',
      {}
    );

    await waitForSyncIdle();

    // Simulate app restart: close and reopen IndexedDB.
    db.close();
    await db.open();

    const pending = await getPendingOperations(businessId, 'pending');
    expect(pending.length).toBe(1);
    expect(pending[0].payload.client_generated_id).toBe(saleId);

    const sale = await getSaleById(businessId, saleId);
    expect(sale.sync_status).toBe('local');

    // After restart, sync succeeds.
    mockClient.__setRpcBehavior({ type: 'success' });
    await retryOperation(pending[0].id, businessId);
    await waitForSyncIdle();

    const confirmedSale = await getSaleById(businessId, saleId);
    expect(confirmedSale.sync_status).toBe('confirmed');
  });

  it('does not process the same operation twice when triggerSync is called concurrently', async () => {
    const mockClient = await getMockClient();
    mockClient.__setRpcBehavior({ type: 'success' });

    const businessId = generateUUID();
    const op = {
      id: generateUUID(),
      operation_type: 'REGISTER_SALE',
      payload: {
        business_id: businessId,
        client_generated_id: generateUUID(),
        client_name: 'Concurrente',
        client_nit: '0',
        payment_method: 'cash',
        total: 10,
        item_count: 1,
        p_items: [],
        p_factors: [],
        extraFields: {},
      },
      business_id: businessId,
      status: 'pending',
      created_at: new Date().toISOString(),
      retry_count: 0,
      last_attempt_at: null,
    };
    await db.pending_operations.add(op);

    // Fire two syncs concurrently.
    await Promise.all([triggerSync(businessId), triggerSync(businessId)]);

    const registrarCalls = mockClient.__rpcCalls.filter((c) => c.name === 'registrar_venta');
    expect(registrarCalls.length).toBe(1);

    const pending = await getPendingOperations(businessId);
    expect(pending.length).toBe(0);
  });

  it('honors the retry backoff window', async () => {
    const mockClient = await getMockClient();
    mockClient.__setRpcBehavior({ type: 'success' });

    const businessId = generateUUID();
    const saleId = generateUUID();
    const now = Date.now();
    const op = {
      id: generateUUID(),
      operation_type: 'REGISTER_SALE',
      payload: {
        business_id: businessId,
        client_generated_id: saleId,
        client_name: 'Backoff',
        client_nit: '0',
        payment_method: 'cash',
        total: 10,
        item_count: 1,
        p_items: [],
        p_factors: [],
        extraFields: {},
      },
      business_id: businessId,
      status: 'pending',
      created_at: new Date(now).toISOString(),
      retry_count: 2,
      last_attempt_at: new Date(now).toISOString(),
    };
    await db.pending_operations.add(op);

    // Backoff for retry_count=2 is 2^2 * 10 = 40 seconds.
    // At the same timestamp the operation should be skipped.
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
    try {
      await triggerSync(businessId);

      const registrarCalls = mockClient.__rpcCalls.filter((c) => c.name === 'registrar_venta');
      expect(registrarCalls.length).toBe(0);

      const pending = await getPendingOperations(businessId, 'pending');
      expect(pending.length).toBe(1);
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it('syncs pending operations when the browser fires the online event', async () => {
    const mockClient = await getMockClient();
    mockClient.__setRpcBehavior({ type: 'success' });

    const businessId = generateUUID();
    const saleId = generateUUID();
    const op = {
      id: generateUUID(),
      operation_type: 'REGISTER_SALE',
      payload: {
        business_id: businessId,
        client_generated_id: saleId,
        client_name: 'Online Event',
        client_nit: '0',
        payment_method: 'cash',
        total: 10,
        item_count: 1,
        p_items: [],
        p_factors: [],
        extraFields: {},
      },
      business_id: businessId,
      status: 'pending',
      created_at: new Date().toISOString(),
      retry_count: 0,
      last_attempt_at: null,
    };
    await db.pending_operations.add(op);

    const cleanup = await initializeSyncEngine(businessId);
    try {
      // Simulate the browser recovering connectivity.
      window.dispatchEvent(new Event('online'));
      await flushPromises();
      await waitForSyncIdle();

      const registrarCalls = mockClient.__rpcCalls.filter((c) => c.name === 'registrar_venta');
      expect(registrarCalls.length).toBe(1);

      const pending = await getPendingOperations(businessId, 'pending');
      expect(pending.length).toBe(0);
    } finally {
      cleanup();
    }
  });
});
