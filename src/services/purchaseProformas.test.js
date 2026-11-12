import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, generateUUID } from './localDb';
import {
  allocateAmountByWeights,
  buildProformaExtraShares,
  clearProformaDraft,
  computeProformaItem,
  getProductCurrentPackagePrice,
  getProformaDraft,
  groupReplenishmentsByProforma,
  saveProformaDraft,
  savePurchaseProforma,
  suggestProformaNumber,
  validateProformaDraft,
} from './purchaseProformas';

vi.mock('./supabaseClient', () => ({
  supabase: null,
  isSupabaseConfigured: false,
  supabaseConfigError: '',
  assertSupabase: () => { throw new Error('Supabase not configured in tests'); },
}));

function validItem(overrides = {}) {
  return {
    productId: 'producto-1',
    productName: 'Ron',
    factor: 1,
    packCount: '1',
    looseUnits: '',
    costMode: 'unit',
    costInput: '10',
    salePrice: '15',
    expiryDate: '2027-01-01',
    ...overrides,
  };
}

describe('prorrateo de gastos de proforma', () => {
  it('reparte proporcionalmente según el costo de cada línea', () => {
    expect(allocateAmountByWeights(100, [60, 40])).toEqual([60, 40]);
    expect(allocateAmountByWeights(50, [100, 300])).toEqual([12.5, 37.5]);
  });

  it('absorbe los centavos sobrantes en la última línea para cuadrar el total', () => {
    const shares = allocateAmountByWeights(10, [1, 1, 1]);
    expect(shares).toEqual([3.33, 3.33, 3.34]);
    expect(shares.reduce((sum, amount) => sum + amount, 0)).toBeCloseTo(10, 10);
  });

  it('reparte en partes iguales cuando ninguna línea tiene costo base', () => {
    expect(allocateAmountByWeights(9, [0, 0])).toEqual([4.5, 4.5]);
    expect(allocateAmountByWeights(10, [0, 0, 0])).toEqual([3.33, 3.33, 3.34]);
  });

  it('devuelve ceros sin monto y una lista vacía sin líneas', () => {
    expect(allocateAmountByWeights(0, [5, 5])).toEqual([0, 0]);
    expect(allocateAmountByWeights(10, [])).toEqual([]);
  });

  it('arma las filas de conceptos por producto y conserva el total', () => {
    const shares = buildProformaExtraShares(
      [
        { concept: 'Flete', amount: 30 },
        { concept: 'Comisión', amount: 20 },
        { concept: '   ', amount: 10 },
        { concept: 'Sin monto', amount: 0 },
      ],
      [100, 200]
    );

    expect(shares[0].costs).toEqual([
      { concept: 'Flete', amount: 10 },
      { concept: 'Comisión', amount: 6.66 },
    ]);
    expect(shares[0].total).toBe(16.66);
    expect(shares[1].costs).toEqual([
      { concept: 'Flete', amount: 20 },
      { concept: 'Comisión', amount: 13.34 },
    ]);
    expect(shares[1].total).toBe(33.34);
    expect(shares[0].total + shares[1].total).toBe(50);
  });
});

describe('cálculo de líneas de proforma', () => {
  it('suma cajas más unidades sueltas y convierte el costo de caja a unitario', () => {
    const totals = computeProformaItem({
      factor: 24,
      packCount: '2',
      looseUnits: '3',
      costMode: 'package',
      costInput: '240',
      salePrice: '15',
    });

    expect(totals.quantity).toBe(51);
    expect(totals.unitCost).toBe(10);
    expect(totals.baseCost).toBe(510);
    expect(totals.totalCost).toBe(510);
    expect(totals.unitRealCost).toBeCloseTo(10, 10);
    expect(totals.marginPct).toBeCloseTo(33.3333, 3);
  });

  it('incluye la parte prorrateada de gastos en el costo real y el margen', () => {
    const totals = computeProformaItem({
      factor: 1,
      packCount: '10',
      costMode: 'unit',
      costInput: '10',
      salePrice: '15',
    }, 90);

    expect(totals.baseCost).toBe(100);
    expect(totals.extra).toBe(90);
    expect(totals.totalCost).toBe(190);
    expect(totals.unitRealCost).toBeCloseTo(19, 10);
    expect(totals.marginAmount).toBeCloseTo(-4, 10);
    expect(totals.marginPct).toBeCloseTo(-26.6667, 3);
  });

  it('trata un factor inválido como unidad simple', () => {
    const totals = computeProformaItem({
      factor: 'abc',
      packCount: '4',
      costMode: 'unit',
      costInput: '2.5',
      salePrice: '5',
    });

    expect(totals.factor).toBe(1);
    expect(totals.quantity).toBe(4);
    expect(totals.baseCost).toBe(10);
  });

  it('calcula el precio de compra actual en bolivianos enteros', () => {
    expect(getProductCurrentPackagePrice({ supplier_price: 1.92 }, 12)).toBe(23);
    expect(getProductCurrentPackagePrice({ supplierPrice: 10 }, 1)).toBe(10);
    expect(getProductCurrentPackagePrice({
      last_purchase_package_price: 100,
      last_purchase_package_factor: 12,
    }, 6)).toBe(50);
  });
});

