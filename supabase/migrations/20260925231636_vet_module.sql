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
