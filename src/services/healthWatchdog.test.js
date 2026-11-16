import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getWatchdogSnapshot } from './healthWatchdog';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('./supabaseClient', () => ({
  isSupabaseConfigured: true,
  assertSupabase: () => ({
    rpc: mocks.rpc,
    from: () => ({
      select: () => ({
        order: () => ({
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  }),
}));

vi.mock('../config/environment', () => ({
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
}));

vi.mock('./syncEngine', () => ({
  getDeviceId: () => null,
  getSyncHealthSnapshot: vi.fn(),
}));

const businessRow = {
  business_id: 'biz-1',
  business_name: 'Tienda Centro',
  users_count: 2,
  products_count: 10,
  sales_24h: 3,
  devices_total: 1,
  devices_online: 1,
  pending_ops: 0,
  error_ops: 0,
};

describe('getWatchdogSnapshot', () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    delete global.fetch;
  });

  it('mantiene los negocios si falla solo la salud de la plataforma', async () => {
    mocks.rpc.mockImplementation((name) => {
      if (name === 'admin_business_health') {
        return Promise.resolve({ data: [businessRow], error: null });
      }
      if (name === 'admin_platform_health') {
        return Promise.resolve({ data: null, error: { message: 'boom' } });
      }
      return Promise.resolve({ error: null });
    });

    const snapshot = await getWatchdogSnapshot();

    expect(snapshot.businesses).toHaveLength(1);
    expect(snapshot.platform).toBeNull();
    expect(snapshot.warning).toContain('boom');
  });

  it('mantiene la plataforma si falla solo la salud por negocio', async () => {
    mocks.rpc.mockImplementation((name) => {
      if (name === 'admin_business_health') {
        return Promise.resolve({ data: null, error: { message: 'sin negocios' } });
      }
      if (name === 'admin_platform_health') {
        return Promise.resolve({ data: [{ businesses_total: 10 }], error: null });
      }
      return Promise.resolve({ error: null });
    });

    const snapshot = await getWatchdogSnapshot();

    expect(snapshot.businesses).toEqual([]);
    expect(snapshot.platform).toEqual({ businesses_total: 10 });
    expect(snapshot.warning).toContain('sin negocios');
  });

  it('avisa si falta la migración del Vigía', async () => {
    mocks.rpc.mockImplementation((name) => {
      if (name === 'admin_business_health' || name === 'admin_platform_health') {
        return Promise.resolve({ data: null, error: { code: 'PGRST202' } });
      }
      return Promise.resolve({ error: null });
    });

    await expect(getWatchdogSnapshot()).rejects.toThrow(/migración del Vigía/i);
  });
});
