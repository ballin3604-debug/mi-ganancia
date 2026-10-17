-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · Bootstrap de public.admin_uid().
-- La usan migraciones POSTERIORES (20260925182934_billing_storage,
-- 20260925223555_rls_limits, 20261016000000_security_hardening), así que
-- debe existir antes que ellas. La definición canónica y las policies que
-- dependen del helper siguen en 20261016000001_admin_uid_helper.sql
-- (create or replace es idempotente: redefinir aquí es seguro).
-- Para cambiar de admin: actualiza VITE_ADMIN_UID (.env + redeploy) Y el
-- literal de aquí + el de 20261016000001, en una migración nueva.
-- ─────────────────────────────────────────────────────────────

create or replace function public.admin_uid()
returns uuid
language sql
immutable
set search_path = public, pg_temp
as $$
  select '8b000c8e-41c8-4836-81ad-544e7fedb3f1'::uuid
$$;

revoke all on function public.admin_uid() from public;
grant execute on function public.admin_uid() to authenticated, anon;
