-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · Hardening RLS + search_path + índices faltantes.
-- 1) Helper public.get_my_business_id() para policies sin recursión.
-- 2) Fija search_path en funciones SECURITY DEFINER existentes
--    (start_trial, effective_plan_id, plan_limits, is_exempt_caller,
--    enforce_plan_limits) para pasar `supabase db lint`.
-- 3) Policies faltantes: payments UPDATE/DELETE (owner), transfers
--    UPDATE/DELETE (owner+admin), storage.objects UPDATE/DELETE (owner),
--    admin_audit_log SELECT (admin UID).
-- 4) Vet: reemplaza FOR ALL por SELECT/INSERT/UPDATE para miembros
--    (incl. cashier) y DELETE solo owner.
-- 5) CHECK transfers.quantity > 0 + índices business_join_codes(email),
--    sales(branch_id), expenses(branch_id).
-- Aplicar con: npx supabase db push (tras `supabase link`)
-- ─────────────────────────────────────────────────────────────

-- ══ 1. Helper: business_id del usuario actual ═══════════════════
-- public.get_my_business_id() SECURITY DEFINER SET search_path=public,pg_temp
create or replace function public.get_my_business_id()
returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select business_id from public.profiles where id = auth.uid()
$$;

revoke all on function public.get_my_business_id() from public;
grant execute on function public.get_my_business_id() to authenticated;

-- ══ 2. Fija search_path en funciones existentes ═════════════════
-- 2a. start_trial (20260923222121_branches.sql:49)
create or replace function public.start_trial()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
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

-- 2b. effective_plan_id (20260925223555_rls_limits.sql:12)
create or replace function public.effective_plan_id(p_business_id uuid)
returns text
language sql stable security definer set search_path = public, pg_temp
as $$
  select case
    when s.status = 'trial'
      and (s.trial_ends_at is null or s.trial_ends_at > now()) then s.plan_id
    when s.status = 'active'
      and (s.current_period_end is null or s.current_period_end > now()) then s.plan_id
    else 'free'
  end
  from public.subscriptions s
  where s.business_id = p_business_id
$$;

-- 2c. plan_limits (20260925223555_rls_limits.sql:30)
create or replace function public.plan_limits(p_plan_id text)
returns table (max_products int, max_users int, allow_branches boolean)
language sql immutable security definer set search_path = public, pg_temp
as $$
  select case p_plan_id
    when 'premium' then 1000000
    when 'pro' then 1000000
    else 100
  end,
  case p_plan_id
    when 'premium' then 15
    when 'pro' then 5
    else 1
  end,
  (p_plan_id = 'premium')
$$;

-- 2d. is_exempt_caller (20260925223555_rls_limits.sql:50)
-- No estaba en la lista pero también necesita search_path fijo,
-- si no `supabase db lint` sigue marcando function_search_path_mutable.
-- Se preserva como SECURITY INVOKER (original): solo se agrega search_path.
-- Fuente única admin: src/config/admin.js (VITE_ADMIN_UID) → public.admin_uid().
create or replace function public.is_exempt_caller()
returns boolean
language sql stable set search_path = public, pg_temp
as $$
  select coalesce(auth.jwt()->>'role', '') = 'service_role'
      or auth.uid() = public.admin_uid()
$$;

-- 2e. enforce_plan_limits (20260925223555_rls_limits.sql:60)
create or replace function public.enforce_plan_limits()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_plan text;
  v_max_products int;
  v_max_users int;
  v_allow_branches boolean;
  v_count int;
  v_biz uuid;
begin
  if public.is_exempt_caller() then
    return NEW;
  end if;

  if TG_TABLE_NAME = 'products' then
    v_biz := NEW.business_id;
    select * into v_max_products, v_max_users, v_allow_branches
    from public.plan_limits(public.effective_plan_id(v_biz));
    select count(*) into v_count from public.products where business_id = v_biz;
    if v_count >= v_max_products then
      raise exception 'Límite del plan Gratis: hasta % productos. Sube a Pro para ilimitados.', v_max_products
        using errcode = 'P0001';
    end if;

  elsif TG_TABLE_NAME = 'profiles' then
    -- Solo aplica al UNIRSE a un negocio (business_id seteado).
    -- El registro inicial sin negocio queda libre.
    if NEW.business_id is null then
      return NEW;
    end if;
    v_biz := NEW.business_id;
    select * into v_max_products, v_max_users, v_allow_branches
    from public.plan_limits(public.effective_plan_id(v_biz));
    select count(*) into v_count from public.profiles where business_id = v_biz;
    if v_count >= v_max_users then
      raise exception 'Límite del plan: hasta % usuarios por negocio. Sube de plan para más equipo.', v_max_users
        using errcode = 'P0001';
    end if;

  elsif TG_TABLE_NAME = 'branches' then
    v_biz := NEW.business_id;
    select * into v_max_products, v_max_users, v_allow_branches
    from public.plan_limits(public.effective_plan_id(v_biz));
    -- La primera sede (casa matriz) siempre pasa; el resto exige Premium.
    select count(*) into v_count from public.branches where business_id = v_biz;
    if v_count >= 1 and not v_allow_branches then
      raise exception 'Las sucursales y almacenes son Premium. Activa Premium para más sedes.'
        using errcode = 'P0001';
    end if;
  end if;

  return NEW;
end;
$$;

-- ══ 3. Policies faltantes ═══════════════════════════════════════

-- 3a. payments: UPDATE/DELETE para owner del mismo negocio.
-- (SELECT miembros + INSERT dueños + ALL admin ya existen.)
drop policy if exists "dueños actualizan pagos" on public.payments;
create policy "dueños actualizan pagos"
  on public.payments for update
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

