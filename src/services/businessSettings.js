import { db } from './localDb';
import { enqueueOperation } from './syncEngine';
import { supabase, assertSupabase, isSupabaseConfigured } from './supabaseClient';
import { getSectorConfig } from '../config/sectorConfig';

export async function getBusinessSettings(businessId) {
  // Read local first
  const local = await db.business_settings.get(businessId);
  if (local && local._fullySynced === true) {
    return local;
  }

  // If not fully synced, try fetching the complete data from Supabase
  try {
    const { data, error } = await assertSupabase()
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
  const pickStr = (v, max) => (v !== undefined && v !== null ? String(v).slice(0, max) : undefined);
  const base = {
    business_id: businessId,
    slogan: data.slogan !== undefined ? data.slogan : '',
    phone: data.phone !== undefined ? data.phone : '',
    logo_data: data.logo_data || data.logoData || '',
    qr_data: data.qr_data || data.qrData || '',
    business_category: data.business_category || data.businessCategory || 'tienda',
    updated_at: new Date().toISOString()
  };
  // ── Campos nuevos (antes inexistentes en Ajustes) ──────────────────────
  // Solo se agregan si vienen definidos, para no pisar datos con vacíos.
  const legalName = pickStr(data.legal_name ?? data.legalName, 120);
  const nit = pickStr(data.nit, 30);
  const city = pickStr(data.city, 80);
  const address = pickStr(data.address, 200);
  const footerMessage = pickStr(data.footer_message ?? data.footerMessage, 160);
  const showQr = data.show_qr ?? data.showQrOnTicket ?? data.showQr;

  const full = { ...base };
  if (legalName !== undefined) full.legal_name = legalName;
  if (nit !== undefined) full.nit = nit;
  if (city !== undefined) full.city = city;
  if (address !== undefined && address !== '') full.address = address;
  if (footerMessage !== undefined) full.footer_message = footerMessage;
  if (showQr !== undefined) full.show_qr = !!showQr;

  // Optimistic local update with partial merge
  const existing = await db.business_settings.get(businessId);
  const updatedObj = {
    ...existing,
    ...full,
    _fullySynced: existing ? !!existing._fullySynced : false
  };
  await db.business_settings.put(updatedObj);

  // Enqueue outbox con payload completo en snake_case. El recorte de columnas
  // desconocidas ocurre en syncEngine (SAVE_BUSINESS_SETTINGS) vía
  // getServerCaps ANTES del upsert: enqueueOperation solo escribe en Dexie
  // local y nunca puede fallar por "columna inexistente" del servidor.
  await enqueueOperation('SAVE_BUSINESS_SETTINGS', full, businessId);
}

// Nombre comercial del negocio (tabla businesses). Sale en recibos y PDFs.
export async function renameBusiness(businessId, name) {
  const clean = (name || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (clean.length < 2) throw new Error('El nombre debe tener al menos 2 letras.');
  const { error } = await assertSupabase().from('businesses').update({ name: clean }).eq('id', businessId);
  if (error) throw error;
  return clean;
}

/**
 * Resuelve la configuración de sector para el negocio actual.
 * Fase A: usa únicamente business_category para elegir defaults.
 * En el futuro podrá mezclar overrides guardados en business_settings.
 */
export function getBusinessSectorConfig(settings) {
  const category = settings?.businessCategory || settings?.business_category;
  const overrides = settings?.sector_config || settings?.sectorConfig || {};
  return getSectorConfig(category, overrides);
}
