const today = new Date();

function atToday(hours, minutes) {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function atDay(monthOffset, day, hours, minutes) {
  return new Date(today.getFullYear(), today.getMonth() + monthOffset, day, hours, minutes, 0, 0);
}

function isoDay(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(days) {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  return d;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

export const BRANCHES = [
  { id: 'b-centro', name: 'Sucursal Centro', type: 'tienda', isMain: true },
  { id: 'b-mercado', name: 'Sucursal Mercado', type: 'tienda', isMain: false },
  { id: 'b-deposito', name: 'Depósito Central', type: 'almacen', isMain: false },
];

const RAW_PRODUCTS = [
  { id: 'p1', name: 'Coca-Cola 2L', category: 'Bebidas', price: 12, cost: 9, stock: 4, minStock: 8 },
  { id: 'p2', name: 'Arroz 1kg', category: 'Abarrotes', price: 8, cost: 6.5, stock: 24, minStock: 10 },
  { id: 'p3', name: 'Aceite 1L', category: 'Abarrotes', price: 22, cost: 18, stock: 3, minStock: 6 },
  { id: 'p4', name: 'Leche 1L', category: 'Lácteos', price: 9.5, cost: 7.5, stock: 6, minStock: 12 },
  { id: 'p5', name: 'Detergente 500ml', category: 'Limpieza', price: 15, cost: 11, stock: 10, minStock: 5 },
  { id: 'p6', name: 'Papas fritas', category: 'Snacks', price: 10, cost: 7, stock: 18, minStock: 6 },
  { id: 'p7', name: 'Pan de molde', category: 'Panadería', price: 18, cost: 13, stock: 2, minStock: 5 },
  { id: 'p8', name: 'Agua 2L', category: 'Bebidas', price: 6, cost: 4, stock: 30, minStock: 12 },
  { id: 'p9', name: 'Yogurt 1L', category: 'Lácteos', price: 14, cost: 10, stock: 9, minStock: 4 },
  { id: 'p10', name: 'Jabón de baño', category: 'Limpieza', price: 7, cost: 5, stock: 5, minStock: 6 },
];

const byId = Object.fromEntries(RAW_PRODUCTS.map((p) => [p.id, p]));

export const PRODUCTS = RAW_PRODUCTS;

const sales = [];
const saleItems = {};

function addSale({ id, date, branchId, createdBy, sellerName, clientName = 'Consumidor final', paymentMethod, lines, montoQR = 0, montoEfectivo = 0 }) {
  const items = lines.map(([productId, quantity]) => {
    const product = byId[productId];
    return {
      saleId: id,
      productName: product.name,
      quantity,
      subtotal: round2(product.price * quantity),
      category: product.category,
      supplier_price: product.cost,
      presentation_factor: 1,
      presentation: '',
      image_url: '',
    };
  });
  const total = round2(items.reduce((sum, item) => sum + item.subtotal, 0));
  sales.push({
    id,
    createdAt: date,
    branchId,
    createdBy,
    sellerName,
    clientName,
    paymentMethod,
    total,
    montoQR,
    montoEfectivo,
  });
  saleItems[id] = items;
}

addSale({ id: 'hoy-1', date: atToday(8, 40), branchId: 'b-centro', createdBy: 'u-dueno', sellerName: 'Rosa', paymentMethod: 'cash', lines: [['p1', 2], ['p7', 1]] });
addSale({ id: 'hoy-2', date: atToday(9, 55), branchId: 'b-mercado', createdBy: 'u-dueno', sellerName: 'Rosa', paymentMethod: 'qr', lines: [['p2', 3], ['p3', 1], ['p4', 2], ['p6', 2]] });
addSale({ id: 'hoy-3', date: atToday(11, 10), branchId: 'b-centro', createdBy: 'u-cajero', sellerName: 'Carlos', paymentMethod: 'cash', lines: [['p9', 1], ['p6', 1], ['p8', 2]] });
addSale({ id: 'hoy-4', date: atToday(12, 25), branchId: 'b-centro', createdBy: 'u-dueno', sellerName: 'Rosa', paymentMethod: 'mixto', lines: [['p2', 4], ['p3', 2], ['p5', 1], ['p8', 4]], montoQR: 65, montoEfectivo: 50 });
addSale({ id: 'hoy-5', date: atToday(14, 5), branchId: 'b-mercado', createdBy: 'u-cajero', sellerName: 'Carlos', paymentMethod: 'qr', lines: [['p1', 2], ['p6', 4]] });
addSale({ id: 'hoy-6', date: atToday(15, 40), branchId: 'b-centro', createdBy: 'u-dueno', sellerName: 'Rosa', paymentMethod: 'cash', lines: [['p2', 2], ['p4', 2], ['p9', 1], ['p10', 1]] });
addSale({ id: 'hoy-7', date: atToday(17, 15), branchId: 'b-centro', createdBy: 'u-cajero', sellerName: 'Carlos', paymentMethod: 'qr', lines: [['p1', 1], ['p2', 1], ['p3', 2], ['p9', 2]] });
addSale({ id: 'hoy-8', date: atToday(18, 30), branchId: 'b-centro', createdBy: 'u-dueno', sellerName: 'Rosa', paymentMethod: 'cash', lines: [['p6', 1], ['p8', 3]] });

for (let m = 5; m >= 1; m -= 1) {
  for (let i = 0; i < 5; i += 1) {
    const lines = i % 2 === 0
      ? [['p1', 10 + i], ['p2', 20 + i], ['p6', 15 + i]]
      : [['p3', 5 + i], ['p4', 12 + i], ['p8', 30 + i], ['p9', 8 + i]];
    addSale({
      id: `hist-${m}-${i}`,
      date: atDay(-m, 3 + i * 5, 9 + i, 15),
      branchId: i % 2 === 0 ? 'b-centro' : 'b-mercado',
      createdBy: 'u-dueno',
      sellerName: 'Rosa',
      paymentMethod: i % 3 === 0 ? 'qr' : 'cash',
      lines,
    });
  }
}

for (let i = 0; i < 4; i += 1) {
  addSale({
    id: `mes-${i}`,
    date: atDay(0, 3 + i * 4, 10 + i, 20),
    branchId: i % 2 === 0 ? 'b-centro' : 'b-mercado',
    createdBy: 'u-dueno',
    sellerName: 'Rosa',
    paymentMethod: i % 2 === 0 ? 'cash' : 'mixto',
    lines: [['p2', 18 + i], ['p5', 6 + i], ['p7', 4 + i]],
    montoQR: i % 2 === 0 ? 0 : 70,
    montoEfectivo: i % 2 === 0 ? 0 : 50,
  });
}

export const ALL_SALES = sales;
export const TODAY_SALES = sales.filter((sale) => {
  const d = sale.createdAt;
  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
});
export const SALE_ITEMS = saleItems;

export const EXPENSES = [
  { id: 'exp-hoy', amount: 40, description: 'Insumos de limpieza', branch_id: 'b-centro', createdAt: atToday(9, 20) },
  { id: 'exp-1', amount: 260, description: 'Alquiler', branch_id: 'b-centro', createdAt: atDay(0, 2, 10, 0) },
  { id: 'exp-2', amount: 180, description: 'Servicios', branch_id: 'b-mercado', createdAt: atDay(0, 8, 11, 0) },
  { id: 'exp-3', amount: 320, description: 'Transporte', branch_id: 'b-centro', createdAt: atDay(-1, 12, 9, 0) },
  { id: 'exp-4', amount: 210, description: 'Alquiler', branch_id: 'b-centro', createdAt: atDay(-2, 4, 10, 0) },
  { id: 'exp-5', amount: 150, description: 'Servicios', branch_id: 'b-mercado', createdAt: atDay(-3, 6, 10, 0) },
  { id: 'exp-6', amount: 280, description: 'Insumos', branch_id: 'b-centro', createdAt: atDay(-4, 10, 10, 0) },
  { id: 'exp-7', amount: 190, description: 'Alquiler', branch_id: 'b-centro', createdAt: atDay(-5, 5, 10, 0) },
];

export const REPLENISHMENTS = [
  { id: 'rep-1', productId: 'p1', createdAt: atToday(8, 0), totalCost: 480, expiryDate: isoDay(addDays(5)) },
  { id: 'rep-2', productId: 'p4', createdAt: atToday(8, 10), totalCost: 420, expiryDate: isoDay(addDays(-2)) },
  { id: 'rep-3', productId: 'p7', createdAt: atToday(7, 30), totalCost: 180, expiryDate: isoDay(addDays(0)) },
  { id: 'rep-4', productId: 'p9', createdAt: atToday(7, 45), totalCost: 240, expiryDate: isoDay(addDays(20)) },
  { id: 'rep-5', productId: 'p3', createdAt: atToday(8, 5), totalCost: 360, expiryDate: isoDay(addDays(45)) },
];

export const BRANCH_STOCKS = PRODUCTS.flatMap((product) => [
  { branch_id: 'b-centro', product_id: product.id, stock: product.stock },
  { branch_id: 'b-mercado', product_id: product.id, stock: Math.max(0, product.stock - 2) },
]);

const qrSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" fill="#fff"/><g fill="#153449"><rect x="8" y="8" width="32" height="32"/><rect x="80" y="8" width="32" height="32"/><rect x="8" y="80" width="32" height="32"/><rect x="48" y="12" width="8" height="8"/><rect x="60" y="24" width="8" height="8"/><rect x="48" y="40" width="8" height="8"/><rect x="64" y="48" width="8" height="8"/><rect x="48" y="64" width="8" height="8"/><rect x="72" y="60" width="8" height="8"/><rect x="88" y="52" width="8" height="8"/><rect x="48" y="84" width="8" height="8"/><rect x="64" y="96" width="8" height="8"/><rect x="88" y="84" width="8" height="8"/></g></svg>`;

export const SETTINGS = {
  qrData: `data:image/svg+xml;utf8,${encodeURIComponent(qrSvg)}`,
  businessName: 'Bodega Doña Rosa',
};

export const BUSINESS = {
  id: 'demo-business',
  name: 'Bodega Doña Rosa',
};
