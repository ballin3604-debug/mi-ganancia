-- Edición y cancelación de pedidos (modo restaurante).
--
-- La cajera puede agregar o retirar productos, ajustar cantidades y anular un
-- pedido. Cada cambio queda registrado en sale_changes ("Bitácora de pedidos")
-- y el stock se corrige por diferencia: lo retirado vuelve, lo agregado sale.
--
-- Aplicar con: npx supabase db push (o pegar en el SQL Editor).

begin;

alter table public.sales
  add column if not exists status text not null default 'completed',
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid,
  add column if not exists cancellation_reason text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.sales drop constraint if exists sales_status_check;
alter table public.sales
  add constraint sales_status_check check (status in ('completed', 'cancelled'));

create index if not exists sales_business_status_idx
  on public.sales (business_id, status, created_at desc);

create or replace function public.touch_sales_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sales_touch_updated_at on public.sales;
create trigger sales_touch_updated_at
  before update on public.sales
  for each row execute function public.touch_sales_updated_at();

create table if not exists public.sale_changes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  event_type text not null check (event_type in (
    'sale_cancelled', 'item_added', 'item_removed',
    'qty_increased', 'qty_decreased', 'sale_edited'
  )),
  product_id uuid,
  product_name text,
  quantity_before numeric,
  quantity_after numeric,
  amount_delta numeric not null default 0,
  total_before numeric,
  total_after numeric,
  reason text,
  created_by uuid,
  branch_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists sale_changes_business_created_idx
  on public.sale_changes (business_id, created_at desc);
create index if not exists sale_changes_sale_idx
  on public.sale_changes (sale_id, created_at desc);

alter table public.sale_changes enable row level security;

drop policy if exists "miembros ven cambios de pedidos" on public.sale_changes;
create policy "miembros ven cambios de pedidos"
  on public.sale_changes for select
  using (business_id = public.obtener_mi_business_id() or public.es_administrador());

grant select on table public.sale_changes to authenticated;

