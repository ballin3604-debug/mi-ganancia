-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · Corrige "column reference pending_ops is ambiguous".
-- En PL/pgSQL los nombres de salida de RETURNS TABLE actúan como variables;
-- los subselects de admin_platform_health usaban pending_ops/error_ops sin
-- calificar y chocaban con la columna. Se recrea la función con alias.
-- Aplicar con: npx supabase db push
-- ─────────────────────────────────────────────────────────────

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
    (select count(*) from public.businesses b)::bigint,
    (select count(*) from public.businesses b
      where coalesce(b.status, 'active') = 'active')::bigint,
    (select count(*) from public.profiles p
      where coalesce(p.status, 'active') <> 'rejected')::bigint,
    (select count(*) from public.client_health ch
      where ch.last_seen_at >= now() - interval '5 minutes')::bigint,
    (select coalesce(sum(ch.pending_ops), 0) from public.client_health ch)::bigint,
    (select coalesce(sum(ch.error_ops), 0) from public.client_health ch)::bigint,
    (select count(*) from public.sales sa
      where sa.created_at >= now() - interval '24 hours')::bigint,
    (select avg(hp.latency_ms)::integer from public.health_probes hp
      where hp.source = 'supabase' and hp.ok
        and hp.created_at >= now() - interval '24 hours'),
    (select round(avg(case when hp.ok then 1.0 else 0.0 end) * 100, 1) from public.health_probes hp
      where hp.source = 'supabase'
        and hp.created_at >= now() - interval '24 hours'),
    (select avg(hp.latency_ms)::integer from public.health_probes hp
      where hp.source = 'firebase' and hp.ok
        and hp.created_at >= now() - interval '24 hours'),
    (select round(avg(case when hp.ok then 1.0 else 0.0 end) * 100, 1) from public.health_probes hp
      where hp.source = 'firebase'
        and hp.created_at >= now() - interval '24 hours'),
    (select max(hp.created_at) from public.health_probes hp);
end;
$$;

revoke all on function public.admin_platform_health() from public;
revoke all on function public.admin_platform_health() from anon;
grant execute on function public.admin_platform_health() to authenticated;
