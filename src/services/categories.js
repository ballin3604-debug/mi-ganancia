import { db } from './localDb';
import { enqueueOperation, buildOutboxOp } from './syncEngine';
import { supabase, assertSupabase, isSupabaseConfigured } from './supabaseClient';
import { notifyProductChanges } from './products';
import { getCategoryById } from '../config/businessCategories';
import { LICOR_CATEGORIES, normalizeLicorCategory } from '../config/licorCatalog';

export const DEFAULT_CATEGORIES = [
  'Bebidas', 'Lácteos', 'Panadería', 'Carnes', 'Frutas y Verduras',
  'Limpieza', 'Higiene personal', 'Snacks y dulces', 'Granos y cereales',
  'Condimentos', 'Medicamentos', 'Electrónicos', 'Ropa', 'Papelería', 'Otros',
];

export function getDefaultCategories(businessCategory) {
  const cat = getCategoryById(businessCategory);
  return cat.defaultCategories || DEFAULT_CATEGORIES;
}

// Licorería: el catálogo es fijo. Además de cambiar la lista, remapea los
// productos que quedaron con categorías viejas (Whiskey, Ron, Refrescos…)
// para que no queden huérfanos en los filtros ni en los reportes.
const licorEnsured = new Set();

export async function ensureLicorCategories(businessId, localSettings = null) {
  const local = localSettings || await db.business_settings.get(businessId);
  const current = Array.isArray(local?.categories) ? local.categories : [];
  const needsCategoryUpdate = current.length !== LICOR_CATEGORIES.length
    || current.some((category, index) => category !== LICOR_CATEGORIES[index]);

  if (licorEnsured.has(businessId)) {
    return needsCategoryUpdate ? LICOR_CATEGORIES : current;
  }
  licorEnsured.add(businessId);

  if (needsCategoryUpdate) {
    await db.business_settings.put({
      business_id: businessId,
      ...local,
      categories: LICOR_CATEGORIES,
    });
    await enqueueOperation(
      'SAVE_BUSINESS_SETTINGS',
      { business_id: businessId, categories: LICOR_CATEGORIES },
      businessId
    );
  }

  const all = await db.products.where('business_id').equals(businessId).toArray();
  const affected = all.filter((product) => !LICOR_CATEGORIES.includes(product.category));
  if (affected.length > 0) {
    const now = new Date().toISOString();
    await db.transaction('rw', db.products, db.pending_operations, async () => {
      for (const product of affected) {
        const category = normalizeLicorCategory(product.category);
        await db.products.update(product.id, { category, updated_at: now });
        await db.pending_operations.add(
          buildOutboxOp('UPDATE_PRODUCT', { id: product.id, category, updated_at: now }, businessId)
        );
      }
    });
    notifyProductChanges(businessId);
  }

  return LICOR_CATEGORIES;
}

const categoryListeners = new Set();

function notifyCategoryChanges(businessId) {
  getCategories(businessId).then((cats) => {
    categoryListeners.forEach((callback) => callback(cats));
  }).catch(console.error);
}

