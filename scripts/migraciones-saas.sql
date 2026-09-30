-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · Paso 2 del plan SaaS: auditoría de acciones admin.
-- Quién hizo qué, cuándo y sobre qué negocio. Base para mover los
-- borrados masivos a Edge Functions con service_role.
-- Aplicar con:  npx supabase db push   (tras `supabase link`)
-- ─────────────────────────────────────────────────────────────

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  admin_id uuid,
  admin_email text,
  action text not null,
  business_id uuid,
  business_name text,
  details jsonb,
  result text not null default 'ok'
);

-- Solo el servicio (Edge Functions con service_role) escribe aquí.
-- Nadie desde el cliente: sin policies de INSERT/UPDATE/DELETE para anon/authenticated.
alter table public.admin_audit_log enable row level security;
-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · Realtime en profiles: la app se entera sola cuando el
-- admin aprueba / suspende / reactiva, sin recargar ni cerrar sesión.
-- Aplicar con:  npx supabase db push   (tras `supabase link`)
-- O pegar este bloque en SQL Editor del dashboard.
-- ─────────────────────────────────────────────────────────────

-- Idempotente: si ya es miembro (como en este proyecto), no hace nada.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;
-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · Paso 4 del plan SaaS: facturación (planes, suscripciones, pagos)
-- Modelo: 1 suscripción por NEGOCIO (no por usuario). Plan free/pro.
-- Fase 1 = cobro manual con QR + comprobante que aprueba el admin.
-- Aplicar con:  npx supabase db push   (tras `supabase link`)
-- ─────────────────────────────────────────────────────────────

-- 1. Planes (catálogo)
create table if not exists public.plans (
  id text primary key,
  name text not null,
  price_monthly numeric not null default 0,
  price_yearly numeric not null default 0,
  max_products int not null default 100,
  max_users int not null default 1,
  features jsonb not null default '{}'::jsonb
);

