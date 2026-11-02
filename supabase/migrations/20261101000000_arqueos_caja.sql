begin;

create table if not exists public.cash_arqueos (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  period_start timestamptz not null,
  closed_at timestamptz not null default now(),
  opening_cash numeric(14,2) not null default 0 check (opening_cash >= 0),
  cash_sales numeric(14,2) not null default 0,
  qr_sales numeric(14,2) not null default 0,
  cash_expenses numeric(14,2) not null default 0,
  expected_cash numeric(14,2) not null default 0,
  counted_cash numeric(14,2) not null default 0 check (counted_cash >= 0),
  difference numeric(14,2) not null default 0,
  denominations jsonb not null default '{}'::jsonb,
  notes text not null default '',
  closed_by uuid not null references public.profiles(id),
  closed_by_name text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists cash_arqueos_business_branch_closed_idx
  on public.cash_arqueos (business_id, branch_id, closed_at desc);

alter table public.cash_arqueos enable row level security;
revoke all on table public.cash_arqueos from anon, authenticated, public;
grant select, insert on table public.cash_arqueos to authenticated;

drop policy if exists "miembros ven arqueos de sus sucursales" on public.cash_arqueos;
create policy "miembros ven arqueos de sus sucursales"
  on public.cash_arqueos for select to authenticated
  using (
    exists (
      select 1
        from public.profiles p
       where p.id = auth.uid()
         and p.business_id = cash_arqueos.business_id
         and (p.status is null or p.status = 'active')
         and (
           p.role <> 'cashier'
           or p.branch_ids is null
           or jsonb_typeof(p.branch_ids) <> 'array'
           or jsonb_array_length(p.branch_ids) = 0
           or p.branch_ids @> jsonb_build_array(cash_arqueos.branch_id::text)
         )
    )
  );

drop policy if exists "miembros registran arqueos en sus sucursales" on public.cash_arqueos;
create policy "miembros registran arqueos en sus sucursales"
  on public.cash_arqueos for insert to authenticated
  with check (
    closed_by = auth.uid()
    and exists (
      select 1
        from public.profiles p
       where p.id = auth.uid()
         and p.business_id = cash_arqueos.business_id
         and (p.status is null or p.status = 'active')
         and (
           p.role <> 'cashier'
           or p.branch_ids is null
           or jsonb_typeof(p.branch_ids) <> 'array'
           or jsonb_array_length(p.branch_ids) = 0
           or p.branch_ids @> jsonb_build_array(cash_arqueos.branch_id::text)
         )
    )
  );

commit;
