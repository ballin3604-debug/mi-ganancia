-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · Cierra deuda: profiles.photo_url.
-- El frontend la lee en cashier.js (lista de miembros) y en el panel admin
-- (avatares). Sin la columna el SELECT '*' simplemente la omite, pero
-- conviene tenerla para que los avatares de equipo funcionen y no quede
-- una columna fantasma en el esquema.
-- Aplicar con: npx supabase db push
-- ─────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists photo_url text;
