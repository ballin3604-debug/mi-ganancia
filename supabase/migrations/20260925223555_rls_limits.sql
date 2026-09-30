-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · Endurecimiento: cupos por plan a nivel SERVIDOR.
-- Las policies RLS son permisivas (se suman con OR) y el gating de UI se
-- puede saltar por consola/API. Estos triggers BEFORE INSERT aplican los
-- límites del plan efectivo (trial→pro, vencido→free) y lanzan error claro.
-- No dependen de las policies existentes: funcionan con o sin ellas.
-- Exentos: service_role (Edge Functions/RPC) y el admin del proyecto.
-- Aplicar con:  npx supabase db push   (o pegar en SQL Editor)
-- ─────────────────────────────────────────────────────────────

-- Plan efectivo de un negocio (misma lógica que src/config/plans.js)
create or replace function public.effective_plan_id(p_business_id uuid)
returns text
language sql
stable
security definer
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

-- Límites por plan (espejo de src/config/plans.js)
create or replace function public.plan_limits(p_plan_id text)
returns table (max_products int, max_users int, allow_branches boolean)
language sql
immutable
security definer
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

-- ¿Llamador exento? (servicio interno o admin del proyecto)
create or replace function public.is_exempt_caller()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt()->>'role', '') = 'service_role'
      or auth.uid() = '8b000c8e-41c8-4836-81ad-544e7fedb3f1'::uuid
$$;

-- Trigger genérico de cupos
create or replace function public.enforce_plan_limits()
returns trigger
language plpgsql
security definer
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

drop trigger if exists trg_limit_products on public.products;
create trigger trg_limit_products
  before insert on public.products
  for each row execute function public.enforce_plan_limits();

drop trigger if exists trg_limit_profiles on public.profiles;
create trigger trg_limit_profiles
  before insert on public.profiles
  for each row execute function public.enforce_plan_limits();

drop trigger if exists trg_limit_branches on public.branches;
create trigger trg_limit_branches
  before insert on public.branches
  for each row execute function public.enforce_plan_limits();