insert into public.plans (id, name, price_monthly, price_yearly, max_products, max_users, features)
values
  ('free', 'Gratis', 0, 0, 100, 1,
   '{"scanner": false, "advanced_reports": false, "pdf_export": false, "multi_user": false}'::jsonb),
  ('pro', 'Pro', 49, 490, 1000000, 5,
   '{"scanner": true, "advanced_reports": true, "pdf_export": true, "multi_user": true}'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  price_monthly = excluded.price_monthly,
  price_yearly = excluded.price_yearly,
  max_products = excluded.max_products,
  max_users = excluded.max_users,
  features = excluded.features;

-- 2. Suscripción por negocio (1 fila por negocio)
create table if not exists public.subscriptions (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  plan_id text not null default 'free' references public.plans(id),
  status text not null default 'trial',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Pagos / comprobantes (los sube el dueño, los aprueba el admin)
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  plan_id text not null default 'pro' references public.plans(id),
  billing_cycle text not null default 'monthly',
  amount numeric not null,
  method text not null default 'qr',
  reference text,
  receipt_url text,
  status text not null default 'pending',
  reviewed_at timestamptz,
  reviewed_by uuid,
  admin_note text,
  created_at timestamptz not null default now()
);
create index if not exists payments_business_idx on public.payments (business_id, created_at desc);

-- 4. RLS: cada miembro ve lo de SU negocio; solo el servicio escribe
-- suscripciones (el admin las gestiona vía dashboard / Edge Function).
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;

drop policy if exists "plans públicos" on public.plans;
create policy "plans públicos"
  on public.plans for select
  to anon, authenticated
  using (true);

drop policy if exists "miembros ven su suscripción" on public.subscriptions;
create policy "miembros ven su suscripción"
  on public.subscriptions for select
  to authenticated
  using (
    business_id in (select business_id from public.profiles where id = auth.uid())
  );

drop policy if exists "miembros ven sus pagos" on public.payments;
create policy "miembros ven sus pagos"
  on public.payments for select
  to authenticated
  using (
    business_id in (select business_id from public.profiles where id = auth.uid())
  );

drop policy if exists "dueños suben comprobantes" on public.payments;
create policy "dueños suben comprobantes"
  on public.payments for insert
  to authenticated
  with check (
    business_id in (
      select business_id from public.profiles
      where id = auth.uid() and (role is null or role <> 'cashier')
    )
  );

-- NOTA: altas de suscripción y aprobación de pagos las hace el servicio
-- (service_role / Edge Function) o el admin desde el dashboard.
-- Si tus policies existentes usan un bypass de admin por UID, réplica ese
-- patrón aquí tras revisar el dump de policies del paso 1B.
-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · Sucursales y almacenes + plan Premium + trial automático.
-- Fase 1: sucursales para organizar ventas por sede (stock global).
-- Fase 2 (después): stock por sucursal + traspasos.
-- Aplicar con:  npx supabase db push   (o pegar en SQL Editor)
-- ─────────────────────────────────────────────────────────────

-- 1. Tabla de sucursales / almacenes
create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  type text not null default 'sucursal',
  address text,
  phone text,
  is_main boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists branches_business_idx on public.branches (business_id);

-- 2. Columna de sucursal en ventas y gastos (para reportes por sede)
alter table public.sales
  add column if not exists branch_id uuid references public.branches(id) on delete set null;
alter table public.expenses
  add column if not exists branch_id uuid references public.branches(id) on delete set null;

-- 3. Plan Premium en el catálogo
insert into public.plans (id, name, price_monthly, price_yearly, max_products, max_users, features)
values
  ('premium', 'Premium', 99, 990, 1000000, 15,
   '{"scanner": true, "advanced_reports": true, "pdf_export": true, "multi_user": true, "branches": true, "warehouses": true}'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  price_monthly = excluded.price_monthly,
  price_yearly = excluded.price_yearly,
  max_products = excluded.max_products,
  max_users = excluded.max_users,
  features = excluded.features;

-- Pro necesita flag branches=false explícito (era implícito antes)
update public.plans
set features = features || '{"branches": false, "warehouses": false}'::jsonb
where id = 'free';
update public.plans
set features = features || '{"branches": false, "warehouses": false}'::jsonb
where id = 'pro';

-- 4. Trial Pro 14 días + sucursal principal automáticos al crear negocio
create or replace function public.start_trial()
returns trigger
language plpgsql
security definer
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

drop trigger if exists on_business_created on public.businesses;
create trigger on_business_created
  after insert on public.businesses
  for each row execute function public.start_trial();

-- 4b. Backfill: negocios que ya existían también reciben principal + trial
insert into public.branches (business_id, name, type, is_main)
select id, 'Casa matriz', 'sucursal', true from public.businesses b
where not exists (select 1 from public.branches br where br.business_id = b.id);

insert into public.subscriptions (business_id, plan_id, status, trial_ends_at, current_period_end)
select id, 'pro', 'trial', now() + interval '14 days', now() + interval '14 days'
from public.businesses b
where not exists (select 1 from public.subscriptions s where s.business_id = b.id);

-- 5. RLS de sucursales: miembros ven las de su negocio;
-- crear/editar/borrar solo dueños (no cajeros).
alter table public.branches enable row level security;

drop policy if exists "miembros ven sus sucursales" on public.branches;
create policy "miembros ven sus sucursales"
  on public.branches for select
  to authenticated
  using (
    business_id in (select business_id from public.profiles where id = auth.uid())
  );

drop policy if exists "dueños gestionan sucursales" on public.branches;
create policy "dueños gestionan sucursales"
  on public.branches for all
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
-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · Fase 2: stock por sede + traspasos.
-- El stock deja de ser global: vive en branch_stock (sede × producto).
-- products.stock queda como total (caché) y se mantiene por deltas.
-- Aplicar con:  npx supabase db push   (o pegar en SQL Editor)
-- ─────────────────────────────────────────────────────────────

-- 1. Stock por sede
create table if not exists public.branch_stock (
  branch_id uuid not null references public.branches(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  stock numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (branch_id, product_id)
);
create index if not exists branch_stock_business_idx on public.branch_stock (business_id);
create index if not exists branch_stock_product_idx on public.branch_stock (product_id);

-- 2. Traspasos entre sedes (historial, no se borra)
create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  from_branch_id uuid references public.branches(id) on delete set null,
  to_branch_id uuid references public.branches(id) on delete set null,
  quantity numeric not null,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists transfers_business_idx on public.transfers (business_id, created_at desc);
create index if not exists transfers_product_idx on public.transfers (product_id);

-- 3. Backfill: el stock actual de cada producto pertenece a la principal
insert into public.branch_stock (branch_id, product_id, business_id, stock)
select br.id, p.id, p.business_id, coalesce(p.stock, 0)
from public.products p
join public.branches br on br.business_id = p.business_id and br.is_main
on conflict (branch_id, product_id) do nothing;

-- 4. RLS: miembros gestionan lo de su negocio (traspasos no se borran)
alter table public.branch_stock enable row level security;
alter table public.transfers enable row level security;

drop policy if exists "miembros gestionan stock por sede" on public.branch_stock;
create policy "miembros gestionan stock por sede"
  on public.branch_stock for all
  to authenticated
  using (
    business_id in (select business_id from public.profiles where id = auth.uid())
  )
  with check (
    business_id in (select business_id from public.profiles where id = auth.uid())
  );

drop policy if exists "miembros ven traspasos" on public.transfers;
create policy "miembros ven traspasos"
  on public.transfers for select
  to authenticated
  using (
    business_id in (select business_id from public.profiles where id = auth.uid())
  );

drop policy if exists "miembros crean traspasos" on public.transfers;
create policy "miembros crean traspasos"
  on public.transfers for insert
  to authenticated
  with check (
    business_id in (select business_id from public.profiles where id = auth.uid())
  );
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
-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · Módulo Veterinaria (tablas clínicas).
-- Se activa por categoría de negocio; comparte auth, billing, stock y sync.
-- Aplicar con:  npx supabase db push   (o pegar en SQL Editor)
-- ─────────────────────────────────────────────────────────────

-- 1. Dueños de mascotas (teléfono = canal de recordatorios por WhatsApp)
create table if not exists public.pet_owners (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  phone text not null default '',
  address text default '',
  notes text default '',
  created_at timestamptz not null default now()
);
create index if not exists pet_owners_business_idx on public.pet_owners (business_id);
create index if not exists pet_owners_phone_idx on public.pet_owners (phone);

-- 2. Mascotas / pacientes
create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  owner_id uuid references public.pet_owners(id) on delete set null,
  name text not null,
  species text not null default 'perro',
  breed text default '',
  sex text default '',
  birthdate date,
  weight numeric,
  color text default '',
  chip_code text default '',
  photo_url text default '',
  notes text default '',
  created_at timestamptz not null default now()
);
create index if not exists pets_business_idx on public.pets (business_id);
create index if not exists pets_owner_idx on public.pets (owner_id);
create index if not exists pets_name_idx on public.pets (name);

-- 3. Historial clínico (una fila por consulta)
create table if not exists public.clinical_records (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  vet_name text default '',
  visit_date date not null default current_date,
  reason text default '',
  diagnosis text default '',
  treatment text default '',
  weight numeric,
  temperature numeric,
  notes text default '',
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists clinical_records_pet_idx on public.clinical_records (pet_id, visit_date desc);

-- 4. Recetarios (items libres + link opcional a productos del inventario)
create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  record_id uuid references public.clinical_records(id) on delete set null,
  items jsonb not null default '[]'::jsonb,
  notes text default '',
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists prescriptions_pet_idx on public.prescriptions (pet_id, created_at desc);
-- items: [{ name, product_id?, dosage, frequency, duration }]

-- 5. Vacunas y tratamientos con próxima dosis (motor de recordatorios)
create table if not exists public.vaccinations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  vaccine_name text not null,
  date_applied date not null default current_date,
  next_due date,
  vet_name text default '',
  notes text default '',
  created_at timestamptz not null default now()
);
create index if not exists vaccinations_due_idx on public.vaccinations (business_id, next_due);

-- 6. Recordatorios (vacuna, control, baño, desparasitación…)
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  type text not null default 'control',
  title text not null,
  due_date date not null,
  status text not null default 'pending',
  sent_at timestamptz,
  notes text default '',
  created_at timestamptz not null default now()
);
create index if not exists reminders_due_idx on public.reminders (business_id, status, due_date);

-- 7. RLS: miembros gestionan lo de su negocio (sin borrado de historial clínico)
alter table public.pet_owners enable row level security;
alter table public.pets enable row level security;
alter table public.clinical_records enable row level security;
alter table public.prescriptions enable row level security;
alter table public.vaccinations enable row level security;
alter table public.reminders enable row level security;

-- Lectura + escritura propia por negocio (generado en bloque)
do $$
declare
  t text;
begin
  foreach t in array array['pet_owners','pets','clinical_records','prescriptions','vaccinations','reminders']
  loop
    execute format('drop policy if exists "miembros gestionan %s" on public.%I', t, t);
    execute format('create policy "miembros gestionan %s" on public.%I for all to authenticated using (business_id in (select business_id from public.profiles where id = auth.uid())) with check (business_id in (select business_id from public.profiles where id = auth.uid()))', t, t);
  end loop;
end $$;
