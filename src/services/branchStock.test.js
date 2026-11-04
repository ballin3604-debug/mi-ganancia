import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, generateUUID } from './localDb';
import { setBranchStock } from './branchStock';
import { getPendingOperations } from './syncEngine';

vi.mock('./supabaseClient', () => ({
  supabase: null,
  isSupabaseConfigured: false,
  supabaseConfigError: '',
  assertSupabase: () => { throw new Error('Supabase not configured in tests'); },
}));

describe('stock por sede', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('mantiene el total global y lo encola para sincronizar', async () => {
    const businessId = generateUUID();
    const branchId = generateUUID();
    const product = {
      id: generateUUID(),
      business_id: businessId,
      name: 'Milanesa napolitana',
      price: 25,
      stock: 0,
      category: 'Platos',
      is_dish: true,
    };
    await db.products.add(product);

    await setBranchStock(businessId, product, branchId, 20);

    expect((await db.products.get(product.id)).stock).toBe(20);
    const pending = await getPendingOperations(businessId, 'pending');
    expect(pending.some((op) => op.operation_type === 'SET_BRANCH_STOCK')).toBe(true);
    const productOp = pending.find((op) => op.operation_type === 'UPDATE_PRODUCT');
    expect(productOp).toBeDefined();
    expect(productOp.payload.stock).toBe(20);
  });
});
