-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · Paso 4 del plan SaaS: facturación (planes, suscripciones, pagos)
-- Modelo: 1 suscripción por NEGOCIO (no por usuario). Plan free/pro.
-- Fase 1 = cobro manual con QR + comprobante que aprueba el admin.
-- Aplicar con:  npx supabase db push   (tras `supabase link`)
-- ─────────────────────────────────────────────────────────────

-- 1. Planes (catálogo)
create table if not exists public.plans (
  id text primary key,
  name text not null,
  price_monthly numeric not null default 0,
  price_yearly numeric not null default 0,
  max_products int not null default 100,
  max_users int not null default 1,
  features jsonb not null default '{}'::jsonb
);

insert into public.plans (id, name, price_monthly, price_yearly, max_products, max_users, features)
values
  ('free', 'Gratis', 0, 0, 100, 1,
   '{"scanner": false, "advanced_reports": false, "pdf_export": false, "multi_user": false}'::jsonb),
  ('pro', 'Pro', 49, 490, 1000000, 5,
   '{"scanner": true, "advanced_reports": true, "pdf_export": true, "multi_user": true}'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  price_monthly = excluded.price_monthly,
  price_yearly = excluded.price_yearly,
  max_products = excluded.max_products,
  max_users = excluded.max_users,
  features = excluded.features;

-- 2. Suscripción por negocio (1 fila por negocio)
create table if not exists public.subscriptions (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  plan_id text not null default 'free' references public.plans(id),
  status text not null default 'trial',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Pagos / comprobantes (los sube el dueño, los aprueba el admin)
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  plan_id text not null default 'pro' references public.plans(id),
  billing_cycle text not null default 'monthly',
  amount numeric not null,
  method text not null default 'qr',
  reference text,
  receipt_url text,
  status text not null default 'pending',
  reviewed_at timestamptz,
  reviewed_by uuid,
  admin_note text,
  created_at timestamptz not null default now()
);
create index if not exists payments_business_idx on public.payments (business_id, created_at desc);

-- 4. RLS: cada miembro ve lo de SU negocio; solo el servicio escribe
-- suscripciones (el admin las gestiona vía dashboard / Edge Function).
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;

drop policy if exists "plans públicos" on public.plans;
create policy "plans públicos"
  on public.plans for select
  to anon, authenticated
  using (true);

drop policy if exists "miembros ven su suscripción" on public.subscriptions;
create policy "miembros ven su suscripción"
  on public.subscriptions for select
  to authenticated
  using (
    business_id in (select business_id from public.profiles where id = auth.uid())
  );

drop policy if exists "miembros ven sus pagos" on public.payments;
create policy "miembros ven sus pagos"
  on public.payments for select
  to authenticated
  using (
    business_id in (select business_id from public.profiles where id = auth.uid())
  );

drop policy if exists "dueños suben comprobantes" on public.payments;
create policy "dueños suben comprobantes"
  on public.payments for insert
  to authenticated
  with check (
    business_id in (
      select business_id from public.profiles
      where id = auth.uid() and (role is null or role <> 'cashier')
    )
  );

-- NOTA: altas de suscripción y aprobación de pagos las hace el servicio
-- (service_role / Edge Function) o el admin desde el dashboard.
-- Si tus policies existentes usan un bypass de admin por UID, réplica ese
-- patrón aquí tras revisar el dump de policies del paso 1B.