describe('validación de la proforma', () => {
  it('acepta una proforma completa', () => {
    expect(validateProformaDraft({
      header: { number: 'P-0001', date: '2026-11-11' },
      items: [validItem()],
    })).toEqual([]);
  });

  it('exige número, fecha y al menos un producto', () => {
    const errors = validateProformaDraft({ header: {}, items: [] });
    expect(errors).toContain('Escribí el número de la proforma.');
    expect(errors).toContain('Elegí la fecha de la proforma.');
    expect(errors).toContain('Agregá al menos un producto a la proforma.');
  });

  it('detecta productos incompletos y los identifica por nombre', () => {
    const errors = validateProformaDraft({
      header: { number: 'P-0002', date: '2026-11-11' },
      items: [validItem({ productId: null, packCount: '0', costInput: '0', salePrice: '0' })],
    });

    expect(errors).toContain('Ron: elegí un producto.');
    expect(errors).toContain('Ron: la cantidad de paquetes/cajas debe ser mayor a 0.');
    expect(errors).toContain('Ron: el precio de compra por caja debe ser mayor a 0.');
    expect(errors).toContain('Ron: el precio de venta debe ser mayor a 0.');
  });

  it('acepta un producto nuevo sin id pero exige su factor si la presentación es manual', () => {
    const newProductItem = validItem({
      productId: null,
      productName: '',
      isNewProduct: true,
      presentationKey: 'custom',
      factor: 1,
      newProduct: { name: 'Vodka Nueva' },
    });
    expect(validateProformaDraft({
      header: { number: 'P-0003', date: '2026-11-11' },
      items: [newProductItem],
    })).toEqual(['Vodka Nueva: indicá cuántas unidades trae la presentación.']);
  });

  it('exige vencimiento solo cuando la licorería lo pide', () => {
    const item = validItem({ expiryDate: '' });
    expect(validateProformaDraft({
      header: { number: 'P-0004', date: '2026-11-11' },
      items: [item],
    })).toEqual([]);
    expect(validateProformaDraft({
      header: { number: 'P-0004', date: '2026-11-11' },
      items: [item],
      requireExpiry: true,
    })).toEqual(['Ron: cargá la fecha de vencimiento del lote.']);
  });
});

