-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · equipo avanzado estilo Inicio6.
-- 1) profiles.custom_permissions (jsonb): overrides por miembro
--    (el dueño siempre tiene todo; el cajero usa sus permisos o
--    los de defecto: cobrar, scanner, exportar).
-- 2) business_join_codes.expires_at: los códigos caducan
--    (48h cajero, 72h dueño, 7 días invitaciones por correo).
-- Aplicar con:  npx supabase db push   (tras `supabase link`)
-- O pegar este bloque en SQL Editor del dashboard.
-- ─────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists custom_permissions jsonb;

alter table public.business_join_codes
  add column if not exists expires_at timestamptz;
