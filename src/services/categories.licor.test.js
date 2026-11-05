import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
  business_settings: { get: vi.fn(), put: vi.fn() },
  products: { where: vi.fn(), update: vi.fn() },
  pending_operations: { add: vi.fn() },
  transaction: vi.fn(async (...args) => args[3]()),
}));

vi.mock('./localDb', () => ({ db }));
vi.mock('./syncEngine', () => ({
  enqueueOperation: vi.fn(async () => {}),
  buildOutboxOp: (operation_type, payload) => ({ operation_type, payload }),
}));
vi.mock('./supabaseClient', () => ({
  supabase: {},
  assertSupabase: vi.fn(),
  isSupabaseConfigured: true,
}));
vi.mock('./products', () => ({ notifyProductChanges: vi.fn(async () => {}) }));

import { LICOR_CATEGORIES } from '../config/licorCatalog';
import { ensureLicorCategories } from './categories';
import { enqueueOperation } from './syncEngine';
import { notifyProductChanges } from './products';

let products = [];

function setLocal(settings) {
  db.business_settings.get.mockImplementation(async () => settings);
  db.business_settings.put.mockImplementation(async (row) => {
    settings = { ...settings, ...row };
    return settings;
  });
}

function setProducts(list) {
  products = list;
  db.products.where.mockImplementation(() => ({
    equals: () => ({ toArray: async () => products }),
  }));
}

describe('ensureLicorCategories', () => {
  beforeEach(() => {
    vi.mocked(enqueueOperation).mockClear();
    vi.mocked(notifyProductChanges).mockClear();
    db.business_settings.put.mockClear();
    db.products.update.mockClear();
    db.pending_operations.add.mockClear();
  });

  it('reemplaza categorías de tienda y remapea los productos', async () => {
    setLocal({ business_id: 'b1', business_category: 'licorera', categories: ['Bebidas', 'Lácteos'] });
    setProducts([
      { id: 'p1', category: 'Bebidas' },
      { id: 'p2', category: 'Snacks y dulces' },
      { id: 'p3', category: 'Cervezas' },
    ]);

    const cats = await ensureLicorCategories('b1');

    expect(cats).toEqual(LICOR_CATEGORIES);
    expect(db.business_settings.put).toHaveBeenCalled();
    expect(vi.mocked(enqueueOperation)).toHaveBeenCalledWith(
      'SAVE_BUSINESS_SETTINGS',
      { business_id: 'b1', categories: LICOR_CATEGORIES },
      'b1'
    );
    // p1 (Bebidas) y p2 (Snacks y dulces) cambian; p3 ya era válida.
    expect(db.products.update).toHaveBeenCalledTimes(2);
    expect(notifyProductChanges).toHaveBeenCalledWith('b1');
  });

  it('vuelve a aplicar la lista si el servidor la revierte', async () => {
    // El negocio ya pasó por ensure, pero un pull trajo la lista vieja.
    setLocal({ business_id: 'b1', business_category: 'licorera', categories: ['Bebidas', 'Lácteos'] });
    setProducts([{ id: 'p1', category: 'Bebidas' }]);

    const cats = await ensureLicorCategories('b1');

    expect(cats).toEqual(LICOR_CATEGORIES);
    expect(db.business_settings.put).toHaveBeenCalled();
    expect(vi.mocked(enqueueOperation)).toHaveBeenCalledWith(
      'SAVE_BUSINESS_SETTINGS',
      { business_id: 'b1', categories: LICOR_CATEGORIES },
      'b1'
    );
    expect(db.products.update).toHaveBeenCalledTimes(1);
  });

  it('no encola cambios si el catálogo ya está correcto', async () => {
    setLocal({ business_id: 'b2', business_category: 'licorera', categories: [...LICOR_CATEGORIES] });
    setProducts([{ id: 'p1', category: 'Cervezas' }]);

    const cats = await ensureLicorCategories('b2');

    expect(cats).toEqual(LICOR_CATEGORIES);
    expect(db.business_settings.put).not.toHaveBeenCalled();
    expect(enqueueOperation).not.toHaveBeenCalled();
    expect(db.products.update).not.toHaveBeenCalled();
    expect(notifyProductChanges).not.toHaveBeenCalled();
  });
});
