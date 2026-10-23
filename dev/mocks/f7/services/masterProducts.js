const MASTER_PRODUCTS = [
  { id: 'm1', name: 'Coca-Cola 2L', brand: 'Coca-Cola', category: 'Bebidas', unit: 'Unidad', suggestedPrice: 12, suggestedCost: 9 },
  { id: 'm2', name: 'Arroz 1kg', brand: 'Grano de Oro', category: 'Abarrotes', unit: 'Unidad', suggestedPrice: 8, suggestedCost: 6.5 },
  { id: 'm3', name: 'Leche 1L', brand: 'Pil', category: 'Lácteos', unit: 'Unidad', suggestedPrice: 9.5, suggestedCost: 7.5 },
];

export function masterImagePath(masterProductId) {
  return `master-products/${masterProductId}.jpg`;
}

export async function getMasterProducts() {
  return MASTER_PRODUCTS;
}

export async function addMasterProduct(data) {
  return { id: `m-${Date.now()}`, ...data };
}

export async function updateMasterProduct(id, data) {
  return { id, ...data };
}

export async function deleteMasterProduct() {
  return true;
}

export async function importCatalogToBusiness() {
  return true;
}
