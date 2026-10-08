-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · roles de profiles: la app solo usa 'owner' | 'cashier'
-- (ver AuthContext.jsx y services/cashier.js). El CHECK anterior
-- rechazaba 'cashier' y rompía el ingreso con código de cajero:
--   new row for relation "profiles" violates check constraint
--   "profiles_role_check"
-- Se normalizan valores ajenos (los NULL se dejan: la app los trata
-- como dueño) y se recrea el CHECK con el vocabulario real.
-- Aplicar con:  npx supabase db push   (tras `supabase link`)
-- O pegar este bloque en SQL Editor del dashboard.
-- ─────────────────────────────────────────────────────────────

-- 1. Ver qué hay hoy (solo lectura, para confirmar antes del cambio)
-- SELECT role, count(*) FROM public.profiles GROUP BY role;

-- 2. Normalizar valores que no son del vocabulario (sin tocar NULLs)
UPDATE public.profiles SET role = 'cashier'
WHERE role IS NOT NULL AND role NOT IN ('owner', 'cashier');

-- 3. Recrear el CHECK con los valores reales
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('owner', 'cashier'));
