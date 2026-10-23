const SALE_DATE = new Date(2026, 9, 22, 10, 42, 0, 0);

const SALE = {
  id: 'sale-f8-demo-0001',
  total: 87.5,
  paymentMethod: 'mixto',
  createdAt: SALE_DATE,
  clientName: 'María López',
  clientNit: '7788990',
  sellerName: 'Rosa Quispe',
  montoEfectivo: 50,
  montoQR: 37.5,
};

const ITEMS = [
  { id: 'i1', productName: 'Arroz 1kg', productBrand: 'Grano de Oro', quantity: 2, price: 8, subtotal: 16 },
  { id: 'i2', productName: 'Aceite 1L', productBrand: 'Fino', quantity: 1, price: 22, subtotal: 22 },
  { id: 'i3', productName: 'Leche 1L', productBrand: 'Pil', quantity: 3, price: 9.5, subtotal: 28.5 },
  { id: 'i4', productName: 'Detergente 500g', productBrand: 'Omo', quantity: 1, price: 21, subtotal: 21 },
];

export async function getSaleById() {
  return SALE;
}

export async function getSaleItems() {
  return ITEMS;
}
