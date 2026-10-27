begin;

alter table public.products
  add column if not exists presentations jsonb;

update public.products
   set presentations = '[]'::jsonb
 where presentations is null;

do $$
declare
  v_invalid_count bigint;
begin
  select count(*) into v_invalid_count
    from public.products
   where jsonb_typeof(presentations) is distinct from 'array';
  if v_invalid_count > 0 then
    raise exception 'No se puede migrar: % productos tienen presentaciones que no son un arreglo JSON.', v_invalid_count;
  end if;
end;
$$;

alter table public.products
  alter column presentations set default '[]'::jsonb,
  alter column presentations set not null;

alter table public.sales
  add column if not exists branch_id uuid references public.branches(id) on delete set null;

alter table public.sale_items
  add column if not exists business_id uuid,
  add column if not exists presentation_id text,
  add column if not exists presentation text default '',
  add column if not exists presentation_factor numeric,
  add column if not exists variant text default '',
  add column if not exists subtotal numeric;

update public.sale_items as item
   set business_id = sale.business_id
  from public.sales as sale
 where sale.id = item.sale_id
   and item.business_id is null;

do $$
declare
  v_orphan_count bigint;
  v_unassigned_count bigint;
  v_mismatch_count bigint;
  v_item_business_att smallint;
  v_business_id_att smallint;
begin
  select count(*) into v_orphan_count
    from public.sale_items as item
    left join public.sales as sale on sale.id = item.sale_id
   where sale.id is null;
  if v_orphan_count > 0 then
    raise exception 'No se puede migrar: % líneas de venta no tienen venta padre.', v_orphan_count;
  end if;

  select count(*) into v_unassigned_count
    from public.sale_items as item
    join public.sales as sale on sale.id = item.sale_id
   where item.business_id is null or sale.business_id is null;
  if v_unassigned_count > 0 then
    raise exception 'No se puede migrar: % líneas de venta siguen sin negocio asociado.', v_unassigned_count;
  end if;

  select count(*) into v_mismatch_count
    from public.sale_items as item
    join public.sales as sale on sale.id = item.sale_id
   where item.business_id is distinct from sale.business_id;
  if v_mismatch_count > 0 then
    raise exception 'No se puede migrar: % líneas de venta no coinciden con el negocio de su venta.', v_mismatch_count;
  end if;

  alter table public.sale_items alter column business_id set not null;

  select attnum into v_item_business_att
    from pg_attribute
   where attrelid = 'public.sale_items'::regclass
     and attname = 'business_id'
     and not attisdropped;
  select attnum into v_business_id_att
    from pg_attribute
   where attrelid = 'public.businesses'::regclass
     and attname = 'id'
     and not attisdropped;

  if not exists (
    select 1
      from pg_constraint as constraint_row
     where constraint_row.conrelid = 'public.sale_items'::regclass
       and constraint_row.confrelid = 'public.businesses'::regclass
       and constraint_row.contype = 'f'
       and constraint_row.conkey = array[v_item_business_att]::smallint[]
       and constraint_row.confkey = array[v_business_id_att]::smallint[]
  ) then
    alter table public.sale_items
      add constraint sale_items_business_id_businesses_fkey
      foreign key (business_id) references public.businesses(id) on delete cascade;
  end if;
end;
$$;

update public.sale_items
   set subtotal = coalesce(quantity, 0) * coalesce(price, 0)
 where subtotal is null;

alter table public.sale_items
  alter column subtotal set default 0,
  alter column subtotal set not null;

create or replace function public.prevent_negative_stock()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.stock < 0 then
    if tg_op = 'INSERT' then
      raise exception 'El stock no puede ser negativo.' using errcode = 'P0001';
    elsif new.stock < old.stock then
      raise exception 'Stock insuficiente: la operación dejaría stock negativo.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_negative_products_stock on public.products;
create trigger prevent_negative_products_stock
  before insert or update of stock on public.products
  for each row execute function public.prevent_negative_stock();

