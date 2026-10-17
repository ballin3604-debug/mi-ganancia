// ─────────────────────────────────────────────────────────────
// Fuente única del UID admin en el frontend.
// Lee VITE_ADMIN_UID (ver .env.example). El resto del código debe
// importar desde aquí, no leer import.meta.env directamente ni
// hardcodear el UID.
// El mismo UID debe estar espejado en Supabase:
//   supabase/migrations/20261016000001_admin_uid_helper.sql → public.admin_uid()
//   (ver comentario en ese archivo: las policies SQL no pueden importar JS,
//    así que la sincronización es manual).
// Firestore (firestore.rules) usa OTRO sistema de auth (Firebase Auth UID
// legado 'kTq5…'), distinto del UUID de Supabase. No mezclar.
// ─────────────────────────────────────────────────────────────

export const ADMIN_UID = import.meta.env.VITE_ADMIN_UID;

export function isAdmin(uid) {
  return Boolean(uid) && uid === ADMIN_UID;
}
