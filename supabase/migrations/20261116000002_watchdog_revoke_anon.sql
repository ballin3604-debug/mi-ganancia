-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · El Vigía no debe ser invocable por anónimos.
-- Supabase otorga EXECUTE a anon por privilegios por defecto; las funciones
-- ya validan auth.uid(), pero se revoca explícitamente para no exponer ni
-- siquiera la existencia de las RPCs a quien no inició sesión.
-- Aplicar con: npx supabase db push
-- ─────────────────────────────────────────────────────────────

revoke all on function public.report_client_health(text, text, text, boolean, integer, integer, integer, integer, timestamptz, text) from anon;
revoke all on function public.record_health_probe(text, boolean, integer, integer, text) from anon;
revoke all on function public.admin_business_health() from anon;
revoke all on function public.admin_platform_health() from anon;
