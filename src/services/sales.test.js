import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, generateUUID } from './localDb';
import { registerSale, getSaleById, getSaleItems } from './sales';
import { getPendingOperations } from './syncEngine';

vi.mock('./supabaseClient', () => ({
  supabase: null,
  isSupabaseConfigured: false,
  supabaseConfigError: '',
  assertSupabase: () => { throw new Error('Supabase not configured in tests'); },
}));

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

function makeCartItem(product, quantity = 1, factor = 1) {
  return {
    product,
    quantity,
    factor,
    unitPrice: product.price,
    presLabel: factor > 1 ? 'Caja' : 'Unidad',
    variant: '',
  };
}

describe('sales offline flow', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('registerSale saves sale locally with sync_status local and queues REGISTER_SALE', async () => {
    const businessId = generateUUID();
    const userId = generateUUID();
    const product = makeProduct({ business_id: businessId });
    await db.products.add(product);

    const saleId = await registerSale(
      businessId,
      userId,
      [makeCartItem(product, 2)],
      'Cliente Test',
      '123456',
      'cash',
      'Vendedor Test',
      { branchId: null }
    );

    const sale = await getSaleById(businessId, saleId);
    expect(sale).toBeDefined();
    expect(sale.client_name).toBe('Cliente Test');
    expect(sale.total).toBe(20);
    expect(sale.sync_status).toBe('local');

    const items = await getSaleItems(businessId, saleId);
    expect(items.length).toBe(1);
    expect(items[0].quantity).toBe(2);

    const pending = await getPendingOperations(businessId, 'pending');
    expect(pending.length).toBe(1);
    expect(pending[0].operation_type).toBe('REGISTER_SALE');
    expect(pending[0].payload.client_generated_id).toBe(saleId);
    expect(pending[0].created_by).toBe(userId);

    const storedProduct = await db.products.get(product.id);
    expect(storedProduct.stock).toBe(98);
  });

  it('registerSale with packages discounts base stock correctly', async () => {
    const businessId = generateUUID();
    const product = makeProduct({ business_id: businessId, price: 20 });
    await db.products.add(product);

    await registerSale(
      businessId,
      generateUUID(),
      [makeCartItem(product, 1, 6)], // 1 box of 6 units
      '',
      '',
      'cash',
      '',
      {}
    );

    const storedProduct = await db.products.get(product.id);
    expect(storedProduct.stock).toBe(94);
  });
});
