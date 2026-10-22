import {
  EXPENSES as BASE_EXPENSES,
  REPLENISHMENTS as BASE_REPLENISHMENTS,
  BUSINESS,
  SETTINGS,
} from '../f4/data.js';
import {
  PRODUCTS,
  SALES as BASE_SALES,
  ITEMS as BASE_ITEMS,
  STOCK_ROWS,
} from '../f5/data.js';

export { BUSINESS, SETTINGS, PRODUCTS, STOCK_ROWS };

function atOffset(days, hours, minutes) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

const HISTORY = [1, 2, 3, 4, 5].map((offset, index) => {
  const base = BASE_SALES[index % 4];
  const id = `f6-hist-${offset}`;
  const items = BASE_ITEMS
    .filter((item) => item.saleId === base.id)
    .map((item, itemIndex) => ({
      ...item,
      id: `${id}-${itemIndex}`,
      saleId: id,
    }));
  return {
    sale: {
      ...base,
      id,
      createdAt: atOffset(-offset, 10 + index, 15),
      total: items.reduce((sum, item) => sum + item.subtotal, 0),
    },
    items,
  };
});

export const SALES = [...BASE_SALES, ...HISTORY.map((entry) => entry.sale)];
export const ITEMS = [...BASE_ITEMS, ...HISTORY.flatMap((entry) => entry.items)].map((item) => ({
  ...item,
  productId: item.productId || PRODUCTS.find((product) => product.name === item.productName)?.id,
}));

const EXPENSE_META = [
  { dayOffset: 0, hour: 9, category: 'Limpieza', expense_type: 'daily', supplier: 'Distribuidora Andina' },
  { dayOffset: 0, hour: 11, category: 'Alquiler', expense_type: 'fixed', supplier: 'Inmobiliaria Central' },
  { dayOffset: -1, hour: 9, category: 'Servicios', expense_type: 'fixed', supplier: 'CRE' },
  { dayOffset: -2, hour: 10, category: 'Transporte', expense_type: 'daily', supplier: 'Transportes Sur' },
  { dayOffset: -3, hour: 8, category: 'Alquiler', expense_type: 'fixed', supplier: 'Inmobiliaria Central' },
  { dayOffset: -3, hour: 15, category: 'Servicios', expense_type: 'fixed', supplier: 'CRE' },
  { dayOffset: -4, hour: 12, category: 'Insumos', expense_type: 'daily', supplier: 'Comercial Uno' },
  { dayOffset: -5, hour: 16, category: 'Alquiler', expense_type: 'fixed', supplier: 'Inmobiliaria Central' },
];

export const EXPENSES = BASE_EXPENSES.map((expense, index) => {
  const meta = EXPENSE_META[index % EXPENSE_META.length];
  const { dayOffset, hour, ...fields } = meta;
  return {
    ...expense,
    ...fields,
    createdAt: atOffset(dayOffset, hour, 20),
  };
});

const REPLENISHMENT_META = [
  { quantity: 12, additionalExpenses: 25, supplier: 'Coca-Cola Bolivia' },
  { quantity: 8, additionalExpenses: 18, supplier: 'Pil Andina' },
  { quantity: 10, additionalExpenses: 12, supplier: 'Panificadora Bimbo' },
  { quantity: 6, additionalExpenses: 20, supplier: 'Pil Andina' },
  { quantity: 9, additionalExpenses: 30, supplier: 'Fino' },
];

export const REPLENISHMENTS = BASE_REPLENISHMENTS.map((replenishment, index) => {
  const product = PRODUCTS.find((item) => item.id === replenishment.productId);
  const meta = REPLENISHMENT_META[index % REPLENISHMENT_META.length];
  return {
    ...replenishment,
    ...meta,
    supplierPrice: product?.cost || 0,
  };
});
