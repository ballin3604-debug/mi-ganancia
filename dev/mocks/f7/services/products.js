export async function getProducts() {
  return [];
}

export function subscribeToProducts(businessId, callback) {
  callback([]);
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
