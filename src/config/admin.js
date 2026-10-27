// ─────────────────────────────────────────────────────────────
// Fuente única del UID admin en el frontend.
// Producción lee VITE_ADMIN_UID (ver .env.example). Staging ignora esa
// variable a propósito y solo acepta VITE_STAGING_ADMIN_UID, para no heredar
// el administrador de producción desde el .env base.
// El mismo UID debe estar espejado en Supabase:
//   supabase/migrations/20261016000001_admin_uid_helper.sql → public.admin_uid()
//   (ver comentario en ese archivo: las policies SQL no pueden importar JS,
//    así que la sincronización es manual).
// Firestore (firestore.rules) usa OTRO sistema de auth (Firebase Auth UID
// legado 'kTq5…'), distinto del UUID de Supabase. No mezclar.
// ─────────────────────────────────────────────────────────────

import { IS_STAGING, STAGING_ADMIN_UID } from './environment';
import { resolveAdminUid } from './environmentRules';

// La condición usa import.meta.env directamente para que Rollup pueda
// eliminarla en el build staging y no incruste VITE_ADMIN_UID en el bundle.
const isStagingBuild = import.meta.env.MODE === 'staging';
const productionAdminUid = isStagingBuild || IS_STAGING
  ? ''
  : (import.meta.env.VITE_ADMIN_UID || '').trim();

export const ADMIN_UID = resolveAdminUid({
  isStaging: IS_STAGING,
  stagingAdminUid: STAGING_ADMIN_UID,
  productionAdminUid,
});

export function isAdmin(uid) {
  return Boolean(uid) && uid === ADMIN_UID;
}