describe('numeración y agrupación de proformas', () => {
  it('sugiere el siguiente correlativo mensual con formato PRF', () => {
    const date = new Date(2026, 10, 11);
    expect(suggestProformaNumber([], date)).toBe('PRF-202611-0001');
    expect(suggestProformaNumber([
      { proformaNumber: 'PRF-202611-0003' },
      { proformaNumber: 'PRF-202611-0007' },
      { proformaNumber: 'PRF-202610-0099' },
      { proformaNumber: 'FAC-0099' },
      { proformaNumber: '' },
    ], date)).toBe('PRF-202611-0008');
  });

  it('agrupa por proforma, ordena líneas y suma los totales', () => {
    const groups = groupReplenishmentsByProforma([
      {
        id: 'linea-2',
        proformaId: 'pf-1',
        proformaNumber: 'P-0002',
        proformaDate: '2026-11-10',
        supplier: 'Distribuidora',
        proformaDocType: 'Factura',
        proformaNotes: 'Pago a 30 días',
        branchId: 'sede-1',
        branchName: 'Centro',
        proformaExtraCosts: [{ concept: 'Flete', amount: 30 }],
        proformaExtraTotal: 30,
        createdAt: new Date('2026-11-10T12:00:00Z'),
        lineNumber: 2,
        productName: 'Cerveza',
        quantity: 24,
        supplierPrice: 5,
        salePrice: 8,
        totalCost: 130,
        additionalExpenses: 10,
      },
      {
        id: 'linea-1',
        proformaId: 'pf-1',
        lineNumber: 1,
        productName: 'Ron',
        quantity: 10,
        supplierPrice: 10,
        salePrice: 20,
        totalCost: 105,
        additionalExpenses: 5,
        createdAt: new Date('2026-11-10T12:00:00Z'),
      },
      {
        id: 'suelta',
        productName: 'Sin proforma',
        quantity: 5,
        totalCost: 50,
      },
    ]);

    expect(groups).toHaveLength(1);
    const [group] = groups;
    expect(group.number).toBe('P-0002');
    expect(group.supplier).toBe('Distribuidora');
    expect(group.docType).toBe('Factura');
    expect(group.branchName).toBe('Centro');
    expect(group.items.map((item) => item.id)).toEqual(['linea-1', 'linea-2']);
    expect(group.itemCount).toBe(2);
    expect(group.units).toBe(34);
    expect(group.baseTotal).toBe(220);
    expect(group.total).toBe(235);
    expect(group.extraTotal).toBe(30);
  });

  it('usa valores por defecto y ordena la más reciente primero', () => {
    const groups = groupReplenishmentsByProforma([
      {
        id: 'a',
        proformaId: 'pf-vieja',
        proformaDate: '2026-10-01',
        lineNumber: 1,
        quantity: 1,
        supplierPrice: 10,
        totalCost: 10,
        additionalExpenses: 2,
      },
      {
        id: 'b',
        proformaId: 'pf-nueva',
        proformaDate: '2026-11-01',
        lineNumber: 1,
        quantity: 2,
        supplierPrice: 10,
        totalCost: 20,
        additionalExpenses: 0,
      },
    ]);

    expect(groups.map((group) => group.id)).toEqual(['pf-nueva', 'pf-vieja']);
    expect(groups[1].number).toBe('Sin número');
    expect(groups[1].docType).toBe('Proforma');
    expect(groups[1].extraTotal).toBe(2);
  });
});

