-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · invitaciones por correo + estado de miembros.
-- 1) business_join_codes.email: código atado a un correo (el que invita
--    escribe el correo del cajero; al unirse se valida que coincida).
-- 2) profiles.status ya existe ('active' para trabajar; 'suspended'
--    bloquea el acceso y muestra la pantalla de aprobación).
-- Aplicar con:  npx supabase db push   (tras `supabase link`)
-- O pegar este bloque en SQL Editor del dashboard.
-- ─────────────────────────────────────────────────────────────

alter table public.business_join_codes
  add column if not exists email text;

create index if not exists business_join_codes_business_idx
  on public.business_join_codes (business_id);
