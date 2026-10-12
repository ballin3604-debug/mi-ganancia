-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · sedes asignadas por miembro.
-- profiles.branch_ids (jsonb, array de UUIDs): sedes que el cajero
-- puede ver y operar. NULL o vacío = todas (comportamiento actual).
-- El dueño siempre ve todo.
-- Aplicar con:  npx supabase db push   (tras `supabase link`)
-- O pegar este bloque en SQL Editor del dashboard.
-- ─────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists branch_ids jsonb;
