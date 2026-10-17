-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · Centralizar UID admin en SQL.
-- Fuente de verdad en frontend: src/config/admin.js (VITE_ADMIN_UID).
-- Las policies SQL no pueden importar JS, así que el único lugar con el
-- literal en SQL es public.admin_uid() aquí abajo. Todo lo demás usa
-- auth.uid() = public.admin_uid().
-- Para cambiar de admin: actualiza VITE_ADMIN_UID (.env + redeploy) Y el
-- return de public.admin_uid() en una nueva migración.
-- Aplica con: npx supabase db push
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

-- is_exempt_caller ahora usa el helper (con search_path fijo para lint).
create or replace function public.is_exempt_caller()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(auth.jwt()->>'role', '') = 'service_role'
      or auth.uid() = public.admin_uid()
$$;

-- Re-aplica las policies que antes llevaban el literal:
-- billing_storage (comprobantes / suscripciones / pagos).
drop policy if exists "admin ve comprobantes" on storage.objects;
create policy "admin ve comprobantes"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'payment-receipts'
    and auth.uid() = public.admin_uid()
  );

drop policy if exists "admin gestiona suscripciones" on public.subscriptions;
create policy "admin gestiona suscripciones"
  on public.subscriptions for all
  to authenticated
  using (auth.uid() = public.admin_uid())
  with check (auth.uid() = public.admin_uid());

drop policy if exists "admin gestiona pagos" on public.payments;
create policy "admin gestiona pagos"
  on public.payments for all
  to authenticated
  using (auth.uid() = public.admin_uid())
  with check (auth.uid() = public.admin_uid());

-- Transfers (definidas en 20261016000000_security_hardening.sql).
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

-- Auditoría: solo admin.
drop policy if exists "admin ve auditoría" on public.admin_audit_log;
create policy "admin ve auditoría"
  on public.admin_audit_log for select
  to authenticated
  using (auth.uid() = public.admin_uid());
