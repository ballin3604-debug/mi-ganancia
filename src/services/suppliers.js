import { db } from './localDb';
import { enqueueOperation } from './syncEngine';
import { supabase } from './supabaseClient';

const supplierListeners = new Set();

function notifySupplierChanges(businessId) {
  getSuppliers(businessId).then((sups) => {
    supplierListeners.forEach((callback) => callback(sups));
  }).catch(console.error);
}

// A diferencia de getSuppliers (lectura puntual), esto se re-dispara cuando
// otro dispositivo agrega/quita un proveedor y ese cambio llega por sync.
export function subscribeToSuppliers(businessId, callback) {
  getSuppliers(businessId).then(callback).catch(console.error);
  supplierListeners.add(callback);
  return () => {
    supplierListeners.delete(callback);
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener('tuganancia-cache-synced', (e) => {
    if (e.detail && e.detail.businessId) {
      notifySupplierChanges(e.detail.businessId);
    }
  });
}

export async function getSuppliers(businessId) {
  if (!businessId) return [];

  // Read local first
  const local = await db.business_settings.get(businessId);
  if (local && Array.isArray(local.purchase_suppliers)) {
    return local.purchase_suppliers;
  }

  // Fallback to Supabase if online
  try {
    const { data, error } = await supabase
      .from('business_settings')
      .select('purchase_suppliers')
      .eq('business_id', businessId)
      .maybeSingle();

    if (!error && data && Array.isArray(data.purchase_suppliers)) {
      const existing = await db.business_settings.get(businessId);
      const updated = { business_id: businessId, ...existing, purchase_suppliers: data.purchase_suppliers };
      await db.business_settings.put(updated);
      return data.purchase_suppliers;
    }
  } catch (err) {
    console.warn('getSuppliers: offline fallback', err);
  }

  return [];
}

export async function addSupplier(businessId, name) {
  const trimmed = (name || '').trim();
  if (!trimmed || !businessId) return;

  const current = await getSuppliers(businessId);
  if (current.some((s) => s.toLowerCase() === trimmed.toLowerCase())) return current;

  const next = [...current, trimmed];

  const existing = await db.business_settings.get(businessId);
  const updated = { business_id: businessId, ...existing, purchase_suppliers: next };
  await db.business_settings.put(updated);

  await enqueueOperation('SAVE_BUSINESS_SETTINGS', { business_id: businessId, purchase_suppliers: next }, businessId);
  notifySupplierChanges(businessId);
  return next;
}

export async function removeSupplier(businessId, name) {
  if (!businessId) return;

  const current = await getSuppliers(businessId);
  const next = current.filter((s) => s !== name);

  const existing = await db.business_settings.get(businessId);
  const updated = { business_id: businessId, ...existing, purchase_suppliers: next };
  await db.business_settings.put(updated);

  await enqueueOperation('SAVE_BUSINESS_SETTINGS', { business_id: businessId, purchase_suppliers: next }, businessId);
  notifySupplierChanges(businessId);
  return next;
}
