import { db } from './localDb';
import { enqueueOperation } from './syncEngine';
import { supabase } from './supabaseClient';

export const DEFAULT_REPLENISHMENT_CONCEPTS = [
  'Transporte',
  'Comisión',
  'Flete',
  'Descarga',
  'Otros',
];

export async function getReplenishmentConcepts(businessId) {
  if (!businessId) return DEFAULT_REPLENISHMENT_CONCEPTS;

  // Read local first
  const local = await db.business_settings.get(businessId);
  if (local && Array.isArray(local.purchase_expense_concepts) && local.purchase_expense_concepts.length > 0) {
    return local.purchase_expense_concepts;
  }

  // Fallback to Supabase if online
  try {
    const { data, error } = await supabase
      .from('business_settings')
      .select('purchase_expense_concepts')
      .eq('business_id', businessId)
      .maybeSingle();

    if (!error && data && Array.isArray(data.purchase_expense_concepts) && data.purchase_expense_concepts.length > 0) {
      const existing = await db.business_settings.get(businessId);
      const updated = { business_id: businessId, ...existing, purchase_expense_concepts: data.purchase_expense_concepts };
      await db.business_settings.put(updated);
      return data.purchase_expense_concepts;
    }

    if (!data || !data.purchase_expense_concepts) {
      const existing = await db.business_settings.get(businessId);
      const updated = { business_id: businessId, ...existing, purchase_expense_concepts: DEFAULT_REPLENISHMENT_CONCEPTS };
      await db.business_settings.put(updated);

      await enqueueOperation('SAVE_BUSINESS_SETTINGS', { business_id: businessId, purchase_expense_concepts: DEFAULT_REPLENISHMENT_CONCEPTS }, businessId);
      return DEFAULT_REPLENISHMENT_CONCEPTS;
    }
  } catch (err) {
    console.warn('getReplenishmentConcepts: offline fallback', err);
  }

  return DEFAULT_REPLENISHMENT_CONCEPTS;
}

export async function addReplenishmentConcept(businessId, name) {
  const trimmed = name.trim();
  if (!trimmed || !businessId) return;

  const current = await getReplenishmentConcepts(businessId);
  if (current.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return;

  const next = [...current, trimmed];

  const existing = await db.business_settings.get(businessId);
  const updated = { business_id: businessId, ...existing, purchase_expense_concepts: next };
  await db.business_settings.put(updated);

  await enqueueOperation('SAVE_BUSINESS_SETTINGS', { business_id: businessId, purchase_expense_concepts: next }, businessId);
  return next;
}

export async function addReplenishmentConcepts(businessId, names) {
  if (!businessId || !Array.isArray(names) || names.length === 0) return;

  const current = await getReplenishmentConcepts(businessId);
  const next = [...current];
  names.forEach((name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    if (!next.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      next.push(trimmed);
    }
  });

  if (next.length === current.length) return current;

  const existing = await db.business_settings.get(businessId);
  const updated = { business_id: businessId, ...existing, purchase_expense_concepts: next };
  await db.business_settings.put(updated);

  await enqueueOperation('SAVE_BUSINESS_SETTINGS', { business_id: businessId, purchase_expense_concepts: next }, businessId);
  return next;
}

export async function removeReplenishmentConcept(businessId, name) {
  if (!businessId) return;

  const current = await getReplenishmentConcepts(businessId);
  const next = current.filter((c) => c !== name);

  const existing = await db.business_settings.get(businessId);
  const updated = { business_id: businessId, ...existing, purchase_expense_concepts: next };
  await db.business_settings.put(updated);

  await enqueueOperation('SAVE_BUSINESS_SETTINGS', { business_id: businessId, purchase_expense_concepts: next }, businessId);
  return next;
}

export async function renameReplenishmentConcept(businessId, oldName, newName) {
  const trimmed = newName.trim();
  if (!trimmed || !businessId || oldName === trimmed) return;

  const current = await getReplenishmentConcepts(businessId);
  const next = current.map((c) => (c === oldName ? trimmed : c));

  const existing = await db.business_settings.get(businessId);
  const updated = { business_id: businessId, ...existing, purchase_expense_concepts: next };
  await db.business_settings.put(updated);

  await enqueueOperation('SAVE_BUSINESS_SETTINGS', { business_id: businessId, purchase_expense_concepts: next }, businessId);
  return next;
}
