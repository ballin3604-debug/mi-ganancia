import { db } from './localDb';
import { enqueueOperation, buildOutboxOp } from './syncEngine';
import { supabase } from './supabaseClient';
import { notifyProductChanges } from './products';

export const DEFAULT_CATEGORIES = [
  'Bebidas', 'Lácteos', 'Panadería', 'Carnes', 'Frutas y Verduras',
  'Limpieza', 'Higiene personal', 'Snacks y dulces', 'Granos y cereales',
  'Condimentos', 'Medicamentos', 'Electrónicos', 'Ropa', 'Papelería', 'Otros',
];

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

export async function getCategories(businessId) {
  // Read local first
  const local = await db.business_settings.get(businessId);
  if (local && local.categories) {
    return local.categories;
  }

  // Fallback to Supabase if online, write to cache
  try {
    const { data, error } = await supabase
      .from('business_settings')
      .select('categories')
      .eq('business_id', businessId)
      .maybeSingle();

    if (!error && data && data.categories) {
      const existing = await db.business_settings.get(businessId);
      const updated = { business_id: businessId, ...existing, categories: data.categories };
      await db.business_settings.put(updated);
      return data.categories;
    }

    // Row does not exist on Supabase, initialize with default categories
    if (!data) {
      const existing = await db.business_settings.get(businessId);
      const updated = { business_id: businessId, ...existing, categories: DEFAULT_CATEGORIES };
      await db.business_settings.put(updated);

      // Queue write to Supabase
      await enqueueOperation('SAVE_BUSINESS_SETTINGS', { business_id: businessId, categories: DEFAULT_CATEGORIES }, businessId);
      return DEFAULT_CATEGORIES;
    }
  } catch (err) {
    console.warn('getCategories: offline fallback to DEFAULT_CATEGORIES', err);
  }

  // Fallback if offline and no cache
  return DEFAULT_CATEGORIES;
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
