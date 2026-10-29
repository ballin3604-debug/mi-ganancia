import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, generateUUID } from './localDb';
import {
  registerSale, getSaleById, getSaleItems,
  updateSale, cancelSale, getSaleChangesAll,
} from './sales';
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

  it('registerSale vende un plato sin stock y no descuenta inventario', async () => {
    const businessId = generateUUID();
    const userId = generateUUID();
    const product = makeProduct({ business_id: businessId, is_dish: true, stock: 0, min_stock: 0 });
    await db.products.add(product);

    const saleId = await registerSale(businessId, userId, [makeCartItem(product, 2)]);

    const sale = await getSaleById(businessId, saleId);
    expect(sale).toBeDefined();
    expect(sale.total).toBe(20);

    const storedProduct = await db.products.get(product.id);
    expect(storedProduct.stock).toBe(0);

    const pending = await getPendingOperations(businessId, 'pending');
    expect(pending.length).toBe(1);
    expect(pending[0].operation_type).toBe('REGISTER_SALE');
    expect(pending[0].payload.p_items[0].product_id).toBe(product.id);
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

  it('updateSale ajusta cantidades, stock y registra la bitácora', async () => {
    const businessId = generateUUID();
    const userId = generateUUID();
    const product = makeProduct({ business_id: businessId });
    await db.products.add(product);

    const saleId = await registerSale(
      businessId, userId, [makeCartItem(product, 2)], '', '', 'cash', 'Cajera', {}
    );
    const [item] = await getSaleItems(businessId, saleId);

    const result = await updateSale(businessId, userId, saleId, [
      { ...item, quantity: 3 },
    ], { reason: 'El cliente pidió uno más' });

    expect(result.totalBefore).toBe(20);
    expect(result.totalAfter).toBe(30);

    const sale = await getSaleById(businessId, saleId);
    expect(sale.total).toBe(30);
    expect(sale.item_count).toBe(3);

    const storedProduct = await db.products.get(product.id);
    expect(storedProduct.stock).toBe(97);

    const changes = await getSaleChangesAll(businessId);
    expect(changes).toHaveLength(1);
    expect(changes[0].eventType).toBe('qty_increased');
    expect(changes[0].quantityBefore).toBe(2);
    expect(changes[0].quantityAfter).toBe(3);
    expect(changes[0].amountDelta).toBe(10);
    expect(changes[0].reason).toBe('El cliente pidió uno más');

    const pending = await getPendingOperations(businessId, 'pending');
    const op = pending.find((entry) => entry.operation_type === 'UPDATE_SALE');
    expect(op).toBeDefined();
    expect(op.payload.affected_product_ids).toContain(product.id);
    expect(op.payload.items[0].quantity).toBe(3);
  });

  it('updateSale agrega y retira productos con eventos separados', async () => {
    const businessId = generateUUID();
    const userId = generateUUID();
    const productA = makeProduct({ business_id: businessId, name: 'Plato A', price: 10, stock: 50 });
    const productB = makeProduct({ business_id: businessId, name: 'Bebida B', price: 5, stock: 20 });
    await db.products.bulkAdd([productA, productB]);

    const saleId = await registerSale(
      businessId, userId, [makeCartItem(productA, 1)], '', '', 'cash', 'Cajera', {}
    );
    const [itemA] = await getSaleItems(businessId, saleId);
    const lineB = {
      id: generateUUID(),
      productId: productB.id,
      productName: productB.name,
      quantity: 2,
      price: productB.price,
      presentationFactor: 1,
      supplierPrice: productB.supplier_price,
    };

    await updateSale(businessId, userId, saleId, [itemA, lineB]);
    expect((await db.products.get(productA.id)).stock).toBe(49);
    expect((await db.products.get(productB.id)).stock).toBe(18);

    let changes = await getSaleChangesAll(businessId);
    expect(changes).toHaveLength(1);
    expect(changes[0].eventType).toBe('item_added');
    expect(changes[0].productName).toBe('Bebida B');
    expect(changes[0].amountDelta).toBe(10);

    await updateSale(businessId, userId, saleId, [lineB]);
    expect((await db.products.get(productA.id)).stock).toBe(50);
    expect((await db.products.get(productB.id)).stock).toBe(18);

    const sale = await getSaleById(businessId, saleId);
    expect(sale.total).toBe(10);
    expect(sale.item_count).toBe(2);

    changes = await getSaleChangesAll(businessId);
    expect(changes).toHaveLength(2);
    const removed = changes.find((change) => change.eventType === 'item_removed');
    expect(removed).toBeDefined();
    expect(removed.productName).toBe('Plato A');
    expect(removed.amountDelta).toBe(-10);
  });

  it('cancelSale devuelve stock, marca el pedido y registra la cancelación', async () => {
    const businessId = generateUUID();
    const userId = generateUUID();
    const product = makeProduct({ business_id: businessId });
    await db.products.add(product);

    const saleId = await registerSale(
      businessId, userId, [makeCartItem(product, 2)], '', '', 'cash', 'Cajera', {}
    );
    expect((await db.products.get(product.id)).stock).toBe(98);

    const result = await cancelSale(businessId, userId, saleId, { reason: 'Cliente canceló' });
    expect(result.totalBefore).toBe(20);

    const sale = await getSaleById(businessId, saleId);
    expect(sale.status).toBe('cancelled');
    expect(sale.cancellationReason).toBe('Cliente canceló');

    expect((await db.products.get(product.id)).stock).toBe(100);

    const changes = await getSaleChangesAll(businessId);
    expect(changes).toHaveLength(1);
    expect(changes[0].eventType).toBe('sale_cancelled');
    expect(changes[0].amountDelta).toBe(-20);
    expect(changes[0].reason).toBe('Cliente canceló');

    const pending = await getPendingOperations(businessId, 'pending');
    expect(pending.some((entry) => entry.operation_type === 'CANCEL_SALE')).toBe(true);

    await expect(updateSale(businessId, userId, saleId, [
      { ...(await getSaleItems(businessId, saleId))[0], quantity: 3 },
    ])).rejects.toThrow('cancelado');
    await expect(cancelSale(businessId, userId, saleId)).rejects.toThrow('cancelado');
  });
});
