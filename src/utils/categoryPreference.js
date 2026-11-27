const CATEGORY_FILTER_PREFIX = 'mg-category-filter';

function storageKey(scope, businessId, userId) {
  if (!scope || !businessId) return null;
  return `${CATEGORY_FILTER_PREFIX}:${scope}:${businessId}:${userId || 'anon'}`;
}

export function readCategoryFilter(scope, businessId, userId, fallback = 'Todas') {
  const key = storageKey(scope, businessId, userId);
  if (!key) return fallback;
  try {
    const saved = localStorage.getItem(key);
    return typeof saved === 'string' && saved ? saved : fallback;
  } catch {
    return fallback;
  }
}

export function saveCategoryFilter(scope, businessId, userId, category) {
  const key = storageKey(scope, businessId, userId);
  if (!key || typeof category !== 'string' || !category) return;
  try {
    localStorage.setItem(key, category);
  } catch {
    // Sin almacenamiento disponible: el filtro queda solo en memoria.
  }
}
