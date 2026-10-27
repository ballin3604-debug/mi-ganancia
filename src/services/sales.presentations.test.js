import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { db, generateUUID } from './localDb';
import { getSaleItemsAll, registerSale } from './sales';
import { applyPurchaseStock } from './branchStock';
import { attachSaleItemBusinessIds, getPendingOperations } from './syncEngine';
import { addProduct, addReplenishment } from './products';
import { calculatePurchaseBaseQuantity, getSellOptions, presShortLabel } from '../utils/presentations';

vi.mock('./localDb', async (importOriginal) => {
  const actual = await importOriginal();
  const isolatedDb = new actual.db.constructor('MiGananciaPresentationsTestDB');
  isolatedDb.version(1).stores({
    products: 'id, business_id',
    sales: 'id, created_at, business_id',
    sale_items: 'id, sale_id, product_id, business_id',
    branch_stock: 'id, business_id, branch_id, product_id',
    replenishments: 'id, business_id, product_id, created_at',
    pending_operations: 'id, created_at, business_id, status',
  });
  return { ...actual, db: isolatedDb };
});

vi.mock('./supabaseClient', () => ({
  supabase: null,
  isSupabaseConfigured: false,
  supabaseConfigError: '',
  assertSupabase: () => { throw new Error('Supabase no debe ejecutarse en estas pruebas.'); },
}));

const makeProduct = (businessId, overrides = {}) => ({
  id: generateUUID(),
  business_id: businessId,
  name: 'Bebida ficticia',
  brand: 'Marca de prueba',
  category: 'Cervezas',
  price: 12,
  unit_label: 'Botella',
  supplier_price: 5,
  stock: 30,
  presentations: [
    { id: 'bottle', name: 'Botella', factor: 1, price: 12, isBase: true },
    { id: 'six', name: 'Six-pack', factor: 6, price: 65, isBase: false },
    { id: 'case', name: 'Caja', factor: 24, price: 240, isBase: false },
  ],
  ...overrides,
});

function cartLine(product, presentationId, quantity) {
  const option = getSellOptions(product).find((candidate) => candidate.presentationId === presentationId);
  return {
    product,
    quantity,
    presId: option.presId,
    presentationId: option.presentationId,
    variant: option.variant,
    unitPrice: option.price,
    factor: option.factor,
    presLabel: presShortLabel(product, option.presId, option.variant, option.presentationId),
  };
}

