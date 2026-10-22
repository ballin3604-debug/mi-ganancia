import {
  BRANCHES,
  PRODUCTS as RAW_PRODUCTS,
  ALL_SALES,
  SALE_ITEMS,
  BRANCH_STOCKS,
  BUSINESS,
  SETTINGS,
} from '../f4/data.js';

export { BRANCHES, BUSINESS, SETTINGS };

const EXTRAS = {
  p1: { brand: 'Coca-Cola', barcode: '777100000001', unitLabel: 'Botella', packageSize: 12, packLabel: 'Caja', packPrice: 120, packPriceHot: 132 },
  p2: { brand: 'Granos del Sur', barcode: '777100000002', unitLabel: 'Bolsa' },
  p3: { brand: 'Fino', barcode: '777100000003', unitLabel: 'Botella' },
  p4: { brand: 'Pil', barcode: '777100000004', unitLabel: 'Sachet', packageSize: 12, packLabel: 'Caja', packPrice: 96 },
  p5: { brand: 'Omo', barcode: '777100000005', unitLabel: 'Botella' },
  p6: { brand: 'Pringles', barcode: '777100000006', unitLabel: 'Paquete' },
  p7: { brand: 'Bimbo', barcode: '777100000007', unitLabel: 'Pan' },
  p8: { brand: 'Cielo', barcode: '777100000008', unitLabel: 'Botella', packageSize: 6, packLabel: 'Paquete', packPrice: 30 },
  p9: { brand: 'Pil', barcode: '777100000009', unitLabel: 'Botella' },
  p10: { brand: 'Dove', barcode: '777100000010', unitLabel: 'Barra' },
};

export const PRODUCTS = RAW_PRODUCTS.map((product) => ({
  ...product,
  supplierPrice: product.cost,
  imageData: '',
  description: '',
  unit: 'Unidad',
  minStock: product.minStock || 5,
  ...EXTRAS[product.id],
}));

export const SALES = ALL_SALES.map((sale) => ({
  ...sale,
  seller_name: sale.sellerName,
  createdBy: sale.createdBy,
  created_by: sale.createdBy,
}));

export const ITEMS = Object.entries(SALE_ITEMS).flatMap(([saleId, items]) =>
  items.map((item, index) => ({
    ...item,
    id: `${saleId}-${index}`,
    saleId,
    price: item.quantity > 0 ? item.subtotal / item.quantity : 0,
  }))
);

export const CUSTOMERS = [
  { id: 'c1', name: 'Consumidor final', nit: '0' },
  { id: 'c2', name: 'María Fernanda López', nit: '8451236' },
  { id: 'c3', name: 'Tienda El Sol', nit: '1029384756' },
];

export const CATEGORIES = [...new Set(PRODUCTS.map((p) => p.category))];

export const TEAM_MEMBERS = [
  { id: 'u-dueno', name: 'Rosa Quispe', branchIds: [] },
  { id: 'u-cajero', name: 'Carlos Mamani', branchIds: ['b-centro'] },
];

export const STOCK_ROWS = BRANCH_STOCKS;