describe('guardado de proformas', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('guarda todas las líneas, prorratea gastos y suma stock en la sede', async () => {
    const businessId = generateUUID();
    const branchId = generateUUID();
    const mainBranchId = generateUUID();
    const productId = generateUUID();

    await db.products.add({
      id: productId,
      business_id: businessId,
      name: 'Ron',
      barcode: null,
      price: 20,
      stock: 5,
      min_stock: 5,
      brand: 'Casa',
      category: 'Vinos y tragos',
      description: '',
      image_url: '',
      supplier_price: 10,
      unit: 'Unidad',
      unit_label: 'Unidad',
      presentations: [],
      is_dish: false,
      is_available: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const result = await savePurchaseProforma(businessId, {
      header: {
        number: 'P-0100',
        date: '2026-11-11',
        supplier: 'Proveedor',
        docType: 'Factura',
        notes: 'Lote nuevo',
      },
      items: [
        {
          productId,
          productName: 'Ron',
          factor: 1,
          packCount: '10',
          looseUnits: '',
          costMode: 'unit',
          costInput: '10',
          salePrice: '20',
          lotCode: 'L-1',
          expiryDate: '2027-01-01',
          presentationName: 'Unidad',
        },
        {
          isNewProduct: true,
          productName: 'Vodka',
          factor: 6,
          packCount: '2',
          looseUnits: '1',
          costMode: 'package',
          costInput: '60',
          salePrice: '30',
          lotCode: 'L-2',
          expiryDate: '2027-02-01',
          presentationName: 'Caja',
          newProduct: {
            name: 'Vodka',
            category: 'Vinos y tragos',
            brand: 'Nueva',
            barcode: '123456',
            price: 30,
            presentations: [
              { id: 'base-unit', name: 'Unidad', factor: 1, price: 30, isBase: true },
            ],
          },
        },
      ],
      extraCosts: [{ concept: 'Flete', amount: 30 }],
      branchId,
      branchName: 'Centro',
      mainBranchId,
      requireExpiry: true,
    });

    expect(result.number).toBe('P-0100');
    expect(result.itemCount).toBe(2);
    expect(result.units).toBe(23);
    expect(result.totalExtra).toBe(30);
    expect(result.total).toBe(260);

    const lines = await db.replenishments
      .where('business_id')
      .equals(businessId)
      .toArray();
    expect(lines).toHaveLength(2);
    const ronLine = lines.find((line) => line.product_name === 'Ron');
    const vodkaLine = lines.find((line) => line.product_name === 'Vodka');

    expect(ronLine.proforma_id).toBe(result.proformaId);
    expect(ronLine.proforma_number).toBe('P-0100');
    expect(ronLine.proforma_extra_total).toBe(30);
    expect(ronLine.line_number).toBe(1);
    expect(ronLine.lot_code).toBe('L-1');
    expect(ronLine.expiry_date).toBe('2027-01-01');
    expect(ronLine.branch_id).toBe(branchId);
    expect(ronLine.branch_name).toBe('Centro');
    expect(ronLine.supplier_price).toBe(10);
    expect(ronLine.additional_expenses).toBe(13.04);
    expect(ronLine.total_cost).toBeCloseTo(113.04, 10);

    expect(vodkaLine.line_number).toBe(2);
    expect(vodkaLine.quantity).toBe(13);
    expect(vodkaLine.purchase_unit_type).toBe('package');
    expect(vodkaLine.package_size).toBe(6);
    expect(vodkaLine.package_count).toBe(2);
    expect(vodkaLine.presentation_name).toBe('Caja');
    expect(vodkaLine.supplier_price).toBe(10);
    expect(vodkaLine.additional_expenses).toBe(16.96);
    expect(vodkaLine.total_cost).toBeCloseTo(146.96, 10);

    const ron = await db.products.get(productId);
    expect(ron.stock).toBe(15);
    expect(ron.supplier_price).toBeCloseTo(11.304, 6);
    expect(ron.price).toBe(20);

    const ronBranch = await db.branch_stock.get(`${branchId}:${productId}`);
    expect(ronBranch.stock).toBe(10);
    const mainBranchRow = await db.branch_stock.get(`${mainBranchId}:${productId}`);
    expect(mainBranchRow.stock).toBe(5);

    const vodka = await db.products
      .where('business_id')
      .equals(businessId)
      .and((product) => product.name === 'Vodka')
      .first();
    expect(vodka.stock).toBe(13);
    expect(vodka.presentations).toEqual([
      { id: 'base-unit', name: 'Unidad', factor: 1, price: 30, isBase: true },
    ]);
    expect(await db.branch_stock.get(`${branchId}:${vodka.id}`)).toMatchObject({ stock: 13 });
  });

  it('suma stock por cajas decimales, aplica descuento y alerta el cambio de precio', async () => {
    const businessId = generateUUID();
    const branchId = generateUUID();
    const mainBranchId = generateUUID();
    const productId = generateUUID();

    await db.products.add({
      id: productId,
      business_id: businessId,
      name: 'Cerveza Paceña',
      barcode: '123456',
      price: 25,
      stock: 0,
      min_stock: 5,
      brand: 'Paceña',
      category: 'Cervezas',
      description: '',
      image_url: '',
      supplier_price: 8,
      unit: 'Unidad',
      unit_label: 'Unidad',
      package_size: 12,
      presentations: [
        { id: 'base-unit', name: 'Unidad', factor: 1, price: 25, isBase: true },
        { id: 'caja-12', name: 'Caja', factor: 12, price: 240, isBase: false },
      ],
      last_purchase_package_price: 100,
      last_purchase_package_factor: 12,
      last_purchase_supplier: 'Distribuidora',
      is_dish: false,
      is_available: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const result = await savePurchaseProforma(businessId, {
      header: {
        number: 'PRF-202611-0083',
        date: '2026-11-11',
        supplier: 'Distribuidora',
        receivedBy: 'Ana',
      },
      items: [{
        productId,
        productName: 'Cerveza Paceña',
        factor: 12,
        packageQty: '1.5',
        packagePrice: '150',
        salePrice: '25',
        presentationName: 'Caja',
        noExpiry: true,
        expiryDate: '',
      }],
      discount: 15,
      branchId,
      branchName: 'Centro',
      mainBranchId,
      requireExpiry: true,
    });

    expect(result.packages).toBe(1.5);
    expect(result.units).toBe(18);
    expect(result.discount).toBe(15);
    expect(result.total).toBe(210);
    expect(result.alerts).toBe(1);

    const line = await db.replenishments.where('business_id').equals(businessId).first();
    expect(line.purchase_unit_type).toBe('package');
    expect(line.package_size).toBe(12);
    expect(line.package_count).toBe(1.5);
    expect(line.package_price).toBe(150);
    expect(line.quantity).toBe(18);
    expect(line.supplier_price).toBe(12.5);
    expect(line.total_cost).toBe(210);
    expect(line.proforma_discount).toBe(15);
    expect(line.proforma_received_by).toBe('Ana');
    expect(line.expiry_date).toBeNull();
    expect(line.lot_code).toBe('PRF-202611-0083-01');

    const product = await db.products.get(productId);
    expect(product.stock).toBe(18);
    expect(product.last_purchase_package_price).toBe(150);
    expect(product.last_purchase_package_factor).toBe(12);
    expect(product.last_purchase_proforma_number).toBe('PRF-202611-0083');
    expect(product.supplier_price).toBeCloseTo(11.666667, 6);

    const alert = await db.purchase_price_alerts.where('business_id').equals(businessId).first();
    expect(alert.product_id).toBe(productId);
    expect(alert.product_code).toBe('123456');
    expect(alert.old_package_price).toBe(96);
    expect(alert.new_package_price).toBe(150);
    expect(alert.difference_amount).toBe(54);
    expect(alert.difference_pct).toBe(56.25);
    expect(alert.package_factor).toBe(12);
    expect(alert.status).toBe('pending');
  });

  it('no alerta si el precio de compra coincide con el actual del producto', async () => {
    const businessId = generateUUID();
    const productId = generateUUID();

    await db.products.add({
      id: productId,
      business_id: businessId,
      name: 'Papas',
      barcode: '777',
      price: 30,
      stock: 0,
      min_stock: 5,
      category: 'Snacks',
      supplier_price: 12.5,
      package_size: 12,
      last_purchase_package_price: 100,
      last_purchase_package_factor: 12,
      is_dish: false,
      is_available: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const result = await savePurchaseProforma(businessId, {
      header: { number: 'PRF-202611-0084', date: '2026-11-11' },
      items: [{
        productId,
        productName: 'Papas',
        factor: 12,
        packageQty: '1',
        packagePrice: '150',
        salePrice: '30',
        presentationName: 'Caja',
        noExpiry: true,
      }],
    });

    expect(result.alerts).toBe(0);
    expect(await db.purchase_price_alerts.count()).toBe(0);
  });

  it('no escribe nada si la proforma no es válida', async () => {
    const businessId = generateUUID();

    await expect(savePurchaseProforma(businessId, {
      header: { number: '', date: '' },
      items: [validItem()],
    })).rejects.toThrow('Escribí el número de la proforma.');

    expect(await db.replenishments.count()).toBe(0);
    expect(await db.products.count()).toBe(0);
  });

  it('rechaza crear un producto nuevo cuyo nombre ya existe', async () => {
    const businessId = generateUUID();
    await db.products.add({
      id: generateUUID(),
      business_id: businessId,
      name: 'Ron Viejo',
      price: 20,
      stock: 1,
      category: 'Vinos y tragos',
    });

    await expect(savePurchaseProforma(businessId, {
      header: { number: 'P-0101', date: '2026-11-11' },
      items: [{
        isNewProduct: true,
        productName: 'RON VIEJO',
        factor: 1,
        packCount: '1',
        costMode: 'unit',
        costInput: '10',
        salePrice: '20',
        newProduct: { name: 'RON VIEJO', price: 20 },
      }],
    })).rejects.toThrow('Ya existe el producto "Ron Viejo"');

    expect(await db.replenishments.count()).toBe(0);
  });

  it('guarda, restaura y limpia el borrador de proforma', async () => {
    const businessId = generateUUID();
    const userId = generateUUID();

    await saveProformaDraft(businessId, userId, {
      header: { number: 'P-0009', date: '2026-11-11', supplier: '' },
      items: [validItem()],
      extraCosts: [],
      branchId: null,
    });

    const draft = await getProformaDraft(businessId, userId);
    expect(draft.kind).toBe('proforma');
    expect(draft.header.number).toBe('P-0009');
    expect(draft.items).toHaveLength(1);

    await clearProformaDraft(businessId, userId);
    expect(await getProformaDraft(businessId, userId)).toBeNull();
  });

  it('descarta borradores de proforma con más de 24 horas', async () => {
    const businessId = generateUUID();
    const userId = generateUUID();
    const id = `${businessId}_${userId}_proforma`;
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

    await db.purchase_drafts.put({
      id,
      business_id: businessId,
      user_id: userId,
      kind: 'proforma',
      header: { number: 'P-0010' },
      items: [],
      extraCosts: [],
      updated_at: old,
    });

    expect(await getProformaDraft(businessId, userId)).toBeNull();
    expect(await db.purchase_drafts.get(id)).toBeUndefined();
  });
});