drop policy if exists "dueños borran pagos" on public.payments;
create policy "dueños borran pagos"
  on public.payments for delete
  to authenticated
  using (
    business_id in (
      select business_id from public.profiles
      where id = auth.uid() and (role is null or role <> 'cashier')
    )
  );

-- 3b. transfers: UPDATE/DELETE para owner del negocio + admin global.
-- (SELECT/INSERT para miembros ya existen; el historial no se borra
-- desde la app salvo dueño o admin.)
drop policy if exists "dueños y admin actualizan traspasos" on public.transfers;
create policy "dueños y admin actualizan traspasos"
  on public.transfers for update
  to authenticated
  using (
    auth.uid() = public.admin_uid()
    or business_id in (
      select business_id from public.profiles
      where id = auth.uid() and (role is null or role <> 'cashier')
    )
  )
  with check (
    auth.uid() = public.admin_uid()
    or business_id in (
      select business_id from public.profiles
      where id = auth.uid() and (role is null or role <> 'cashier')
    )
  );

drop policy if exists "dueños y admin borran traspasos" on public.transfers;
create policy "dueños y admin borran traspasos"
  on public.transfers for delete
  to authenticated
  using (
    auth.uid() = public.admin_uid()
    or business_id in (
      select business_id from public.profiles
      where id = auth.uid() and (role is null or role <> 'cashier')
    )
  );

-- 3c. storage.objects: UPDATE/DELETE para owner en su carpeta.
-- (INSERT/SELECT dueños + SELECT admin ya existen.)
drop policy if exists "dueños actualizan comprobantes" on storage.objects;
create policy "dueños actualizan comprobantes"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'payment-receipts'
    and (storage.foldername(name))[1] in (
      select business_id::text from public.profiles
      where id = auth.uid() and (role is null or role <> 'cashier')
    )
  )
  with check (
    bucket_id = 'payment-receipts'
    and (storage.foldername(name))[1] in (
      select business_id::text from public.profiles
      where id = auth.uid() and (role is null or role <> 'cashier')
    )
  );

drop policy if exists "dueños borran comprobantes" on storage.objects;
create policy "dueños borran comprobantes"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'payment-receipts'
    and (storage.foldername(name))[1] in (
      select business_id::text from public.profiles
      where id = auth.uid() and (role is null or role <> 'cashier')
    )
  );

-- 3d. admin_audit_log: SELECT solo admin global.
-- (Sin policies de escritura desde cliente: solo service_role escribe.)
drop policy if exists "admin ve auditoría" on public.admin_audit_log;
create policy "admin ve auditoría"
  on public.admin_audit_log for select
  to authenticated
  using (auth.uid() = public.admin_uid());

-- ══ 4. Vet: sin DELETE para cashier, DELETE solo owner ══════════
-- Reemplaza el FOR ALL de 20260925231636_vet_module.sql:119.
-- Postgres no admite FOR SELECT,INSERT,UPDATE en una sola policy:
-- se crean 3 policies de miembro (SELECT/INSERT/UPDATE, incl. cashier)
-- + 1 policy de DELETE solo owner (role null o <> 'cashier').
do $$
declare
  t text;
begin
  foreach t in array array['pet_owners','pets','clinical_records','prescriptions','vaccinations','reminders']
  loop
    execute format('drop policy if exists "miembros gestionan %s" on public.%I', t, t);
    execute format('drop policy if exists "miembros ven %s" on public.%I', t, t);
    execute format('drop policy if exists "miembros crean %s" on public.%I', t, t);
    execute format('drop policy if exists "miembros actualizan %s" on public.%I', t, t);
    execute format('drop policy if exists "dueños borran %s" on public.%I', t, t);

    execute format(
      'create policy "miembros ven %s" on public.%I for select to authenticated using (business_id in (select business_id from public.profiles where id = auth.uid()))',
      t, t);
    execute format(
      'create policy "miembros crean %s" on public.%I for insert to authenticated with check (business_id in (select business_id from public.profiles where id = auth.uid()))',
      t, t);
    execute format(
      'create policy "miembros actualizan %s" on public.%I for update to authenticated using (business_id in (select business_id from public.profiles where id = auth.uid())) with check (business_id in (select business_id from public.profiles where id = auth.uid()))',
      t, t);
    execute format(
      'create policy "dueños borran %s" on public.%I for delete to authenticated using (business_id in (select business_id from public.profiles where id = auth.uid() and (role is null or role <> ''cashier'')))',
      t, t);
  end loop;
end $$;

-- ══ 5. CHECK + índices ══════════════════════════════════════════

-- 5a. transfers.quantity > 0 (idempotente)
do $$
begin
  if to_regclass('public.transfers') is not null
     and not exists (select 1 from pg_constraint where conname = 'transfers_quantity_positive') then
    alter table public.transfers
      add constraint transfers_quantity_positive check (quantity > 0);
  end if;
end $$;

-- 5b. Índices (idempotentes; con guarda por si la tabla base aún no existe
-- en un entorno fresco — en producción las tablas ya existen)
do $$
begin
  if to_regclass('public.business_join_codes') is not null then
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'business_join_codes' and column_name = 'email') then
      execute 'create index if not exists business_join_codes_email_idx on public.business_join_codes (email)';
    end if;
  end if;

  if to_regclass('public.sales') is not null then
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'sales' and column_name = 'branch_id') then
      execute 'create index if not exists sales_branch_idx on public.sales (branch_id)';
    end if;
  end if;

  if to_regclass('public.expenses') is not null then
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'expenses' and column_name = 'branch_id') then
      execute 'create index if not exists expenses_branch_idx on public.expenses (branch_id)';
    end if;
  end if;
end $$;
