import { db } from './localDb';
import { enqueueOperation } from './syncEngine';
import { supabase } from './supabaseClient';

export async function getBusinessSettings(businessId) {
  // Read local first
  const local = await db.business_settings.get(businessId);
  if (local && local._fullySynced === true) {
    return local;
  }

  // If not fully synced, try fetching the complete data from Supabase
  try {
    const { data, error } = await supabase
      .from('business_settings')
      .select('*')
      .eq('business_id', businessId)
      .maybeSingle();

    if (!error && data) {
      // Merge: server values as base, but preserve local edits (like offline categories)
      const merged = {
        ...data,
        ...local,
        _fullySynced: true
      };
      await db.business_settings.put(merged);
      return merged;
    }
  } catch (err) {
    console.warn('getBusinessSettings: Could not fetch from Supabase (offline fallback)', err);
  }

  // Fallback to local partial if we have it, otherwise empty object
  return local || {};
}

export async function saveBusinessSettings(businessId, data) {
  const payload = {
    business_id: businessId,
    slogan: data.slogan !== undefined ? data.slogan : '',
    phone: data.phone !== undefined ? data.phone : '',
    logo_data: data.logo_data || data.logoData || '',
    qr_data: data.qr_data || data.qrData || '',
    business_category: data.business_category || data.businessCategory || 'tienda',
    updated_at: new Date().toISOString()
  };

  // Optimistic local update with partial merge
  const existing = await db.business_settings.get(businessId);
  const updatedObj = { 
    ...existing, 
    ...payload,
    _fullySynced: existing ? !!existing._fullySynced : false
  };
  await db.business_settings.put(updatedObj);

  // Enqueue outbox operation with clean snake_case payload
  await enqueueOperation('SAVE_BUSINESS_SETTINGS', payload, businessId);
}
