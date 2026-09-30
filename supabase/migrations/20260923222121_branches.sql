-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · Sucursales y almacenes + plan Premium + trial automático.
-- Fase 1: sucursales para organizar ventas por sede (stock global).
-- Fase 2 (después): stock por sucursal + traspasos.
-- Aplicar con:  npx supabase db push   (o pegar en SQL Editor)
-- ─────────────────────────────────────────────────────────────

-- 1. Tabla de sucursales / almacenes
create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  type text not null default 'sucursal',
  address text,
  phone text,
  is_main boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists branches_business_idx on public.branches (business_id);

-- 2. Columna de sucursal en ventas y gastos (para reportes por sede)
alter table public.sales
  add column if not exists branch_id uuid references public.branches(id) on delete set null;
alter table public.expenses
  add column if not exists branch_id uuid references public.branches(id) on delete set null;

-- 3. Plan Premium en el catálogo
insert into public.plans (id, name, price_monthly, price_yearly, max_products, max_users, features)
values
  ('premium', 'Premium', 99, 990, 1000000, 15,
   '{"scanner": true, "advanced_reports": true, "pdf_export": true, "multi_user": true, "branches": true, "warehouses": true}'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  price_monthly = excluded.price_monthly,
  price_yearly = excluded.price_yearly,
  max_products = excluded.max_products,
  max_users = excluded.max_users,
  features = excluded.features;

-- Pro necesita flag branches=false explícito (era implícito antes)
update public.plans
set features = features || '{"branches": false, "warehouses": false}'::jsonb
where id = 'free';
update public.plans
set features = features || '{"branches": false, "warehouses": false}'::jsonb
where id = 'pro';

-- 4. Trial Pro 14 días + sucursal principal automáticos al crear negocio
create or replace function public.start_trial()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.subscriptions (business_id, plan_id, status, trial_ends_at, current_period_end)
  values (NEW.id, 'pro', 'trial', now() + interval '14 days', now() + interval '14 days')
  on conflict (business_id) do nothing;

  if not exists (select 1 from public.branches where business_id = NEW.id) then
    insert into public.branches (business_id, name, type, is_main)
    values (NEW.id, 'Casa matriz', 'sucursal', true);
  end if;

  return NEW;
end;
$$;

drop trigger if exists on_business_created on public.businesses;
create trigger on_business_created
  after insert on public.businesses
  for each row execute function public.start_trial();

-- 4b. Backfill: negocios que ya existían también reciben principal + trial
insert into public.branches (business_id, name, type, is_main)
select id, 'Casa matriz', 'sucursal', true from public.businesses b
where not exists (select 1 from public.branches br where br.business_id = b.id);

insert into public.subscriptions (business_id, plan_id, status, trial_ends_at, current_period_end)
select id, 'pro', 'trial', now() + interval '14 days', now() + interval '14 days'
from public.businesses b
where not exists (select 1 from public.subscriptions s where s.business_id = b.id);

-- 5. RLS de sucursales: miembros ven las de su negocio;
-- crear/editar/borrar solo dueños (no cajeros).
alter table public.branches enable row level security;

drop policy if exists "miembros ven sus sucursales" on public.branches;
create policy "miembros ven sus sucursales"
  on public.branches for select
  to authenticated
  using (
    business_id in (select business_id from public.profiles where id = auth.uid())
  );

drop policy if exists "dueños gestionan sucursales" on public.branches;
create policy "dueños gestionan sucursales"
  on public.branches for all
  to authenticated
  using (
    business_id in (
      select business_id from public.profiles
      where id = auth.uid() and (role is null or role <> 'cashier')
    )
  )
  with check (
    business_id in (
      select business_id from public.profiles
      where id = auth.uid() and (role is null or role <> 'cashier')
    )
  );
