-- Planes oficiales: Pro (3 usuarios) y Premium (10 usuarios).
-- Se elimina el plan Free: toda cuenta sin suscripción vigente opera como Pro.

alter table public.subscriptions
  alter column plan_id set default 'pro';

update public.subscriptions set plan_id = 'pro' where plan_id = 'free';

insert into public.plans (id, name, price_monthly, price_yearly, max_products, max_users, features)
values
  ('pro', 'Pro', 49, 490, 1000000, 3, jsonb_build_object(
    'scanner', true,
    'branches', false,
    'multi_user', true,
    'pdf_export', true,
    'warehouses', false,
    'advanced_reports', true,
    'ads', false
  )),
  ('premium', 'Premium', 99, 990, 1000000, 10, jsonb_build_object(
    'scanner', true,
    'branches', true,
    'multi_user', true,
    'pdf_export', true,
    'warehouses', true,
    'advanced_reports', true,
    'ads', false
  ))
on conflict (id) do update set
  name = excluded.name,
  price_monthly = excluded.price_monthly,
  price_yearly = excluded.price_yearly,
  max_products = excluded.max_products,
  max_users = excluded.max_users,
  features = excluded.features;

delete from public.plans where id = 'free';

create or replace function public.effective_plan_id(p_business_id uuid)
returns text
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select case
    when s.status = 'trial'
      and (s.trial_ends_at is null or s.trial_ends_at > now()) then s.plan_id
    when s.status = 'active'
      and (s.current_period_end is null or s.current_period_end > now()) then s.plan_id
    else 'pro'
  end
  from public.subscriptions s
  where s.business_id = p_business_id
$function$;

create or replace function public.plan_limits(p_plan_id text)
returns table(max_products integer, max_users integer, allow_branches boolean)
language sql
immutable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select case p_plan_id
    when 'premium' then 1000000
    when 'pro' then 1000000
    else 1000000
  end,
  case p_plan_id
    when 'premium' then 10
    when 'pro' then 3
    else 3
  end,
  (p_plan_id = 'premium')
$function$;

create or replace function public.enforce_plan_limits()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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
      raise exception 'Límite del plan: hasta % productos. Mejora tu plan para más capacidad.', v_max_products
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
      raise exception 'Límite del plan: hasta % usuarios por negocio. Mejora tu plan para más equipo.', v_max_users
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
$function$;
