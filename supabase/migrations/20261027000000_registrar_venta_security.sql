-- Endurecimiento de public.registrar_venta.
--
-- Antes, cualquier usuario autenticado podía llamar el RPC (security definer)
-- con el business_id, product_id y created_by que quisiera: el stock se
-- descontaba sin verificar que el producto perteneciera al negocio y la
-- idempotencia devolvía ids de venta de otros negocios como si fueran propios.
--
-- Esta migración:
--   1. Exige sesión y pertenencia real al negocio (profiles.business_id).
--   2. Valida la idempotencia contra el business_id de la venta existente.
--   3. Deja el chequeo de p_created_by DESPUÉS de la idempotencia, para que un
--      reintento en un dispositivo compartido no quede trabado.
--   4. Bloquea y filtra cada producto por business_id antes de tocar stock.
--   5. Valida la sede, el rol de cajero y sus permisos.
--   6. Mantiene la lógica legacy de presentaciones y subtotal.
--   7. Hace que la firma vieja de 10 argumentos delegue en la de 12.
--
-- Aplicar con: npx supabase db push (o pegar en el SQL Editor).

begin;

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
    if coalesce(v_product.stock, 0) < v_base then
      raise exception 'Stock global insuficiente para el producto %.', v_product.name using errcode = 'P0001';
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

    update public.products
       set stock = coalesce(stock, 0) - v_base,
           updated_at = now()
     where id = v_pid
       and business_id = p_business_id
       and coalesce(stock, 0) >= v_base;
    if not found then
      raise exception 'Stock global insuficiente para el producto %.', v_product.name using errcode = 'P0001';
    end if;

    if v_branch_id is not null and v_has_branch_tables then
      insert into public.branch_stock (branch_id, product_id, business_id, stock, updated_at)
      values (v_branch_id, v_pid, p_business_id, v_base * -1, now())
      on conflict (branch_id, product_id) do update
         set stock = public.branch_stock.stock - v_base,
             updated_at = now();
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

-- Compatibilidad con clientes viejos que llaman la firma de 10 argumentos.
-- Se elimina cualquier sobrecarga previa con esa firma exacta para evitar
-- choques de nombres de parámetros y se recrea como wrapper de la de 12.
drop function if exists public.registrar_venta(uuid, uuid, text, text, text, numeric, numeric, text, uuid, jsonb);

create or replace function public.registrar_venta(
  p_client_generated_id uuid, p_business_id uuid,
  p_client_name text, p_client_nit text, p_payment_method text,
  p_total numeric, p_item_count numeric, p_seller_name text,
  p_created_by uuid, p_items jsonb
)
returns uuid
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.registrar_venta(
    p_client_generated_id, p_business_id, p_client_name, p_client_nit,
    p_payment_method, p_total, p_item_count, p_seller_name, p_created_by,
    p_items, null::jsonb, null::uuid
  );
$$;

revoke all on function public.registrar_venta(uuid, uuid, text, text, text, numeric, numeric, text, uuid, jsonb) from public, anon;
grant execute on function public.registrar_venta(uuid, uuid, text, text, text, numeric, numeric, text, uuid, jsonb) to authenticated;

commit;