describe('ventas con presentaciones configurables', () => {
  beforeEach(async () => {
    await Promise.all([
      db.products.clear(),
      db.sales.clear(),
      db.sale_items.clear(),
      db.branch_stock.clear(),
      db.pending_operations.clear(),
    ]);
  });

  it('vende una unidad base y guarda el precio seleccionado', async () => {
    const businessId = generateUUID();
    const product = makeProduct(businessId, { stock: 10 });
    await db.products.add(product);

    await registerSale(businessId, generateUUID(), [cartLine(product, 'bottle', 1)]);

    expect((await db.products.get(product.id)).stock).toBe(9);
    const saleItem = await db.sale_items.toCollection().first();
    expect(saleItem.price).toBe(12);
    expect(saleItem.presentation).toBe('Botella');
    expect(saleItem.presentation_factor).toBe(1);
    expect(saleItem.subtotal).toBe(12);
  });

  it('vende dos six-packs como doce unidades base y cobra el precio del six-pack', async () => {
    const businessId = generateUUID();
    const product = makeProduct(businessId, { stock: 12 });
    await db.products.add(product);

    const saleId = await registerSale(businessId, generateUUID(), [cartLine(product, 'six', 2)]);

    expect((await db.products.get(product.id)).stock).toBe(0);
    const sale = await db.sales.get(saleId);
    const saleItem = await db.sale_items.toCollection().first();
    expect(sale.total).toBe(130);
    expect(sale.item_count).toBe(12);
    expect(saleItem.price).toBe(65);
    expect(saleItem.subtotal).toBe(130);
    expect(saleItem.presentation_factor).toBe(6);
    expect(saleItem.presentation).toBe('Six-pack x6');
  });

  it('rechaza un precio de carrito que quedó desactualizado respecto a Dexie', async () => {
    const businessId = generateUUID();
    const product = makeProduct(businessId, { stock: 12 });
    const staleLine = cartLine(product, 'six', 1);
    await db.products.add({
      ...product,
      presentations: product.presentations.map((presentation) => (
        presentation.id === 'six' ? { ...presentation, price: 70 } : presentation
      )),
    });

    await expect(registerSale(businessId, generateUUID(), [staleLine])).rejects.toThrow(/no coincide/i);
    expect((await db.products.get(product.id)).stock).toBe(12);
    expect(await db.sales.count()).toBe(0);
  });

  it('revierte la venta local si el stock global o de la sucursal no alcanza', async () => {
    const businessId = generateUUID();
    const branchId = generateUUID();
    const product = makeProduct(businessId, { stock: 11 });
    await db.products.add(product);
    await db.branch_stock.add({
      id: `${branchId}:${product.id}`,
      business_id: businessId,
      branch_id: branchId,
      product_id: product.id,
      stock: 12,
    });

    await expect(registerSale(
      businessId,
      generateUUID(),
      [cartLine(product, 'six', 2)],
      '', '', 'cash', '', { branchId },
    )).rejects.toThrow(/stock insuficiente/i);

    expect(await db.sales.count()).toBe(0);
    expect(await db.sale_items.count()).toBe(0);
    expect((await db.products.get(product.id)).stock).toBe(11);
    expect((await db.branch_stock.get(`${branchId}:${product.id}`)).stock).toBe(12);
  });

  it('rechaza stock insuficiente en la sucursal aunque el total del negocio alcance', async () => {
    const businessId = generateUUID();
    const branchId = generateUUID();
    const product = makeProduct(businessId, { stock: 30 });
    await db.products.add(product);
    await db.branch_stock.add({
      id: `${branchId}:${product.id}`,
      business_id: businessId,
      branch_id: branchId,
      product_id: product.id,
      stock: 5,
    });

    await expect(registerSale(
      businessId,
      generateUUID(),
      [cartLine(product, 'six', 1)],
      '', '', 'cash', '', { branchId },
    )).rejects.toThrow(/stock insuficiente en la sucursal/i);

    expect(await db.sales.count()).toBe(0);
    expect((await db.products.get(product.id)).stock).toBe(30);
    expect((await db.branch_stock.get(`${branchId}:${product.id}`)).stock).toBe(5);
  });

  it('descuenta stock solo de la sucursal seleccionada y del negocio dueño', async () => {
    const businessId = generateUUID();
    const otherBusinessId = generateUUID();
    const branchId = generateUUID();
    const otherBranchId = generateUUID();
    const product = makeProduct(businessId, { stock: 10 });
    await db.products.add(product);
    await db.branch_stock.bulkAdd([
      { id: `${branchId}:${product.id}`, business_id: businessId, branch_id: branchId, product_id: product.id, stock: 5 },
      { id: `${otherBranchId}:${product.id}`, business_id: businessId, branch_id: otherBranchId, product_id: product.id, stock: 5 },
      { id: `${otherBranchId}:unrelated`, business_id: otherBusinessId, branch_id: otherBranchId, product_id: 'unrelated', stock: 99 },
    ]);

    await registerSale(
      businessId,
      generateUUID(),
      [cartLine(product, 'bottle', 1)],
      '', '', 'cash', '', { branchId },
    );

    expect((await db.products.get(product.id)).stock).toBe(9);
    expect((await db.branch_stock.get(`${branchId}:${product.id}`)).stock).toBe(4);
    expect((await db.branch_stock.get(`${otherBranchId}:${product.id}`)).stock).toBe(5);
    expect((await db.branch_stock.get(`${otherBranchId}:unrelated`)).stock).toBe(99);
  });

  it('inicializa el stock de la primera sucursal al recibir una compra por presentación', async () => {
    const businessId = generateUUID();
    const mainBranchId = generateUUID();
    const branchId = generateUUID();
    const product = makeProduct(businessId, { stock: 100 });
    await db.products.add(product);

    await applyPurchaseStock({
      businessId,
      product,
      branchId,
      mainBranchId,
      qty: 2 * 6,
      fields: {
        name: product.name,
        price: product.price,
        minStock: 5,
        brand: product.brand,
        category: product.category,
        description: '',
        imageData: '',
        supplierPrice: 5,
        unit: 'Unidad',
        presentations: product.presentations,
      },
    });

    expect((await db.products.get(product.id)).stock).toBe(112);
    expect((await db.branch_stock.get(`${mainBranchId}:${product.id}`)).stock).toBe(100);
    expect((await db.branch_stock.get(`${branchId}:${product.id}`)).stock).toBe(12);
  });

  it('rechaza cruzar productos entre negocios y no duplica la operación local', async () => {
    const businessId = generateUUID();
    const otherBusinessId = generateUUID();
    const foreignProduct = makeProduct(otherBusinessId);
    await db.products.add(foreignProduct);

    await expect(registerSale(
      businessId,
      generateUUID(),
      [cartLine(foreignProduct, 'bottle', 1)],
    )).rejects.toThrow(/no pertenece/i);

    const product = makeProduct(businessId);
    await db.products.add(product);
    const saleId = await registerSale(businessId, generateUUID(), [cartLine(product, 'case', 1)]);
    const pending = await getPendingOperations(businessId, 'pending');

    expect(pending).toHaveLength(1);
    expect(pending[0].operation_type).toBe('REGISTER_PRESENTATION_SALE');
    expect(pending[0].payload.client_generated_id).toBe(saleId);
    expect(pending[0].payload.p_items[0].presentation_id).toBe('case');
    expect(pending[0].payload.p_items[0].presentation_factor).toBe(24);
    expect((await db.products.get(product.id)).stock).toBe(6);
  });

  it('asocia líneas históricas sin negocio al padre y las deja visibles en el historial filtrado', async () => {
    const businessId = generateUUID();
    const otherBusinessId = generateUUID();
    const saleId = generateUUID();
    await db.sales.put({ id: saleId, business_id: businessId, created_at: new Date().toISOString() });

    const legacyItem = {
      id: generateUUID(),
      sale_id: saleId,
      product_id: generateUUID(),
      product_name: 'Producto histórico',
      quantity: 2,
      price: 10,
      business_id: null,
    };
    const [scopedItem] = attachSaleItemBusinessIds(
      [{ id: saleId, business_id: businessId }],
      [legacyItem],
    );
    await db.sale_items.put(scopedItem);

    await expect(getSaleItemsAll(businessId)).resolves.toMatchObject([
      { id: legacyItem.id, saleId, business_id: businessId, presentationId: null },
    ]);
    await expect(getSaleItemsAll(otherBusinessId)).resolves.toEqual([]);
  });

  it('no reemplaza un negocio presente si contradice al padre y rechaza líneas huérfanas', () => {
    const saleId = generateUUID();
    const sales = [{ id: saleId, business_id: generateUUID() }];
    expect(() => attachSaleItemBusinessIds(sales, [{ sale_id: saleId, business_id: generateUUID() }]))
      .toThrow(/no coincide/i);
    expect(() => attachSaleItemBusinessIds(sales, [{ sale_id: generateUUID(), business_id: null }]))
      .toThrow(/venta padre/i);
  });

  it('guarda presentaciones configurables en el producto y conserva el fallback legacy', async () => {
    const businessId = generateUUID();
    const configured = await addProduct(businessId, {
      name: 'Producto configurable',
      price: 12,
      stock: 20,
      unitLabel: 'Botella',
      presentations: [
        { id: 'bottle', name: 'Botella', factor: 1, price: 12, isBase: true },
        { id: 'six', name: 'Six-pack', factor: 6, price: 65, isBase: false },
      ],
    });
    const legacy = makeProduct(businessId, {
      presentations: [],
      packageSize: 6,
      packLabel: 'Six-pack',
      packPrice: 55,
    });
    await db.products.put(legacy);

    expect((await db.products.get(configured.id)).presentations).toHaveLength(2);
    expect(getSellOptions(legacy).map((option) => option.factor)).toEqual([1, 6]);
    expect((await getPendingOperations(businessId, 'pending'))[0].payload.presentations).toHaveLength(2);
  });

  it('registra una compra por presentación en unidades base con sus metadatos', async () => {
    const businessId = generateUUID();
    const product = makeProduct(businessId);
    const quantity = calculatePurchaseBaseQuantity(3, 6);

    const replenishment = await addReplenishment(businessId, {
      productId: product.id,
      productName: product.name,
      quantity,
      supplierPrice: 7,
      salePrice: 12,
      purchaseUnitType: 'package',
      packageSize: 6,
      packageCount: 3,
    });

    expect(replenishment.quantity).toBe(18);
    expect(replenishment.purchaseUnitType).toBe('package');
    expect(replenishment.packageSize).toBe(6);
    expect(replenishment.packageCount).toBe(3);
    expect(replenishment.totalCost).toBe(126);
  });

  it('la migración valida idempotencia, pertenencia, permisos, factor y stock en el servidor', () => {
    const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261026000000_configurable_presentations.sql'), 'utf8');
    expect(migration).toContain('pg_advisory_xact_lock(hashtextextended(p_client_generated_id::text, 0))');
    expect(migration).toMatch(/v_existing_business_id is distinct from p_business_id/);
    expect(migration).toMatch(/v_profile\.business_id is distinct from p_business_id/);
    expect(migration).toContain('El usuario no está activo.');
    expect(migration).toContain("v_profile.role = 'cashier'");
    expect(migration).toContain('v_profile.branch_ids');
    expect(migration).toContain('v_factor <= 0');
    expect(migration).toContain('add column if not exists presentation_id text');
    expect(migration).toContain("'presentation_id', v_presentation_id");
    expect(migration).toMatch(/presentation_id,\s*presentation,\s*presentation_factor/);
    expect(migration).toContain('v_presentation_count <> 1');
    expect(migration).toContain('Stock global insuficiente');
    expect(migration).toContain('Stock insuficiente en la sucursal');
    expect(migration).toContain('prevent_negative_products_stock');
    expect(migration).toContain('prevent_negative_branch_stock');
    expect(migration).toContain('add column if not exists presentation_id text');
    expect(migration).toContain("'presentation_id', v_presentation_id");
    expect(migration).toContain("nullif(v_item ->> 'presentation_id', '')");
  });

  it('la migración rellena solo negocios nulos y aborta ante líneas huérfanas o discrepantes', () => {
    const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261026000000_configurable_presentations.sql'), 'utf8');
    const legacyPresentationMigration = readFileSync(resolve(process.cwd(), 'scripts/migration-venta-paquete.sql'), 'utf8');
    expect(migration).toMatch(/update public\.sale_items as item[\s\S]*?from public\.sales as sale[\s\S]*?sale\.id = item\.sale_id[\s\S]*?item\.business_id is null/i);
    expect(migration).toContain('líneas de venta no tienen venta padre');
    expect(migration).toContain('líneas de venta siguen sin negocio asociado');
    expect(migration).toContain('líneas de venta no coinciden con el negocio');
    expect(migration).toMatch(/where item\.business_id is distinct from sale\.business_id/i);
    expect(migration).toContain('alter column business_id set not null');
    expect(migration).toContain('sale_items_business_id_businesses_fkey');
    expect(legacyPresentationMigration).toContain('add column if not exists presentation_factor numeric default 1');
    expect(migration).toContain('add column if not exists presentation_factor numeric');
    expect(migration).not.toContain('set presentation_factor = 1');
    expect(migration).toContain("alter column presentations set default '[]'::jsonb");
    expect(migration).toContain("jsonb_typeof(presentations) is distinct from 'array'");
  });

  it('mantiene idempotentes subtotal y branch_id que ya introducen migraciones anteriores', () => {
    const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261026000000_configurable_presentations.sql'), 'utf8');
    const branchMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260923222121_branches.sql'), 'utf8');
    const subtotalMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261021000000_sale_items_subtotal.sql'), 'utf8');

    expect(branchMigration).toMatch(/alter table public\.sales[\s\S]*?add column if not exists branch_id/i);
    expect(subtotalMigration).toMatch(/alter table public\.sale_items[\s\S]*?add column if not exists subtotal/i);
    expect(migration).toMatch(/alter table public\.sales[\s\S]*?add column if not exists branch_id/i);
    expect(migration).toMatch(/alter table public\.sale_items[\s\S]*?add column if not exists subtotal/i);
    expect(migration).toContain('alter column subtotal set not null');
  });
});
