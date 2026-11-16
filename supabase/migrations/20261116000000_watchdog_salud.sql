-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · Perro guardián de salud (Supabase + Firebase Hosting).
-- 1) client_health: latido por dispositivo/negocio (cola de sync, errores,
--    latencias medidas desde el equipo real).
-- 2) health_probes: historial de sondas del admin (latencia y disponibilidad).
-- 3) RPCs: report_client_health (miembros), record_health_probe (admin),
--    admin_business_health y admin_platform_health (solo admin).
-- Aplicar con: npx supabase db push
-- ─────────────────────────────────────────────────────────────

-- ══ 1. Latidos de dispositivos ═════════════════════════════════
create table if not exists public.client_health (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  device_id text not null,
  user_id uuid,
  user_name text,
  role text,
  platform text,
  app_version text,
  online boolean not null default true,
  pending_ops integer not null default 0,
  error_ops integer not null default 0,
  supabase_latency_ms integer,
  firebase_latency_ms integer,
  last_sync_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (business_id, device_id)
);

create index if not exists client_health_business_seen_idx
  on public.client_health (business_id, last_seen_at desc);
create index if not exists client_health_seen_idx
  on public.client_health (last_seen_at desc);

alter table public.client_health enable row level security;
revoke all on table public.client_health from anon, authenticated, public;
grant select on table public.client_health to authenticated;

drop policy if exists "admin ve la salud de los equipos" on public.client_health;
create policy "admin ve la salud de los equipos"
  on public.client_health for select to authenticated
  using (auth.uid() = public.admin_uid());

