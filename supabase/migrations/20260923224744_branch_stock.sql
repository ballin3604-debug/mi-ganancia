-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · Fase 2: stock por sede + traspasos.
-- El stock deja de ser global: vive en branch_stock (sede × producto).
-- products.stock queda como total (caché) y se mantiene por deltas.
-- Aplicar con:  npx supabase db push   (o pegar en SQL Editor)
-- ─────────────────────────────────────────────────────────────

-- 1. Stock por sede
create table if not exists public.branch_stock (
  branch_id uuid not null references public.branches(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  stock numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (branch_id, product_id)
);
create index if not exists branch_stock_business_idx on public.branch_stock (business_id);
create index if not exists branch_stock_product_idx on public.branch_stock (product_id);

-- 2. Traspasos entre sedes (historial, no se borra)
create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  from_branch_id uuid references public.branches(id) on delete set null,
  to_branch_id uuid references public.branches(id) on delete set null,
  quantity numeric not null,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists transfers_business_idx on public.transfers (business_id, created_at desc);
create index if not exists transfers_product_idx on public.transfers (product_id);

-- 3. Backfill: el stock actual de cada producto pertenece a la principal
insert into public.branch_stock (branch_id, product_id, business_id, stock)
select br.id, p.id, p.business_id, coalesce(p.stock, 0)
from public.products p
join public.branches br on br.business_id = p.business_id and br.is_main
on conflict (branch_id, product_id) do nothing;

-- 4. RLS: miembros gestionan lo de su negocio (traspasos no se borran)
alter table public.branch_stock enable row level security;
alter table public.transfers enable row level security;

drop policy if exists "miembros gestionan stock por sede" on public.branch_stock;
create policy "miembros gestionan stock por sede"
  on public.branch_stock for all
  to authenticated
  using (
    business_id in (select business_id from public.profiles where id = auth.uid())
  )
  with check (
    business_id in (select business_id from public.profiles where id = auth.uid())
  );

drop policy if exists "miembros ven traspasos" on public.transfers;
create policy "miembros ven traspasos"
  on public.transfers for select
  to authenticated
  using (
    business_id in (select business_id from public.profiles where id = auth.uid())
  );

drop policy if exists "miembros crean traspasos" on public.transfers;
create policy "miembros crean traspasos"
  on public.transfers for insert
  to authenticated
  with check (
    business_id in (select business_id from public.profiles where id = auth.uid())
  );
