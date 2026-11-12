-- Proforma digital / recepción:
--  · Recibe quién recepciona la mercadería.
--  · Descuento general de la proforma y precio de compra por paquete/caja.
--  · Último precio de compra por paquete/caja en la ficha del producto.
--  · Alertas cuando el costo por caja cambia respecto a la compra anterior.
begin;

alter table public.products
  add column if not exists last_purchase_package_price numeric,
  add column if not exists last_purchase_package_factor numeric,
  add column if not exists last_purchase_supplier text,
  add column if not exists last_purchase_proforma_number text,
  add column if not exists last_purchase_at timestamptz;

alter table public.replenishments
  add column if not exists proforma_received_by text,
  add column if not exists proforma_discount numeric default 0,
  add column if not exists package_price numeric;

create table if not exists public.purchase_price_alerts (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  product_code text,
  product_name text not null,
  supplier text,
  old_package_price numeric not null,
  new_package_price numeric not null,
  difference_amount numeric not null,
  difference_pct numeric not null,
  package_factor numeric default 1,
  previous_sale_price numeric,
  proforma_id uuid,
  proforma_number text,
  proforma_date date,
  status text not null default 'pending' check (status in ('pending', 'reviewed')),
  reviewed_at timestamptz,
  reviewed_by uuid,
  updated_sale_price numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists purchase_price_alerts_business_status_idx
  on public.purchase_price_alerts (business_id, status, created_at desc);
create index if not exists purchase_price_alerts_product_idx
  on public.purchase_price_alerts (product_id, created_at desc);

alter table public.purchase_price_alerts enable row level security;

drop policy if exists "miembros ven alertas de precios" on public.purchase_price_alerts;
create policy "miembros ven alertas de precios"
  on public.purchase_price_alerts for select
  to authenticated
  using (
    business_id in (select business_id from public.profiles where id = auth.uid())
  );

drop policy if exists "miembros crean alertas de precios" on public.purchase_price_alerts;
create policy "miembros crean alertas de precios"
  on public.purchase_price_alerts for insert
  to authenticated
  with check (
    business_id in (select business_id from public.profiles where id = auth.uid())
  );

drop policy if exists "miembros actualizan alertas de precios" on public.purchase_price_alerts;
create policy "miembros actualizan alertas de precios"
  on public.purchase_price_alerts for update
  to authenticated
  using (
    business_id in (select business_id from public.profiles where id = auth.uid())
  )
  with check (
    business_id in (select business_id from public.profiles where id = auth.uid())
  );

grant select, insert, update on table public.purchase_price_alerts to authenticated;

comment on column public.products.last_purchase_package_price is 'Último precio de compra por paquete/caja (Bs).';
comment on column public.products.last_purchase_package_factor is 'Unidades por paquete/caja de la última compra.';
comment on column public.replenishments.package_price is 'Precio de compra por paquete/caja tal como se cargó en la proforma.';
comment on column public.replenishments.proforma_received_by is 'Persona que recepcionó la mercadería.';
comment on column public.replenishments.proforma_discount is 'Descuento general aplicado a la proforma.';

commit;
