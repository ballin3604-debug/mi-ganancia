import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db, generateUUID } from './localDb';
import { getBranches } from './branches';

const state = vi.hoisted(() => ({
  rows: [],
  error: null,
  calls: 0,
}));

function makeQuery() {
  const error = state.error;
  let filtered = state.rows;
  const query = {
    select: () => query,
    eq: (column, value) => {
      if (column === 'business_id') {
        filtered = filtered.filter((row) => row.business_id === value);
      }
      return query;
    },
    order: () => query,
    then: (resolve, reject) => Promise.resolve(
      error ? { data: null, error } : { data: filtered, error: null },
    ).then(resolve, reject),
  };
  return query;
}

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: () => ({ insert: () => ({ select: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }),
  },
  assertSupabase: () => ({
    from: () => {
      state.calls += 1;
      return makeQuery();
    },
  }),
}));

function setOnline(value) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
}

describe('caché offline de sedes', () => {
  beforeEach(async () => {
    state.rows = [];
    state.error = null;
    state.calls = 0;
    setOnline(true);
    await db.delete();
    await db.open();
  });

  afterEach(() => {
    setOnline(true);
  });

  it('guarda las sedes del servidor y las devuelve sin red', async () => {
    const businessId = generateUUID();
    const mainId = generateUUID();
    const branchId = generateUUID();
    state.rows = [
      { id: mainId, business_id: businessId, name: 'Casa matriz', is_main: true },
      { id: branchId, business_id: businessId, name: 'Sucursal Norte', is_main: false },
    ];

    const online = await getBranches(businessId);
    expect(online.map((branch) => branch.id)).toEqual([mainId, branchId]);
    expect(online[0].isMain).toBe(true);
    expect(await db.branches.where('business_id').equals(businessId).count()).toBe(2);

    const callsAfterOnline = state.calls;
    setOnline(false);
    state.rows = [];
    const offline = await getBranches(businessId);

    expect(offline.map((branch) => branch.id)).toEqual([mainId, branchId]);
    expect(offline[0].isMain).toBe(true);
    expect(state.calls).toBe(callsAfterOnline);
  });

  it('usa la caché si el servidor falla estando en línea', async () => {
    const businessId = generateUUID();
    const branchId = generateUUID();
    state.rows = [{ id: branchId, business_id: businessId, name: 'Sucursal', is_main: true }];
    await getBranches(businessId);

    state.error = new Error('Failed to fetch');
    const branches = await getBranches(businessId);

    expect(branches.map((branch) => branch.id)).toEqual([branchId]);
  });

  it('falla de forma controlada si no hay caché ni servidor', async () => {
    state.error = new Error('Failed to fetch');
    await expect(getBranches(generateUUID())).rejects.toThrow(/Failed to fetch/);
  });

  it('no mezcla sedes de otros negocios', async () => {
    const businessId = generateUUID();
    const otherBusinessId = generateUUID();
    state.rows = [
      { id: generateUUID(), business_id: businessId, name: 'Propia', is_main: true },
      { id: generateUUID(), business_id: otherBusinessId, name: 'Ajena', is_main: true },
    ];

    await getBranches(businessId);
    setOnline(false);
    const branches = await getBranches(businessId);

    expect(branches).toHaveLength(1);
    expect(branches[0].name).toBe('Propia');
  });
});
