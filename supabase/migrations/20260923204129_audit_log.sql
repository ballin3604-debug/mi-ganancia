-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · Paso 2 del plan SaaS: auditoría de acciones admin.
-- Quién hizo qué, cuándo y sobre qué negocio. Base para mover los
-- borrados masivos a Edge Functions con service_role.
-- Aplicar con:  npx supabase db push   (tras `supabase link`)
-- ─────────────────────────────────────────────────────────────

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  admin_id uuid,
  admin_email text,
  action text not null,
  business_id uuid,
  business_name text,
  details jsonb,
  result text not null default 'ok'
);

-- Solo el servicio (Edge Functions con service_role) escribe aquí.
-- Nadie desde el cliente: sin policies de INSERT/UPDATE/DELETE para anon/authenticated.
alter table public.admin_audit_log enable row level security;
