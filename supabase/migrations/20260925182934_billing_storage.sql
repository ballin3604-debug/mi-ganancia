-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · Cobro manual Fase 1: bucket de comprobantes + admin en billing.
-- El dueño paga por QR y sube la foto; el admin aprueba y se extiende el plan.
-- Aplicar con:  npx supabase db push   (o pegar en SQL Editor)
-- ─────────────────────────────────────────────────────────────

-- 1. Bucket privado de comprobantes
insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', false)
on conflict (id) do nothing;

-- 2. Dueños suben comprobantes a la carpeta de SU negocio
drop policy if exists "dueños suben comprobantes" on storage.objects;
create policy "dueños suben comprobantes"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'payment-receipts'
    and (storage.foldername(name))[1] in (
      select business_id::text from public.profiles where id = auth.uid()
    )
  );

-- 3. Dueños ven sus propios comprobantes
drop policy if exists "dueños ven sus comprobantes" on storage.objects;
create policy "dueños ven sus comprobantes"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'payment-receipts'
    and (storage.foldername(name))[1] in (
      select business_id::text from public.profiles where id = auth.uid()
    )
  );

-- 4. Admin total en comprobantes (ver los de todos para aprobar)
-- Fuente única: src/config/admin.js (VITE_ADMIN_UID). En SQL se centraliza
-- en public.admin_uid() (ver 20261016000001_admin_uid_helper.sql).
drop policy if exists "admin ve comprobantes" on storage.objects;
create policy "admin ve comprobantes"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'payment-receipts'
    and auth.uid() = public.admin_uid()
  );

-- 5. Admin gestiona suscripciones y pagos (el Edge Function usa service_role,
-- estas policies cubren el fallback directo desde el Panel Admin).
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
