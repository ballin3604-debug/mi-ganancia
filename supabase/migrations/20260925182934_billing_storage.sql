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
-- UID espejo del VITE_ADMIN_UID del frontend (ya es público en el bundle).
drop policy if exists "admin ve comprobantes" on storage.objects;
create policy "admin ve comprobantes"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'payment-receipts'
    and auth.uid() = '8b000c8e-41c8-4836-81ad-544e7fedb3f1'::uuid
  );

-- 5. Admin gestiona suscripciones y pagos (el Edge Function usa service_role,
-- estas policies cubren el fallback directo desde el Panel Admin).
drop policy if exists "admin gestiona suscripciones" on public.subscriptions;
create policy "admin gestiona suscripciones"
  on public.subscriptions for all
  to authenticated
  using (auth.uid() = '8b000c8e-41c8-4836-81ad-544e7fedb3f1'::uuid)
  with check (auth.uid() = '8b000c8e-41c8-4836-81ad-544e7fedb3f1'::uuid);

drop policy if exists "admin gestiona pagos" on public.payments;
create policy "admin gestiona pagos"
  on public.payments for all
  to authenticated
  using (auth.uid() = '8b000c8e-41c8-4836-81ad-544e7fedb3f1'::uuid)
  with check (auth.uid() = '8b000c8e-41c8-4836-81ad-544e7fedb3f1'::uuid);
