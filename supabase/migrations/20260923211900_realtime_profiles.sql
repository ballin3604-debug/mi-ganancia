-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · Realtime en profiles: la app se entera sola cuando el
-- admin aprueba / suspende / reactiva, sin recargar ni cerrar sesión.
-- Aplicar con:  npx supabase db push   (tras `supabase link`)
-- O pegar este bloque en SQL Editor del dashboard.
-- ─────────────────────────────────────────────────────────────

-- Idempotente: si ya es miembro (como en este proyecto), no hace nada.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;
