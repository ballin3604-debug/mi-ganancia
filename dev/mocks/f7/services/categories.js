export async function getCategories() {
  return ['Bebidas', 'Abarrotes', 'Lácteos'];
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
