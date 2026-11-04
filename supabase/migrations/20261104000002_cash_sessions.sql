begin;

create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  cashier_id uuid not null references public.profiles(id),
  cashier_name text not null default '',
  opening_cash numeric(14,2) not null default 0 check (opening_cash >= 0),
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_at timestamptz not null default now(),
  opened_by uuid not null references public.profiles(id),
  opened_by_name text not null default '',
  closed_at timestamptz,
  closed_by uuid references public.profiles(id),
  closed_by_name text not null default '',
  closed_arqueo_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'open' and closed_at is null) or (status = 'closed' and closed_at is not null))
);

create unique index if not exists cash_sessions_one_open_per_branch_idx
  on public.cash_sessions (business_id, branch_id)
  where status = 'open';

create index if not exists cash_sessions_business_opened_idx
  on public.cash_sessions (business_id, opened_at desc);

alter table public.cash_arqueos
  add column if not exists cash_session_id uuid references public.cash_sessions(id),
  add column if not exists cashier_id uuid references public.profiles(id),
  add column if not exists cashier_name text not null default '';

alter table public.cash_sessions enable row level security;
revoke all on table public.cash_sessions from anon, authenticated, public;
grant select, insert, update on table public.cash_sessions to authenticated;

drop policy if exists "miembros ven sesiones de sus sucursales" on public.cash_sessions;
create policy "miembros ven sesiones de sus sucursales"
  on public.cash_sessions for select to authenticated
  using (
    exists (
      select 1
        from public.profiles p
       where p.id = auth.uid()
         and p.business_id = cash_sessions.business_id
         and (p.status is null or p.status = 'active')
         and (
           p.role <> 'cashier'
           or p.branch_ids is null
           or jsonb_typeof(p.branch_ids) <> 'array'
           or jsonb_array_length(p.branch_ids) = 0
           or p.branch_ids @> jsonb_build_array(cash_sessions.branch_id::text)
         )
    )
  );

drop policy if exists "dueños abren sesiones de caja" on public.cash_sessions;
create policy "dueños abren sesiones de caja"
  on public.cash_sessions for insert to authenticated
  with check (
    opened_by = auth.uid()
    and exists (
      select 1
        from public.profiles p
       where p.id = auth.uid()
         and p.business_id = cash_sessions.business_id
         and (p.status is null or p.status = 'active')
         and (p.role = 'owner' or auth.uid() = public.admin_uid())
    )
    and exists (
      select 1
        from public.branches b
       where b.id = cash_sessions.branch_id
         and b.business_id = cash_sessions.business_id
    )
    and exists (
      select 1
        from public.profiles cashier
       where cashier.id = cash_sessions.cashier_id
         and cashier.business_id = cash_sessions.business_id
         and cashier.role = 'cashier'
         and (cashier.status is null or cashier.status = 'active')
         and (
           cashier.branch_ids is null
           or jsonb_typeof(cashier.branch_ids) <> 'array'
           or jsonb_array_length(cashier.branch_ids) = 0
           or cashier.branch_ids @> jsonb_build_array(cash_sessions.branch_id::text)
         )
    )
  );

drop policy if exists "dueños cierran sesiones de caja" on public.cash_sessions;
create policy "dueños cierran sesiones de caja"
  on public.cash_sessions for update to authenticated
  using (
    exists (
      select 1
        from public.profiles p
       where p.id = auth.uid()
         and p.business_id = cash_sessions.business_id
         and (p.status is null or p.status = 'active')
         and (p.role = 'owner' or auth.uid() = public.admin_uid())
    )
  )
  with check (
    exists (
      select 1
        from public.profiles p
       where p.id = auth.uid()
         and p.business_id = cash_sessions.business_id
         and (p.status is null or p.status = 'active')
         and (p.role = 'owner' or auth.uid() = public.admin_uid())
    )
  );

drop policy if exists "miembros registran arqueos en sus sucursales" on public.cash_arqueos;
drop policy if exists "dueños registran arqueos" on public.cash_arqueos;
create policy "dueños registran arqueos"
  on public.cash_arqueos for insert to authenticated
  with check (
    closed_by = auth.uid()
    and exists (
      select 1
        from public.profiles p
       where p.id = auth.uid()
         and p.business_id = cash_arqueos.business_id
         and (p.status is null or p.status = 'active')
         and (p.role = 'owner' or auth.uid() = public.admin_uid())
    )
    and (
      cashier_id is null
      or exists (
        select 1
          from public.profiles cashier
         where cashier.id = cash_arqueos.cashier_id
           and cashier.business_id = cash_arqueos.business_id
           and cashier.role = 'cashier'
      )
    )
  );

commit;
