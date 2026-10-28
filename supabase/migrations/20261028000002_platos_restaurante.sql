-- Modo restaurante: platos que se venden sin inventario (sistema de tickets).
--
-- Un plato se cocina al momento: no se compra por unidad ni se cuenta en stock.
-- La venta SÍ se registra con sus sale_items (reportes y ticket intactos), pero
-- NO descuenta inventario ni global ni por sede.
--
-- Esta migración:
--   1. Agrega products.is_dish (false por defecto: los productos actuales no cambian).
--   2. Recrea registrar_venta saltando los decrementos de stock para is_dish.
--   3. Recrea registrar_venta_presentaciones con el mismo salto.
--
-- Aplicar con: npx supabase db push (o pegar en el SQL Editor).

begin;

alter table public.products add column if not exists is_dish boolean not null default false;

create or replace function public.registrar_venta(
  p_client_generated_id uuid, p_business_id uuid,
  p_client_name text, p_client_nit text, p_payment_method text,
  p_total numeric, p_item_count numeric, p_seller_name text,
  p_created_by uuid, p_items jsonb,
  p_factors jsonb default null, p_branch_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_creator public.profiles%rowtype;
  v_product public.products%rowtype;
  v_item jsonb;
  v_f jsonb;
  v_pid uuid;
  v_qty numeric;
  v_price numeric;
  v_factor numeric;
  v_base numeric;
  v_pres text;
  v_variant text;
  v_created_by uuid;
  v_branch_id uuid;
  v_existing_business_id uuid;
  v_branch_type text;
  v_valid_items integer := 0;
  v_has_sales_branch boolean := false;
  v_has_item_pres boolean := false;
  v_has_item_variant boolean := false;
  v_has_item_factor boolean := false;
  v_has_item_biz boolean := false;
  v_has_branch_tables boolean := false;
  v_has_branches boolean := false;
begin
  if p_client_generated_id is null or p_business_id is null then
    raise exception 'La venta necesita id y negocio.' using errcode = '22023';
  end if;
  if auth.uid() is null then
    raise exception 'Sesión requerida.' using errcode = '42501';
  end if;
  if p_items is not null and jsonb_typeof(p_items) <> 'array' then
    raise exception 'Los ítems de la venta deben ser un arreglo JSON.' using errcode = '22023';
  end if;
  if p_factors is not null and jsonb_typeof(p_factors) <> 'array' then
    raise exception 'Los factores de la venta deben ser un arreglo JSON.' using errcode = '22023';
  end if;
  if p_total is not null and p_total < 0 then
    raise exception 'El total de la venta no puede ser negativo.' using errcode = '22023';
  end if;
  if p_item_count is not null and p_item_count < 0 then
    raise exception 'La cantidad de la venta no puede ser negativa.' using errcode = '22023';
  end if;

  -- La fuente de verdad del negocio es el perfil de la sesión, no el payload.
  -- FOR SHARE evita que el perfil cambie de negocio a mitad de la operación.
  select * into v_profile
    from public.profiles
   where id = auth.uid()
   for share;
  if not found or v_profile.business_id is distinct from p_business_id then
    raise exception 'El usuario no pertenece a este negocio.' using errcode = '42501';
  end if;

  -- Una venta offline ya ocurrió físicamente. Si el stock del servidor quedó
  -- desfasado, se registra igual y el stock puede quedar negativo para que el
  -- dueño vea el faltante. El trigger solo permite negativos en este contexto.
  perform set_config('mg.allow_negative_stock', 'on', true);

  perform pg_advisory_xact_lock(hashtextextended(p_client_generated_id::text, 0));

  -- Idempotencia: si la venta ya existe, SOLO es válida si pertenece al mismo
  -- negocio. Así un id ajeno no se puede usar como "éxito" ni para sondear.
  select business_id into v_existing_business_id
    from public.sales
   where id = p_client_generated_id;
  if found then
    if v_existing_business_id is distinct from p_business_id then
      raise exception 'El id de venta ya pertenece a otro negocio.' using errcode = '42501';
    end if;
    return p_client_generated_id;
  end if;

  -- p_created_by se valida después de la idempotencia: si el mismo id ya se
  -- sincronizó, un reintento desde otra sesión del mismo negocio debe poder
  -- confirmarse sin descontar stock otra vez. Para ventas nuevas, el creador
  -- debe ser de este negocio (o la propia sesión si viene nulo).
  v_created_by := coalesce(p_created_by, auth.uid());
  if v_created_by is distinct from auth.uid() then
    select * into v_creator
      from public.profiles
     where id = v_created_by
     for share;
    if not found then
      -- El vendedor ya no existe (cuenta eliminada). La venta offline hecha en
      -- este negocio sigue siendo válida; se atribuye a la sesión que sincroniza
      -- para no dejar la cola trabada para siempre.
      v_created_by := auth.uid();
    elsif v_creator.business_id is distinct from p_business_id then
      raise exception 'El vendedor de la venta no pertenece a este negocio.' using errcode = '42501';
    end if;
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

  select exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sales' and column_name = 'branch_id')
    into v_has_sales_branch;
  select exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sale_items' and column_name = 'presentation')
    into v_has_item_pres;
  select exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sale_items' and column_name = 'variant')
    into v_has_item_variant;
  select exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sale_items' and column_name = 'presentation_factor')
    into v_has_item_factor;
  select exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sale_items' and column_name = 'business_id')
    into v_has_item_biz;
  v_has_branch_tables := to_regclass('public.branch_stock') is not null;
  v_has_branches := to_regclass('public.branches') is not null;

  if p_branch_id is not null and v_has_branches then
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
    v_branch_id := p_branch_id;
  end if;

  if v_has_sales_branch and v_branch_id is not null then
    insert into public.sales
      (id, business_id, client_name, client_nit, payment_method, total,
       item_count, seller_name, created_by, branch_id)
    values
      (p_client_generated_id, p_business_id, p_client_name, p_client_nit,
       p_payment_method, coalesce(p_total, 0), coalesce(p_item_count, 0),
       coalesce(p_seller_name, ''), v_created_by, v_branch_id)
    on conflict (id) do nothing;
  else
    insert into public.sales
      (id, business_id, client_name, client_nit, payment_method, total,
       item_count, seller_name, created_by)
    values
      (p_client_generated_id, p_business_id, p_client_name, p_client_nit,
       p_payment_method, coalesce(p_total, 0), coalesce(p_item_count, 0),
       coalesce(p_seller_name, ''), v_created_by)
    on conflict (id) do nothing;
  end if;
  if not found then
    return p_client_generated_id;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_pid := nullif(v_item ->> 'product_id', '')::uuid;
    v_qty := coalesce(nullif(v_item ->> 'quantity', '')::numeric, 0);
    v_price := coalesce(nullif(v_item ->> 'price', '')::numeric, 0);
    if v_pid is null or v_qty <= 0 then
      continue;
    end if;
    if v_qty = 'NaN'::numeric or v_price = 'NaN'::numeric then
      raise exception 'Cantidad o precio inválido.' using errcode = '22023';
    end if;

    v_factor := 1;
    v_pres := '';
    v_variant := '';
    if p_factors is not null then
      for v_f in select * from jsonb_array_elements(p_factors) loop
        if (v_f ->> 'product_id') = (v_item ->> 'product_id')
           and coalesce(nullif(v_f ->> 'quantity', '')::numeric, -1) = v_qty
           and coalesce(nullif(v_f ->> 'price', '')::numeric, -1) = v_price then
          v_factor := greatest(1, coalesce(nullif(v_f ->> 'factor', '')::numeric, 1));
          v_pres := coalesce(v_f ->> 'presentation', '');
          v_variant := coalesce(v_f ->> 'variant', '');
          exit;
        end if;
      end loop;
      if v_factor = 1 and v_pres = '' then
        select coalesce(max((f ->> 'factor')::numeric), 1),
               coalesce(max(f ->> 'presentation'), ''),
               coalesce(max(f ->> 'variant'), '')
          into v_factor, v_pres, v_variant
          from jsonb_array_elements(p_factors) f
         where (f ->> 'product_id') = (v_item ->> 'product_id');
        v_factor := greatest(1, coalesce(v_factor, 1));
      end if;
    end if;
    if v_factor = 'NaN'::numeric or v_factor <= 0 then
      raise exception 'Factor de presentación inválido.' using errcode = '22023';
    end if;
    v_base := v_qty * v_factor;

    -- El producto debe ser del negocio y se bloquea antes de leer/escribir
    -- stock: dos ventas concurrentes se serializan y no se pierde ningún
    -- decremento.
    select * into v_product
      from public.products
     where id = v_pid and business_id = p_business_id
     for update;
    if not found then
      raise exception 'El producto no pertenece a este negocio.' using errcode = '42501';
    end if;
    if v_has_item_biz then
      if v_has_item_pres and v_has_item_factor and v_has_item_variant then
        insert into public.sale_items
          (sale_id, business_id, product_id, product_name, product_brand,
           category, quantity, price, subtotal, supplier_price,
           presentation, presentation_factor, variant)
        values
          (p_client_generated_id, p_business_id, v_pid,
           v_item ->> 'product_name', coalesce(v_item ->> 'product_brand', ''),
           coalesce(v_item ->> 'category', 'Otros'), v_qty, v_price,
           v_qty * v_price,
           nullif(v_item ->> 'supplier_price', '')::numeric,
           v_pres, v_factor, v_variant);
      elsif v_has_item_pres then
        insert into public.sale_items
          (sale_id, business_id, product_id, product_name, product_brand,
           category, quantity, price, subtotal, supplier_price, presentation)
        values
          (p_client_generated_id, p_business_id, v_pid,
           v_item ->> 'product_name', coalesce(v_item ->> 'product_brand', ''),
           coalesce(v_item ->> 'category', 'Otros'), v_qty, v_price,
           v_qty * v_price,
           nullif(v_item ->> 'supplier_price', '')::numeric, v_pres);
      else
        insert into public.sale_items
          (sale_id, business_id, product_id, product_name, product_brand,
           category, quantity, price, subtotal, supplier_price)
        values
          (p_client_generated_id, p_business_id, v_pid,
           v_item ->> 'product_name', coalesce(v_item ->> 'product_brand', ''),
           coalesce(v_item ->> 'category', 'Otros'), v_qty, v_price,
           v_qty * v_price,
           nullif(v_item ->> 'supplier_price', '')::numeric);
      end if;
    else
      if v_has_item_pres and v_has_item_factor and v_has_item_variant then
        insert into public.sale_items
          (sale_id, product_id, product_name, product_brand,
           category, quantity, price, subtotal, supplier_price,
           presentation, presentation_factor, variant)
        values
          (p_client_generated_id, v_pid,
           v_item ->> 'product_name', coalesce(v_item ->> 'product_brand', ''),
           coalesce(v_item ->> 'category', 'Otros'), v_qty, v_price,
           v_qty * v_price,
           nullif(v_item ->> 'supplier_price', '')::numeric,
           v_pres, v_factor, v_variant);
      elsif v_has_item_pres then
        insert into public.sale_items
          (sale_id, product_id, product_name, product_brand,
           category, quantity, price, subtotal, supplier_price, presentation)
        values
          (p_client_generated_id, v_pid,
           v_item ->> 'product_name', coalesce(v_item ->> 'product_brand', ''),
           coalesce(v_item ->> 'category', 'Otros'), v_qty, v_price,
           v_qty * v_price,
           nullif(v_item ->> 'supplier_price', '')::numeric, v_pres);
      else
        insert into public.sale_items
          (sale_id, product_id, product_name, product_brand,
           category, quantity, price, subtotal, supplier_price)
        values
          (p_client_generated_id, v_pid,
           v_item ->> 'product_name', coalesce(v_item ->> 'product_brand', ''),
           coalesce(v_item ->> 'category', 'Otros'), v_qty, v_price,
           v_qty * v_price,
           nullif(v_item ->> 'supplier_price', '')::numeric);
      end if;
    end if;

    if coalesce(v_product.is_dish, false) then
      -- Plato: se vende sin inventario (ticket), no descuenta stock.
      null;
    else
      update public.products
         set stock = coalesce(stock, 0) - v_base,
             updated_at = now()
       where id = v_pid
         and business_id = p_business_id;
      if not found then
        raise exception 'No se pudo descontar el stock del producto %.', v_product.name using errcode = 'P0001';
      end if;

      if v_branch_id is not null and v_has_branch_tables then
        insert into public.branch_stock (branch_id, product_id, business_id, stock, updated_at)
        values (v_branch_id, v_pid, p_business_id, v_base * -1, now())
        on conflict (branch_id, product_id) do update
           set stock = public.branch_stock.stock - v_base,
               updated_at = now();
      end if;
    end if;

    v_valid_items := v_valid_items + 1;
  end loop;

  if v_valid_items = 0 then
    raise exception 'La venta necesita al menos un producto válido.' using errcode = '22023';
  end if;

  return p_client_generated_id;
end;
$$;

revoke all on function public.registrar_venta(uuid, uuid, text, text, text, numeric, numeric, text, uuid, jsonb, jsonb, uuid) from public, anon;
grant execute on function public.registrar_venta(uuid, uuid, text, text, text, numeric, numeric, text, uuid, jsonb, jsonb, uuid) to authenticated;

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
  v_creator public.profiles%rowtype;
  v_created_by uuid;
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

  -- Igual que registrar_venta: la venta ya ocurrió y debe sincronizarse aunque
  -- el stock del servidor esté desfasado.
  perform set_config('mg.allow_negative_stock', 'on', true);

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

  -- p_created_by se valida después de la idempotencia para que un reintento en
  -- un dispositivo compartido no quede trabado. Para ventas nuevas, el creador
  -- debe ser miembro del mismo negocio; si su cuenta ya no existe, la venta se
  -- atribuye a la sesión que la sincroniza.
  v_created_by := coalesce(p_created_by, auth.uid());
  if v_created_by is distinct from auth.uid() then
    select * into v_creator
      from public.profiles
     where id = v_created_by
     for share;
    if not found then
      v_created_by := auth.uid();
    elsif v_creator.business_id is distinct from p_business_id then
      raise exception 'El vendedor de la venta no pertenece a este negocio.' using errcode = '42501';
    end if;
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
    if coalesce(v_product.is_dish, false) then
      -- Plato: se vende sin inventario (ticket), no descuenta stock.
      null;
    else
      update public.products
         set stock = stock - v_base_quantity,
             updated_at = now()
       where id = v_product_id
         and business_id = p_business_id;
      if not found then
        raise exception 'No se pudo descontar el stock del producto %.', v_product.name using errcode = 'P0001';
      end if;

      if p_branch_id is not null then
        update public.branch_stock
           set stock = stock - v_base_quantity,
               updated_at = now()
         where branch_id = p_branch_id
           and product_id = v_product_id
           and business_id = p_business_id;
        if not found then
          -- Sin fila previa de stock por sede: se crea con el faltante, igual que
          -- registrar_venta, en vez de perder la venta offline.
          insert into public.branch_stock
            (branch_id, product_id, business_id, stock, updated_at)
          values
            (p_branch_id, v_product_id, p_business_id, v_base_quantity * -1, now())
          on conflict (branch_id, product_id) do update
             set stock = public.branch_stock.stock - v_base_quantity,
                 updated_at = now();
        end if;
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
    v_base_total, coalesce(p_seller_name, ''), v_created_by, p_branch_id
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

revoke all on function public.registrar_venta_presentaciones(uuid, uuid, text, text, text, numeric, numeric, text, uuid, jsonb, uuid) from public, anon;
grant execute on function public.registrar_venta_presentaciones(uuid, uuid, text, text, text, numeric, numeric, text, uuid, jsonb, uuid) to authenticated;

commit;
