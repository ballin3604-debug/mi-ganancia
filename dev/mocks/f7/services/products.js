const PRODUCTS = [
  { id: 'p1', name: 'Coca-Cola 2L', category: 'Bebidas', price: 12, cost: 9, stock: 4, minStock: 8, unitLabel: 'Unidad', barcode: '7791234567890', imageData: '' },
  { id: 'p2', name: 'Arroz 1kg', category: 'Abarrotes', price: 8, cost: 6.5, stock: 24, minStock: 10, unitLabel: 'Unidad', barcode: '', imageData: '' },
  { id: 'p3', name: 'Aceite 1L', category: 'Abarrotes', price: 22, cost: 18, stock: 3, minStock: 6, unitLabel: 'Unidad', barcode: '', imageData: '' },
  { id: 'p4', name: 'Leche 1L', category: 'Lácteos', price: 9.5, cost: 7.5, stock: 6, minStock: 12, unitLabel: 'Unidad', barcode: '', imageData: '' },
  { id: 'p5', name: 'Detergente 500g', category: 'Limpieza', price: 15, cost: 11, stock: 18, minStock: 5, unitLabel: 'Unidad', barcode: '', imageData: '' },
];

export async function getProducts() {
  return PRODUCTS;
}

export function subscribeToProducts(businessId, callback) {
  callback(PRODUCTS);
  return () => {};
}

export function subscribeToReplenishments(businessId, callback) {
  callback([]);
  return () => {};
}

export async function addProduct() {
  return true;
}

export async function updateProduct() {
  return true;
}

export async function deleteProduct() {
  return true;
}

export async function updateReplenishmentExpiry() {
  return true;
}