-- Sin policies de escritura: solo entra por la RPC de abajo, que valida que
-- el usuario pertenezca al negocio y no acepta un business_id arbitrario.
create or replace function public.report_client_health(
  p_device_id text,
  p_platform text default null,
  p_app_version text default null,
  p_online boolean default true,
  p_pending_ops integer default 0,
  p_error_ops integer default 0,
  p_supabase_latency_ms integer default null,
  p_firebase_latency_ms integer default null,
  p_last_sync_at timestamptz default null,
  p_last_error text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_business_id uuid;
  v_name text;
  v_role text;
  v_error text;
begin
  if v_uid is null then
    return;
  end if;
  if p_device_id is null or char_length(p_device_id) < 6 or char_length(p_device_id) > 120 then
    return;
  end if;

  select p.business_id, p.name, p.role
    into v_business_id, v_name, v_role
  from public.profiles p
  where p.id = v_uid;

  if v_business_id is null then
    return;
  end if;

  v_error := nullif(left(coalesce(p_last_error, ''), 500), '');

  insert into public.client_health (
    business_id, device_id, user_id, user_name, role, platform, app_version,
    online, pending_ops, error_ops, supabase_latency_ms, firebase_latency_ms,
    last_sync_at, last_error, last_error_at, last_seen_at
  ) values (
    v_business_id,
    p_device_id,
    v_uid,
    left(coalesce(v_name, ''), 120),
    left(coalesce(v_role, 'owner'), 20),
    left(coalesce(p_platform, ''), 40),
    left(coalesce(p_app_version, ''), 40),
    coalesce(p_online, true),
    greatest(coalesce(p_pending_ops, 0), 0),
    greatest(coalesce(p_error_ops, 0), 0),
    case when p_supabase_latency_ms is null then null
         else least(greatest(p_supabase_latency_ms, 0), 600000) end,
    case when p_firebase_latency_ms is null then null
         else least(greatest(p_firebase_latency_ms, 0), 600000) end,
    p_last_sync_at,
    v_error,
    case when v_error is null then null else now() end,
    now()
  )
  on conflict (business_id, device_id) do update set
    user_id = excluded.user_id,
    user_name = excluded.user_name,
    role = excluded.role,
    platform = excluded.platform,
    app_version = excluded.app_version,
    online = excluded.online,
    pending_ops = excluded.pending_ops,
    error_ops = excluded.error_ops,
    supabase_latency_ms = excluded.supabase_latency_ms,
    firebase_latency_ms = excluded.firebase_latency_ms,
    last_sync_at = coalesce(excluded.last_sync_at, client_health.last_sync_at),
    last_error = excluded.last_error,
    last_error_at = excluded.last_error_at,
    last_seen_at = now();

  -- Limpieza oportunista: equipos que no reportan hace 30 días.
  if random() < 0.01 then
    delete from public.client_health where last_seen_at < now() - interval '30 days';
  end if;
end;
$$;

revoke all on function public.report_client_health(text, text, text, boolean, integer, integer, integer, integer, timestamptz, text) from public;
grant execute on function public.report_client_health(text, text, text, boolean, integer, integer, integer, integer, timestamptz, text) to authenticated;

-- ══ 2. Historial de sondas del panel admin ═════════════════════
create table if not exists public.health_probes (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('supabase', 'firebase')),
  ok boolean not null,
  latency_ms integer,
  status_code integer,
  error text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists health_probes_source_created_idx
  on public.health_probes (source, created_at desc);

alter table public.health_probes enable row level security;
revoke all on table public.health_probes from anon, authenticated, public;
grant select on table public.health_probes to authenticated;

drop policy if exists "admin ve las sondas de salud" on public.health_probes;
create policy "admin ve las sondas de salud"
  on public.health_probes for select to authenticated
  using (auth.uid() = public.admin_uid());

create or replace function public.record_health_probe(
  p_source text,
  p_ok boolean,
  p_latency_ms integer default null,
  p_status_code integer default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is distinct from public.admin_uid() then
    raise exception 'Solo el administrador puede registrar sondas de salud.'
      using errcode = '42501';
  end if;
  if p_source not in ('supabase', 'firebase') then
    raise exception 'Origen de sonda inválido.' using errcode = '22023';
  end if;

  insert into public.health_probes (source, ok, latency_ms, status_code, error, created_by)
  values (
    p_source,
    coalesce(p_ok, false),
    case when p_latency_ms is null then null
         else least(greatest(p_latency_ms, 0), 600000) end,
    p_status_code,
    nullif(left(coalesce(p_error, ''), 500), ''),
    auth.uid()
  );

  -- Retención de 7 días (se ejecuta de vez en cuando, no en cada sonda).
  if random() < 0.05 then
    delete from public.health_probes where created_at < now() - interval '7 days';
  end if;
end;
$$;

revoke all on function public.record_health_probe(text, boolean, integer, integer, text) from public;
grant execute on function public.record_health_probe(text, boolean, integer, integer, text) to authenticated;

-- ══ 3. Salud por negocio (solo admin) ══════════════════════════
create or replace function public.admin_business_health()
returns table (
  business_id uuid,
  business_name text,
  business_status text,
  plan_id text,
  users_count bigint,
  products_count bigint,
  sales_24h bigint,
  sales_7d bigint,
  last_sale_at timestamptz,
  devices_total bigint,
  devices_online bigint,
  pending_ops bigint,
  error_ops bigint,
  avg_supabase_latency_ms integer,
  avg_firebase_latency_ms integer,
  last_seen_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  last_error_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is distinct from public.admin_uid() then
    raise exception 'Solo el administrador puede ver la salud de los negocios.'
      using errcode = '42501';
  end if;

  return query
  select
    b.id as business_id,
    b.name::text as business_name,
    coalesce(b.status, 'active')::text as business_status,
    public.effective_plan_id(b.id)::text as plan_id,
    (select count(*) from public.profiles p
      where p.business_id = b.id and coalesce(p.status, 'active') <> 'rejected')::bigint as users_count,
    (select count(*) from public.products pr where pr.business_id = b.id)::bigint as products_count,
    coalesce(s.sales_24h, 0)::bigint,
    coalesce(s.sales_7d, 0)::bigint,
    s.last_sale_at,
    coalesce(h.devices_total, 0)::bigint,
    coalesce(h.devices_online, 0)::bigint,
    coalesce(h.pending_ops, 0)::bigint,
    coalesce(h.error_ops, 0)::bigint,
    h.avg_supabase_latency_ms::integer,
    h.avg_firebase_latency_ms::integer,
    h.last_seen_at,
    h.last_sync_at,
    e.last_error,
    e.last_error_at
  from public.businesses b
  left join lateral (
    select
      count(*) filter (where sa.created_at >= now() - interval '24 hours') as sales_24h,
      count(*) filter (where sa.created_at >= now() - interval '7 days') as sales_7d,
      max(sa.created_at) as last_sale_at
    from public.sales sa
    where sa.business_id = b.id
  ) s on true
  left join lateral (
    select
      count(*) as devices_total,
      count(*) filter (where ch.last_seen_at >= now() - interval '5 minutes') as devices_online,
      coalesce(sum(ch.pending_ops), 0) as pending_ops,
      coalesce(sum(ch.error_ops), 0) as error_ops,
      (avg(ch.supabase_latency_ms) filter (
        where ch.last_seen_at >= now() - interval '1 hour' and ch.supabase_latency_ms is not null
      ))::integer as avg_supabase_latency_ms,
      (avg(ch.firebase_latency_ms) filter (
        where ch.last_seen_at >= now() - interval '1 hour' and ch.firebase_latency_ms is not null
      ))::integer as avg_firebase_latency_ms,
      max(ch.last_seen_at) as last_seen_at,
      max(ch.last_sync_at) as last_sync_at
    from public.client_health ch
    where ch.business_id = b.id
  ) h on true
  left join lateral (
    select ch.last_error, ch.last_error_at
    from public.client_health ch
    where ch.business_id = b.id and ch.last_error is not null
    order by ch.last_error_at desc nulls last
    limit 1
  ) e on true
  order by b.created_at asc;
end;
$$;

revoke all on function public.admin_business_health() from public;
grant execute on function public.admin_business_health() to authenticated;

-- ══ 4. Salud global de la plataforma (solo admin) ══════════════
create or replace function public.admin_platform_health()
returns table (
  database_size_bytes bigint,
  businesses_total bigint,
  businesses_active bigint,
  users_total bigint,
  devices_online bigint,
  pending_ops bigint,
  error_ops bigint,
  sales_24h bigint,
  supabase_avg_ms integer,
  supabase_ok_rate numeric,
  firebase_avg_ms integer,
  firebase_ok_rate numeric,
  last_probe_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is distinct from public.admin_uid() then
    raise exception 'Solo el administrador puede ver la salud de la plataforma.'
      using errcode = '42501';
  end if;

  return query
  select
    pg_database_size(current_database())::bigint,
    (select count(*) from public.businesses)::bigint,
    (select count(*) from public.businesses
      where coalesce(status, 'active') = 'active')::bigint,
    (select count(*) from public.profiles
      where coalesce(status, 'active') <> 'rejected')::bigint,
    (select count(*) from public.client_health
      where last_seen_at >= now() - interval '5 minutes')::bigint,
    (select coalesce(sum(pending_ops), 0) from public.client_health)::bigint,
    (select coalesce(sum(error_ops), 0) from public.client_health)::bigint,
    (select count(*) from public.sales
      where created_at >= now() - interval '24 hours')::bigint,
    (select avg(latency_ms)::integer from public.health_probes
      where source = 'supabase' and ok
        and created_at >= now() - interval '24 hours'),
    (select round(avg(case when ok then 1.0 else 0.0 end) * 100, 1) from public.health_probes
      where source = 'supabase'
        and created_at >= now() - interval '24 hours'),
    (select avg(latency_ms)::integer from public.health_probes
      where source = 'firebase' and ok
        and created_at >= now() - interval '24 hours'),
    (select round(avg(case when ok then 1.0 else 0.0 end) * 100, 1) from public.health_probes
      where source = 'firebase'
        and created_at >= now() - interval '24 hours'),
    (select max(created_at) from public.health_probes);
end;
$$;

revoke all on function public.admin_platform_health() from public;
grant execute on function public.admin_platform_health() to authenticated;