// A diferencia de getCategories (lectura puntual), esto se re-dispara cuando
// otro dispositivo agrega/quita una categoría y ese cambio llega por sync —
// sin esto, una pantalla ya abierta nunca se enteraba hasta recargar.
export function subscribeToCategories(businessId, callback) {
  getCategories(businessId).then(callback).catch(console.error);
  categoryListeners.add(callback);
  return () => {
    categoryListeners.delete(callback);
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener('tuganancia-cache-synced', (e) => {
    if (e.detail && e.detail.businessId) {
      notifyCategoryChanges(e.detail.businessId);
    }
  });
}

export async function getCategories(businessId, businessCategory) {
  // Read local first
  const local = await db.business_settings.get(businessId);
  const categoryHint = businessCategory || local?.business_category || local?.businessCategory;
  if (categoryHint === 'licorera') {
    return ensureLicorCategories(businessId, local);
  }
  if (local && local.categories) {
    return local.categories;
  }

  // Fallback to Supabase if online, write to cache
  try {
    const { data, error } = await assertSupabase()
      .from('business_settings')
      .select('categories, business_category')
      .eq('business_id', businessId)
      .maybeSingle();

    if (!error && data && data.categories) {
      const existing = await db.business_settings.get(businessId);
      const updated = { business_id: businessId, ...existing, categories: data.categories, business_category: data.business_category || existing?.business_category };
      await db.business_settings.put(updated);
      if (updated.business_category === 'licorera') {
        return ensureLicorCategories(businessId, updated);
      }
      return data.categories;
    }

    // Row does not exist on Supabase, initialize with the sector defaults
    if (!data) {
      const defaults = getDefaultCategories(categoryHint);
      const existing = await db.business_settings.get(businessId);
      const updated = { business_id: businessId, ...existing, categories: defaults };
      await db.business_settings.put(updated);

      // Queue write to Supabase
      await enqueueOperation('SAVE_BUSINESS_SETTINGS', { business_id: businessId, categories: defaults }, businessId);
      return defaults;
    }

    return getDefaultCategories(categoryHint || data.business_category);
  } catch (err) {
    console.warn('getCategories: offline fallback to sector categories', err);
  }

  // Fallback if offline and no cache
  return getDefaultCategories(categoryHint);
}

export async function addCategory(businessId, name) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const current = await getCategories(businessId);
  if (current.includes(trimmed)) return;
  const next = [...current, trimmed];

  // Optimistic local update with partial merge
  const existing = await db.business_settings.get(businessId);
  const updated = { business_id: businessId, ...existing, categories: next };
  await db.business_settings.put(updated);

  // Enqueue outbox operation with partial payload (only changed field)
  await enqueueOperation('SAVE_BUSINESS_SETTINGS', { business_id: businessId, categories: next }, businessId);
  notifyCategoryChanges(businessId);
}

// Renombra una categoría. Como los productos guardan su categoría por NOMBRE
// (no por id), hay que arrastrar el cambio a todos los productos de esa
// categoría — si no, quedan apuntando a un nombre que ya no existe en la
// lista (huérfanos: no aparecen en los filtros ni se agrupan bien).
export async function renameCategory(businessId, oldName, newName) {
  const trimmed = (newName || '').trim();
  if (!trimmed || trimmed === oldName) return;

  const current = await getCategories(businessId);
  if (!current.includes(oldName)) throw new Error('La categoría ya no existe.');
  // No permitir chocar con otra categoría existente (insensible a mayúsculas).
  if (current.some((c) => c !== oldName && c.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error(`La categoría "${trimmed}" ya existe.`);
  }

  const next = current.map((c) => (c === oldName ? trimmed : c));

  // 1) Actualizar la lista de categorías (local + outbox).
  const existing = await db.business_settings.get(businessId);
  await db.business_settings.put({ business_id: businessId, ...existing, categories: next });
  await enqueueOperation('SAVE_BUSINESS_SETTINGS', { business_id: businessId, categories: next }, businessId);

  // 2) Cascada: reasignar los productos de la categoría vieja a la nueva.
  //    Se usa un UPDATE parcial (solo el campo category) para no tocar stock
  //    ni ningún otro dato del producto.
  const all = await db.products.where('business_id').equals(businessId).toArray();
  const affected = all.filter((p) => p.category === oldName);
  if (affected.length > 0) {
    const now = new Date().toISOString();
    await db.transaction('rw', db.products, db.pending_operations, async () => {
      for (const p of affected) {
        await db.products.update(p.id, { category: trimmed, updated_at: now });
        await db.pending_operations.add(
          buildOutboxOp('UPDATE_PRODUCT', { id: p.id, category: trimmed, updated_at: now }, businessId)
        );
      }
    });
    notifyProductChanges(businessId);
  }

  notifyCategoryChanges(businessId);
  return affected.length; // cuántos productos se reasignaron
}

export async function removeCategory(businessId, name) {
  const current = await getCategories(businessId);
  const next = current.filter(c => c !== name);

  // Optimistic local update with partial merge
  const existing = await db.business_settings.get(businessId);
  const updated = { business_id: businessId, ...existing, categories: next };
  await db.business_settings.put(updated);

  // Enqueue outbox operation with partial payload (only changed field)
  await enqueueOperation('SAVE_BUSINESS_SETTINGS', { business_id: businessId, categories: next }, businessId);
  notifyCategoryChanges(businessId);
}