create or replace function public.editar_venta(
  p_sale_id uuid,
  p_business_id uuid,
  p_items jsonb,
  p_events jsonb default '[]'::jsonb,
  p_reason text default null,
  p_actor uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_sale public.sales%rowtype;
  v_product public.products%rowtype;
  v_item jsonb;
  v_event jsonb;
  v_old record;
  v_key text;
  v_item_id uuid;
  v_existing_sale_id uuid;
  v_product_id uuid;
  v_qty numeric;
  v_factor numeric;
  v_price numeric;
  v_base numeric;
  v_old_base numeric;
  v_new_base numeric;
  v_delta numeric;
  v_total numeric := 0;
  v_item_count numeric := 0;
  v_total_before numeric := 0;
  v_old_base_by_product jsonb := '{}'::jsonb;
  v_new_base_by_product jsonb := '{}'::jsonb;
  v_new_items jsonb := '[]'::jsonb;
  v_keep_ids uuid[] := '{}';
  v_actor uuid;
  v_event_actor uuid;
  v_has_branch_tables boolean;
begin
  if auth.uid() is null then
    raise exception 'Sesión requerida.' using errcode = '42501';
  end if;
  if p_sale_id is null or p_business_id is null then
    raise exception 'El pedido necesita id y negocio.' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido necesita al menos un producto.' using errcode = '22023';
  end if;
  if p_events is not null and jsonb_typeof(p_events) <> 'array' then
    raise exception 'Los cambios del pedido deben ser un arreglo JSON.' using errcode = '22023';
  end if;

  select * into v_profile
    from public.profiles
   where id = auth.uid()
   for share;
  if not found or v_profile.business_id is distinct from p_business_id then
    raise exception 'El usuario no pertenece a este negocio.' using errcode = '42501';
  end if;
  if v_profile.status is not null and v_profile.status <> 'active' then
    raise exception 'El usuario no está activo.' using errcode = '42501';
  end if;
  if v_profile.role = 'cashier'
     and jsonb_typeof(v_profile.custom_permissions) = 'array'
     and not (v_profile.custom_permissions @> '["cobrar"]'::jsonb) then
    raise exception 'El usuario no tiene permiso para editar pedidos.' using errcode = '42501';
  end if;

  select * into v_sale
    from public.sales
   where id = p_sale_id and business_id = p_business_id
   for update;
  if not found then
    raise exception 'El pedido no existe en este negocio.' using errcode = '42501';
  end if;
  if v_sale.status = 'cancelled' then
    raise exception 'El pedido ya está cancelado.' using errcode = 'P0001';
  end if;
  if v_sale.branch_id is not null
     and v_profile.role = 'cashier'
     and jsonb_typeof(v_profile.branch_ids) = 'array'
     and jsonb_array_length(v_profile.branch_ids) > 0
     and not (v_profile.branch_ids @> jsonb_build_array(v_sale.branch_id::text)) then
    raise exception 'El usuario no tiene acceso a la sucursal del pedido.' using errcode = '42501';
  end if;

  v_actor := coalesce(p_actor, auth.uid());
  if v_actor is distinct from auth.uid() then
    perform 1 from public.profiles
      where id = v_actor and business_id = p_business_id;
    if not found then
      v_actor := auth.uid();
    end if;
  end if;

  v_total_before := coalesce(v_sale.total, 0);
  v_has_branch_tables := to_regclass('public.branch_stock') is not null;

  -- Base vendida actualmente, por producto (para devolver/descontar stock).
  for v_old in
    select product_id,
           sum(coalesce(quantity, 0) * greatest(1, coalesce(presentation_factor, 1))) as base
      from public.sale_items
     where sale_id = p_sale_id
       and product_id is not null
     group by product_id
  loop
    v_key := v_old.product_id::text;
    v_old_base_by_product := jsonb_set(
      v_old_base_by_product,
      array[v_key],
      to_jsonb(coalesce((v_old_base_by_product ->> v_key)::numeric, 0) + coalesce(v_old.base, 0)),
      true
    );
  end loop;

  -- Valida las líneas finales y acumula la base nueva por producto.
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_item_id := nullif(v_item ->> 'id', '')::uuid;
    if v_item_id is null then
      v_item_id := gen_random_uuid();
    else
      select sale_id into v_existing_sale_id
        from public.sale_items
       where id = v_item_id;
      if found and v_existing_sale_id is distinct from p_sale_id then
        raise exception 'Una línea del pedido pertenece a otro pedido.' using errcode = '42501';
      end if;
    end if;

    v_product_id := nullif(v_item ->> 'product_id', '')::uuid;
    v_qty := coalesce(nullif(v_item ->> 'quantity', '')::numeric, 0);
    v_factor := greatest(1, coalesce(nullif(v_item ->> 'presentation_factor', '')::numeric, 1));
    v_price := coalesce(nullif(v_item ->> 'price', '')::numeric, 0);
    if v_product_id is null or v_qty <= 0 or v_qty = 'NaN'::numeric
       or v_factor = 'NaN'::numeric or v_price = 'NaN'::numeric or v_price < 0 then
      raise exception 'Cantidad, factor o precio inválido en el pedido.' using errcode = '22023';
    end if;

    select * into v_product
      from public.products
     where id = v_product_id and business_id = p_business_id
     for update;
    if not found then
      raise exception 'El producto no pertenece a este negocio.' using errcode = '42501';
    end if;

    v_base := v_qty * v_factor;
    v_key := v_product_id::text;
    v_new_base_by_product := jsonb_set(
      v_new_base_by_product,
      array[v_key],
      to_jsonb(coalesce((v_new_base_by_product ->> v_key)::numeric, 0) + v_base),
      true
    );
    v_keep_ids := array_append(v_keep_ids, v_item_id);
    v_total := v_total + (v_qty * v_price);
    v_item_count := v_item_count + v_base;
    v_new_items := v_new_items || jsonb_build_array(jsonb_build_object(
      'id', v_item_id,
      'product_id', v_product_id,
      'product_name', coalesce(nullif(v_item ->> 'product_name', ''), v_product.name),
      'product_brand', coalesce(v_item ->> 'product_brand', v_product.brand, ''),
      'category', coalesce(v_item ->> 'category', v_product.category, 'Otros'),
      'quantity', v_qty,
      'price', v_price,
      'subtotal', v_qty * v_price,
      'supplier_price', nullif(v_item ->> 'supplier_price', '')::numeric,
      'presentation', coalesce(v_item ->> 'presentation', ''),
      'presentation_id', nullif(v_item ->> 'presentation_id', ''),
      'presentation_factor', v_factor,
      'variant', coalesce(v_item ->> 'variant', '')
    ));
  end loop;

  -- Reemplaza el detalle conservando los ids de las líneas que siguen.
  delete from public.sale_items
   where sale_id = p_sale_id
     and not (id = any(v_keep_ids));

  for v_item in select value from jsonb_array_elements(v_new_items) loop
    insert into public.sale_items (
      id, sale_id, business_id, product_id, product_name, product_brand,
      category, quantity, price, subtotal, supplier_price,
      presentation, presentation_id, presentation_factor, variant
    ) values (
      (v_item ->> 'id')::uuid, p_sale_id, p_business_id,
      (v_item ->> 'product_id')::uuid, v_item ->> 'product_name',
      coalesce(v_item ->> 'product_brand', ''),
      coalesce(v_item ->> 'category', 'Otros'),
      (v_item ->> 'quantity')::numeric,
      (v_item ->> 'price')::numeric,
      (v_item ->> 'subtotal')::numeric,
      nullif(v_item ->> 'supplier_price', '')::numeric,
      coalesce(v_item ->> 'presentation', ''),
      nullif(v_item ->> 'presentation_id', ''),
      (v_item ->> 'presentation_factor')::numeric,
      coalesce(v_item ->> 'variant', '')
    )
    on conflict (id) do update set
      product_id = excluded.product_id,
      product_name = excluded.product_name,
      product_brand = excluded.product_brand,
      category = excluded.category,
      quantity = excluded.quantity,
      price = excluded.price,
      subtotal = excluded.subtotal,
      supplier_price = excluded.supplier_price,
      presentation = excluded.presentation,
      presentation_id = excluded.presentation_id,
      presentation_factor = excluded.presentation_factor,
      variant = excluded.variant
    where public.sale_items.sale_id = p_sale_id;
  end loop;

  -- Ajusta stock por diferencia (solo productos con inventario).
  perform set_config('mg.allow_negative_stock', 'on', true);
  for v_key in select jsonb_object_keys(v_old_base_by_product || v_new_base_by_product) loop
    v_old_base := coalesce((v_old_base_by_product ->> v_key)::numeric, 0);
    v_new_base := coalesce((v_new_base_by_product ->> v_key)::numeric, 0);
    v_delta := v_new_base - v_old_base;
    if v_delta = 0 then
      continue;
    end if;

    select * into v_product
      from public.products
     where id = v_key::uuid and business_id = p_business_id
     for update;
    if not found then
      if v_new_base > 0 then
        raise exception 'El producto del pedido ya no existe.' using errcode = '42501';
      end if;
      continue;
    end if;
    if coalesce(v_product.is_dish, false) then
      continue;
    end if;

    update public.products
       set stock = coalesce(stock, 0) - v_delta,
           updated_at = now()
     where id = v_product.id and business_id = p_business_id;

    if v_has_branch_tables and v_sale.branch_id is not null then
      insert into public.branch_stock (branch_id, product_id, business_id, stock, updated_at)
      values (v_sale.branch_id, v_product.id, p_business_id, v_delta * -1, now())
      on conflict (branch_id, product_id) do update
         set stock = public.branch_stock.stock - v_delta,
             updated_at = now();
    end if;
  end loop;

  update public.sales
     set total = v_total,
         item_count = round(v_item_count)::integer,
         updated_at = now()
   where id = p_sale_id and business_id = p_business_id;

  if p_events is not null and jsonb_array_length(p_events) > 0 then
    for v_event in select value from jsonb_array_elements(p_events) loop
      v_item_id := coalesce(nullif(v_event ->> 'id', '')::uuid, gen_random_uuid());
      v_event_actor := coalesce(nullif(v_event ->> 'created_by', '')::uuid, v_actor);
      if v_event_actor is distinct from v_actor then
        perform 1 from public.profiles
          where id = v_event_actor and business_id = p_business_id;
        if not found then
          v_event_actor := v_actor;
        end if;
      end if;

      insert into public.sale_changes (
        id, business_id, sale_id, event_type, product_id, product_name,
        quantity_before, quantity_after, amount_delta, total_before,
        total_after, reason, created_by, branch_id, created_at
      ) values (
        v_item_id, p_business_id, p_sale_id,
        v_event ->> 'event_type',
        nullif(v_event ->> 'product_id', '')::uuid,
        nullif(v_event ->> 'product_name', ''),
        nullif(v_event ->> 'quantity_before', '')::numeric,
        nullif(v_event ->> 'quantity_after', '')::numeric,
        coalesce(nullif(v_event ->> 'amount_delta', '')::numeric, 0),
        coalesce(nullif(v_event ->> 'total_before', '')::numeric, v_total_before),
        coalesce(nullif(v_event ->> 'total_after', '')::numeric, v_total),
        coalesce(nullif(v_event ->> 'reason', ''), p_reason),
        v_event_actor,
        coalesce(nullif(v_event ->> 'branch_id', '')::uuid, v_sale.branch_id),
        coalesce(nullif(v_event ->> 'created_at', '')::timestamptz, now())
      )
      on conflict (id) do nothing;
    end loop;
  end if;
end;
$$;

revoke all on function public.editar_venta(uuid, uuid, jsonb, jsonb, text, uuid) from public, anon;
grant execute on function public.editar_venta(uuid, uuid, jsonb, jsonb, text, uuid) to authenticated;

create or replace function public.cancelar_venta(
  p_sale_id uuid,
  p_business_id uuid,
  p_event jsonb default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_sale public.sales%rowtype;
  v_product public.products%rowtype;
  v_old record;
  v_event_id uuid;
  v_actor uuid;
  v_event_actor uuid;
  v_has_branch_tables boolean;
  v_reason text;
begin
  if auth.uid() is null then
    raise exception 'Sesión requerida.' using errcode = '42501';
  end if;
  if p_sale_id is null or p_business_id is null then
    raise exception 'El pedido necesita id y negocio.' using errcode = '22023';
  end if;

  select * into v_profile
    from public.profiles
   where id = auth.uid()
   for share;
  if not found or v_profile.business_id is distinct from p_business_id then
    raise exception 'El usuario no pertenece a este negocio.' using errcode = '42501';
  end if;
  if v_profile.status is not null and v_profile.status <> 'active' then
    raise exception 'El usuario no está activo.' using errcode = '42501';
  end if;
  if v_profile.role = 'cashier'
     and jsonb_typeof(v_profile.custom_permissions) = 'array'
     and not (v_profile.custom_permissions @> '["cobrar"]'::jsonb) then
    raise exception 'El usuario no tiene permiso para cancelar pedidos.' using errcode = '42501';
  end if;

  select * into v_sale
    from public.sales
   where id = p_sale_id and business_id = p_business_id
   for update;
  if not found then
    raise exception 'El pedido no existe en este negocio.' using errcode = '42501';
  end if;
  if v_sale.status = 'cancelled' then
    return;
  end if;
  if v_sale.branch_id is not null
     and v_profile.role = 'cashier'
     and jsonb_typeof(v_profile.branch_ids) = 'array'
     and jsonb_array_length(v_profile.branch_ids) > 0
     and not (v_profile.branch_ids @> jsonb_build_array(v_sale.branch_id::text)) then
    raise exception 'El usuario no tiene acceso a la sucursal del pedido.' using errcode = '42501';
  end if;

  v_actor := auth.uid();
  v_has_branch_tables := to_regclass('public.branch_stock') is not null;
  v_reason := coalesce(nullif(p_reason, ''), v_sale.cancellation_reason);

  perform set_config('mg.allow_negative_stock', 'on', true);

  -- Devuelve al inventario todo lo que consumía el pedido.
  for v_old in
    select product_id,
           sum(coalesce(quantity, 0) * greatest(1, coalesce(presentation_factor, 1))) as base
      from public.sale_items
     where sale_id = p_sale_id
       and product_id is not null
     group by product_id
  loop
    select * into v_product
      from public.products
     where id = v_old.product_id and business_id = p_business_id
     for update;
    if not found then
      continue;
    end if;
    if coalesce(v_product.is_dish, false) then
      continue;
    end if;

    update public.products
       set stock = coalesce(stock, 0) + coalesce(v_old.base, 0),
           updated_at = now()
     where id = v_product.id and business_id = p_business_id;

    if v_has_branch_tables and v_sale.branch_id is not null then
      insert into public.branch_stock (branch_id, product_id, business_id, stock, updated_at)
      values (v_sale.branch_id, v_product.id, p_business_id, coalesce(v_old.base, 0), now())
      on conflict (branch_id, product_id) do update
         set stock = public.branch_stock.stock + coalesce(v_old.base, 0),
             updated_at = now();
    end if;
  end loop;

  update public.sales
     set status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = v_actor,
         cancellation_reason = v_reason,
         updated_at = now()
   where id = p_sale_id and business_id = p_business_id;

  v_event_id := coalesce(nullif(p_event ->> 'id', '')::uuid, gen_random_uuid());
  v_event_actor := coalesce(nullif(p_event ->> 'created_by', '')::uuid, v_actor);
  if v_event_actor is distinct from v_actor then
    perform 1 from public.profiles
      where id = v_event_actor and business_id = p_business_id;
    if not found then
      v_event_actor := v_actor;
    end if;
  end if;

  insert into public.sale_changes (
    id, business_id, sale_id, event_type, product_id, product_name,
    quantity_before, quantity_after, amount_delta, total_before,
    total_after, reason, created_by, branch_id, created_at
  ) values (
    v_event_id, p_business_id, p_sale_id, 'sale_cancelled', null, null,
    null, null,
    coalesce(nullif(p_event ->> 'amount_delta', '')::numeric, -coalesce(v_sale.total, 0)),
    coalesce(nullif(p_event ->> 'total_before', '')::numeric, coalesce(v_sale.total, 0)),
    coalesce(nullif(p_event ->> 'total_after', '')::numeric, 0),
    v_reason, v_event_actor,
    coalesce(nullif(p_event ->> 'branch_id', '')::uuid, v_sale.branch_id),
    coalesce(nullif(p_event ->> 'created_at', '')::timestamptz, now())
  )
  on conflict (id) do nothing;
end;
$$;

revoke all on function public.cancelar_venta(uuid, uuid, jsonb, text) from public, anon;
grant execute on function public.cancelar_venta(uuid, uuid, jsonb, text) to authenticated;

commit;
