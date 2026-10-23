export const DEFAULT_CATEGORIES = ['Bebidas', 'Abarrotes', 'Lácteos', 'Limpieza', 'Otros'];

export async function getCategories() {
  return DEFAULT_CATEGORIES;
}

export function subscribeToCategories(businessId, callback) {
  callback(['Bebidas', 'Abarrotes', 'Lácteos']);
  return () => {};
}

export async function addCategory() {
  return true;
}

export async function removeCategory() {
  return true;
}

export async function renameCategory() {
  return true;
}