drop trigger if exists prevent_negative_branch_stock on public.branch_stock;
create trigger prevent_negative_branch_stock
  before insert or update of stock on public.branch_stock
  for each row execute function public.prevent_negative_stock();

create or replace function public.registrar_venta_presentaciones(
  p_client_generated_id uuid,
  p_business_id uuid,
  p_client_name text,
  p_client_nit text,
  p_payment_method text,
  p_total numeric,
  p_item_count numeric,
  p_seller_name text,
  p_created_by uuid,
  p_items jsonb,
  p_branch_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_product public.products%rowtype;
  v_item jsonb;
  v_presentation jsonb;
  v_sale_items jsonb := '[]'::jsonb;
  v_product_id uuid;
  v_quantity numeric;
  v_factor numeric;
  v_price numeric;
  v_base_quantity numeric;
  v_base_total numeric := 0;
  v_total numeric := 0;
  v_presentation_id text;
  v_presentation_name text;
  v_variant text;
  v_existing_business_id uuid;
  v_branch_type text;
  v_branch_stock numeric;
  v_valid_factor numeric;
  v_valid_price numeric;
  v_base_count integer;
  v_presentation_count integer;
begin
  if p_client_generated_id is null or p_business_id is null then
    raise exception 'La venta necesita id y negocio.' using errcode = '22023';
  end if;
  if p_created_by is not null and p_created_by <> auth.uid() then
    raise exception 'El vendedor de la venta no coincide con la sesión.' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta necesita al menos un producto.' using errcode = '22023';
  end if;
  if auth.uid() is null then
    raise exception 'Sesión requerida.' using errcode = '42501';
  end if;

  select * into v_profile
    from public.profiles
   where id = auth.uid()
   for share;
  if not found or v_profile.business_id is distinct from p_business_id then
    raise exception 'El usuario no pertenece a este negocio.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_client_generated_id::text, 0));
  select business_id into v_existing_business_id
    from public.sales
   where id = p_client_generated_id;
  if found then
    if v_existing_business_id is distinct from p_business_id then
      raise exception 'El id de venta ya pertenece a otro negocio.' using errcode = '42501';
    end if;
    return p_client_generated_id;
  end if;

  if v_profile.status is not null and v_profile.status <> 'active' then
    raise exception 'El usuario no está activo.' using errcode = '42501';
  end if;
  if v_profile.role = 'cashier'
     and jsonb_typeof(v_profile.custom_permissions) = 'array'
     and not (v_profile.custom_permissions @> '["cobrar"]'::jsonb) then
    raise exception 'El usuario no tiene permiso para cobrar.' using errcode = '42501';
  end if;
  if v_profile.role = 'cashier'
     and jsonb_typeof(v_profile.branch_ids) = 'array'
     and jsonb_array_length(v_profile.branch_ids) > 0
     and p_branch_id is null then
    raise exception 'El usuario debe operar desde una sucursal asignada.' using errcode = '42501';
  end if;

  if p_branch_id is not null then
    select type into v_branch_type
      from public.branches
     where id = p_branch_id and business_id = p_business_id
     for share;
    if not found then
      raise exception 'La sucursal no pertenece a este negocio.' using errcode = '42501';
    end if;
    if v_branch_type = 'almacen' then
      raise exception 'Los almacenes no pueden registrar ventas.' using errcode = '42501';
    end if;
    if v_profile.role = 'cashier'
       and jsonb_typeof(v_profile.branch_ids) = 'array'
       and jsonb_array_length(v_profile.branch_ids) > 0
       and not (v_profile.branch_ids @> jsonb_build_array(p_branch_id::text)) then
      raise exception 'El usuario no tiene acceso a esta sucursal.' using errcode = '42501';
    end if;
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_product_id := nullif(v_item ->> 'product_id', '')::uuid;
    v_quantity := nullif(v_item ->> 'quantity', '')::numeric;
    v_factor := nullif(v_item ->> 'presentation_factor', '')::numeric;
    v_price := nullif(v_item ->> 'price', '')::numeric;
    v_presentation_id := nullif(v_item ->> 'presentation_id', '');
    v_variant := coalesce(v_item ->> 'variant', '');
    v_presentation := null;

    if v_product_id is null or v_quantity is null or v_quantity <= 0 or v_quantity <> trunc(v_quantity)
       or v_factor is null or v_factor <= 0 or v_price is null or v_price <= 0 then
      raise exception 'Cantidad, factor o precio de presentación inválido.' using errcode = '22023';
    end if;

    select * into v_product
      from public.products
     where id = v_product_id and business_id = p_business_id
     for update;
    if not found then
      raise exception 'El producto no pertenece a este negocio.' using errcode = '42501';
    end if;

    if v_presentation_id is not null then
      if jsonb_typeof(v_product.presentations) <> 'array' then
        raise exception 'El producto no tiene presentaciones configuradas.' using errcode = '22023';
      end if;
      select count(*) into v_base_count
        from jsonb_array_elements(v_product.presentations) as base_rows(value)
       where coalesce((base_rows.value ->> 'isBase')::boolean, false);
      if v_base_count <> 1 or not exists (
        select 1
          from jsonb_array_elements(v_product.presentations) as base_rows(value)
         where coalesce((base_rows.value ->> 'isBase')::boolean, false)
           and nullif(base_rows.value ->> 'factor', '')::numeric = 1
           and nullif(base_rows.value ->> 'price', '')::numeric is not null
           and abs(nullif(base_rows.value ->> 'price', '')::numeric - coalesce(v_product.price, 0)) <= 0.005
      ) then
        raise exception 'La unidad base del producto no está configurada correctamente.' using errcode = '22023';
      end if;
      select count(*) into v_presentation_count
        from jsonb_array_elements(v_product.presentations) as presentation_rows(value)
       where presentation_rows.value ->> 'id' = v_presentation_id;
      if v_presentation_count <> 1 then
        raise exception 'El identificador de presentación no es único.' using errcode = '22023';
      end if;
      select value into v_presentation
        from jsonb_array_elements(v_product.presentations)
       where value ->> 'id' = v_presentation_id
       limit 1;
      if v_presentation is null then
        raise exception 'La presentación ya no existe para este producto.' using errcode = '22023';
      end if;
      v_valid_factor := nullif(v_presentation ->> 'factor', '')::numeric;
      v_valid_price := nullif(v_presentation ->> 'price', '')::numeric;
      if v_valid_factor is null or v_valid_price is null
         or v_valid_factor <> v_factor
         or abs(v_valid_price - v_price) > 0.005 then
        raise exception 'El factor o precio no coincide con la presentación guardada.' using errcode = '22023';
      end if;
      v_presentation_name := coalesce(nullif(v_presentation ->> 'name', ''), 'Unidad')
        || case when v_factor > 1 then ' x' || v_factor::text else '' end;
      v_variant := '';
    elsif v_factor = 1 then
      if abs(coalesce(v_product.price, 0) - v_price) > 0.005 then
        raise exception 'El precio base cambió; actualiza la venta.' using errcode = '22023';
      end if;
      v_presentation_name := coalesce(nullif(v_product.unit_label, ''), 'Unidad');
      v_variant := '';
    elsif v_factor = coalesce(v_product.package_size, 0)
       and v_factor > 1
       and (
         (v_variant = 'frio' and abs(coalesce(v_product.pack_price, -1) - v_price) <= 0.005)
         or (v_variant = 'caliente' and abs(coalesce(v_product.pack_price_hot, -1) - v_price) <= 0.005)
       ) then
      v_presentation_name := coalesce(nullif(v_item ->> 'presentation', ''), nullif(v_product.pack_label, ''), 'Paquete');
    else
      raise exception 'La presentación legacy no coincide con la configuración del producto.' using errcode = '22023';
    end if;

    v_base_quantity := v_quantity * v_factor;
    if coalesce(v_product.stock, 0) < v_base_quantity then
      raise exception 'Stock global insuficiente para el producto %.', v_product.name using errcode = 'P0001';
    end if;
    update public.products
       set stock = stock - v_base_quantity,
           updated_at = now()
     where id = v_product_id
       and business_id = p_business_id
       and coalesce(stock, 0) >= v_base_quantity;
    if not found then
      raise exception 'Stock global insuficiente para el producto %.', v_product.name using errcode = 'P0001';
    end if;

    if p_branch_id is not null then
      select stock into v_branch_stock
        from public.branch_stock
       where branch_id = p_branch_id
         and product_id = v_product_id
         and business_id = p_business_id
       for update;
      if not found or coalesce(v_branch_stock, 0) < v_base_quantity then
        raise exception 'Stock insuficiente en la sucursal para el producto %.', v_product.name using errcode = 'P0001';
      end if;
      update public.branch_stock
         set stock = stock - v_base_quantity,
             updated_at = now()
       where branch_id = p_branch_id
         and product_id = v_product_id
         and business_id = p_business_id
         and coalesce(stock, 0) >= v_base_quantity;
      if not found then
        raise exception 'Stock insuficiente en la sucursal para el producto %.', v_product.name using errcode = 'P0001';
      end if;
    end if;

    v_total := v_total + (v_quantity * v_price);
    v_base_total := v_base_total + v_base_quantity;
    v_sale_items := v_sale_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_product_id,
      'product_name', coalesce(nullif(v_item ->> 'product_name', ''), v_product.name),
      'product_brand', coalesce(v_item ->> 'product_brand', v_product.brand, ''),
      'category', coalesce(v_item ->> 'category', v_product.category, 'Otros'),
      'quantity', v_quantity,
      'price', v_price,
      'subtotal', v_quantity * v_price,
      'supplier_price', nullif(v_item ->> 'supplier_price', '')::numeric,
      'presentation_id', v_presentation_id,
      'presentation', v_presentation_name,
      'presentation_factor', v_factor,
      'variant', v_variant
    ));
  end loop;

  if abs(v_total - coalesce(p_total, 0)) > 0.01
     or abs(v_base_total - coalesce(p_item_count, 0)) > 0.001 then
    raise exception 'Los totales de venta no coinciden con sus presentaciones.' using errcode = '22023';
  end if;

  insert into public.sales (
    id, business_id, client_name, client_nit, payment_method, total,
    item_count, seller_name, created_by, branch_id
  ) values (
    p_client_generated_id, p_business_id, coalesce(p_client_name, 'S/N'),
    coalesce(p_client_nit, '0'), coalesce(p_payment_method, 'cash'), v_total,
    v_base_total, coalesce(p_seller_name, ''), p_created_by, p_branch_id
  );

  for v_item in select value from jsonb_array_elements(v_sale_items) loop
    insert into public.sale_items (
      sale_id, business_id, product_id, product_name, product_brand,
      category, quantity, price, subtotal, supplier_price, presentation_id,
      presentation, presentation_factor, variant
    ) values (
      p_client_generated_id, p_business_id, (v_item ->> 'product_id')::uuid,
      v_item ->> 'product_name', coalesce(v_item ->> 'product_brand', ''),
      coalesce(v_item ->> 'category', 'Otros'), (v_item ->> 'quantity')::numeric,
      (v_item ->> 'price')::numeric, (v_item ->> 'subtotal')::numeric,
      nullif(v_item ->> 'supplier_price', '')::numeric,
      nullif(v_item ->> 'presentation_id', ''),
      coalesce(v_item ->> 'presentation', ''),
      (v_item ->> 'presentation_factor')::numeric,
      coalesce(v_item ->> 'variant', '')
    );
  end loop;

  return p_client_generated_id;
end;
$$;

revoke all on function public.registrar_venta_presentaciones(uuid, uuid, text, text, text, numeric, numeric, text, uuid, jsonb, uuid) from public;
grant execute on function public.registrar_venta_presentaciones(uuid, uuid, text, text, text, numeric, numeric, text, uuid, jsonb, uuid) to authenticated;

commit;
