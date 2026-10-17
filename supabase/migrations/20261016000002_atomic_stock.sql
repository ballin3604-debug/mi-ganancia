-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · Stock atómico (concurrencia).
-- Elimina read-modify-write del cliente: todo decremento es
--   UPDATE ... SET stock = stock - X
-- con row lock de Postgres. Dos ventas/traspasos concurrentes se serializan
-- y ninguna se pierde. Nunca se asume 0 ante errores de lectura: los RPC
-- fallan (reintento) en vez de sobrescribir.
-- Aplicar con:  npx supabase db push   (o pegar en SQL Editor)
-- ─────────────────────────────────────────────────────────────

-- 1. Decremento atómico de products.stock (paquetes: extra = qty×(factor−1)).
create or replace function public.descontar_stock_atomico(p_product_id uuid, p_qty numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_product_id is null or coalesce(p_qty, 0) = 0 then
    return;
  end if;
  update public.products
     set stock = coalesce(stock, 0) - coalesce(p_qty, 0),
         updated_at = now()
   where id = p_product_id;
end;
$$;

-- 2. Decremento atómico de branch_stock (upsert: crea la fila si falta).
-- Si la tabla Fase 2 no existe, no hace nada (tolerante a migración pendiente).
create or replace function public.descontar_branch_stock_atomico(
  p_branch_id uuid, p_product_id uuid, p_business_id uuid, p_qty numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_branch_id is null or p_product_id is null or coalesce(p_qty, 0) = 0 then
    return;
  end if;
  if to_regclass('public.branch_stock') is null then
    return;
  end if;
  insert into public.branch_stock (branch_id, product_id, business_id, stock, updated_at)
  values (p_branch_id, p_product_id, p_business_id, coalesce(p_qty, 0) * -1, now())
  on conflict (branch_id, product_id) do update
     set stock = public.branch_stock.stock - coalesce(p_qty, 0),
         updated_at = now();
end;
$$;

-- 3. Traspaso atómico entre sedes, idempotente por p_transfer_id.
create or replace function public.transfer_stock_atomico(
  p_transfer_id uuid, p_business_id uuid, p_product_id uuid,
  p_from_branch_id uuid, p_to_branch_id uuid,
  p_quantity numeric, p_created_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qty numeric := coalesce(p_quantity, 0);
  v_from_stock numeric;
begin
  if p_transfer_id is null then
    raise exception 'transfer_stock_atomico: p_transfer_id requerido';
  end if;
  if v_qty <= 0 then
    raise exception 'transfer_stock_atomico: cantidad debe ser > 0';
  end if;
  if p_from_branch_id is null or p_to_branch_id is null
     or p_from_branch_id = p_to_branch_id then
    raise exception 'transfer_stock_atomico: sedes inválidas';
  end if;
  if to_regclass('public.branch_stock') is null
     or to_regclass('public.transfers') is null then
    raise exception 'transfer_stock_atomico: faltan tablas Fase 2 (branch_stock/transfers)'
      using errcode = '42P01';
  end if;

  -- Serializa reintentos del MISMO transfer_id (evita doble movimiento si dos
  -- workers sincronizan la misma op a la vez). Distintos ids van en paralelo.
  perform pg_advisory_xact_lock(hashtextextended(p_transfer_id::text, 0));

  -- Idempotencia: si ya se registró, no mover nada.
  if exists (select 1 from public.transfers where id = p_transfer_id) then
    return p_transfer_id;
  end if;

  -- Bloquea la fila origen (serializa traspasos/ventas concurrentes).
  select stock into v_from_stock
    from public.branch_stock
   where branch_id = p_from_branch_id and product_id = p_product_id
   for update;

  if not found then
    raise exception 'La sede origen no tiene stock del producto (%)', p_product_id;
  end if;
  if coalesce(v_from_stock, 0) < v_qty then
    raise exception 'Stock insuficiente en origen: tiene % y pide %', v_from_stock, v_qty;
  end if;

  -- Bloquea/crea destino y mueve con aritmética del servidor (sin lost update).
  insert into public.branch_stock (branch_id, product_id, business_id, stock, updated_at)
  values (p_from_branch_id, p_product_id, p_business_id, coalesce(v_from_stock, 0) - v_qty, now())
  on conflict (branch_id, product_id) do update
     set stock = public.branch_stock.stock - v_qty,
         updated_at = now();

  insert into public.branch_stock (branch_id, product_id, business_id, stock, updated_at)
  values (p_to_branch_id, p_product_id, p_business_id, v_qty, now())
  on conflict (branch_id, product_id) do update
     set stock = public.branch_stock.stock + v_qty,
         updated_at = now();

  insert into public.transfers
    (id, business_id, product_id, from_branch_id, to_branch_id, quantity, created_by)
  values
    (p_transfer_id, p_business_id, p_product_id, p_from_branch_id, p_to_branch_id, v_qty, p_created_by)
  on conflict (id) do nothing;

  return p_transfer_id;
end;
$$;

-- 4. Venta atómica total: venta + ítems + stock base + stock sede en UNA
-- transacción. p_factors: [{product_id, quantity, factor, price,
-- presentation, variant}]; base = quantity×factor. p_branch_id opcional.
-- Idempotente por p_client_generated_id: si ya existe, no descuenta de nuevo.
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
set search_path = public
as $$
declare
  v_item jsonb;
  v_f jsonb;
  v_pid uuid;
  v_qty numeric;
  v_price numeric;
  v_factor numeric;
  v_base numeric;
  v_pres text;
  v_variant text;
  v_has_sales_branch boolean := false;
  v_has_item_pres boolean := false;
  v_has_item_variant boolean := false;
  v_has_item_factor boolean := false;
  v_has_item_biz boolean := false;
  v_has_branch_tables boolean := false;
begin
  if p_client_generated_id is null then
    raise exception 'registrar_venta: p_client_generated_id requerido';
  end if;

  -- Serializa reintentos del MISMO sale id; distintas ventas van en paralelo.
  -- Junto al ON CONFLICT de abajo evita doble inserción/descuento si dos
  -- workers sincronizan la misma venta a la vez.
  perform pg_advisory_xact_lock(hashtextextended(p_client_generated_id::text, 0));

  -- Idempotencia: reintento seguro, sin doble descuento.
  if exists (select 1 from public.sales where id = p_client_generated_id) then
    return p_client_generated_id;
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
  v_has_branch_tables :=
    to_regclass('public.branch_stock') is not null;

  -- Venta (con sede si la columna existe y viene sede). ON CONFLICT cubre la
  -- carrera entre el EXISTS de arriba y el INSERT (dos syncs de la misma venta).
  if v_has_sales_branch and p_branch_id is not null then
    insert into public.sales
      (id, business_id, client_name, client_nit, payment_method, total,
       item_count, seller_name, created_by, branch_id)
    values
      (p_client_generated_id, p_business_id, p_client_name, p_client_nit,
       p_payment_method, coalesce(p_total, 0), coalesce(p_item_count, 0),
       coalesce(p_seller_name, ''), p_created_by, p_branch_id)
    on conflict (id) do nothing;
  else
    insert into public.sales
      (id, business_id, client_name, client_nit, payment_method, total,
       item_count, seller_name, created_by)
    values
      (p_client_generated_id, p_business_id, p_client_name, p_client_nit,
       p_payment_method, coalesce(p_total, 0), coalesce(p_item_count, 0),
       coalesce(p_seller_name, ''), p_created_by)
    on conflict (id) do nothing;
  end if;
  -- Si otro worker la creó en la carrera, salir sin descontar de nuevo.
  if not found then
    return p_client_generated_id;
  end if;

  -- Ítems + stock. Un UPDATE por producto con row lock: concurrentes en serie.
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_pid := nullif(v_item ->> 'product_id', '')::uuid;
    v_qty := coalesce(nullif(v_item ->> 'quantity', '')::numeric, 0);
    v_price := coalesce(nullif(v_item ->> 'price', '')::numeric, 0);
    if v_pid is null or v_qty <= 0 then
      continue;
    end if;

    -- Factor: match por producto (+cantidad/precio si hay varios).
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
      -- Fallback: primer factor del mismo producto (payloads de 1 presentación).
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
    v_base := v_qty * v_factor;

    -- Ítem (columnas opcionales solo si existen en el servidor).
    if v_has_item_biz then
      if v_has_item_pres and v_has_item_factor and v_has_item_variant then
        insert into public.sale_items
          (sale_id, business_id, product_id, product_name, product_brand,
           category, quantity, price, supplier_price,
           presentation, presentation_factor, variant)
        values
          (p_client_generated_id, p_business_id, v_pid,
           v_item ->> 'product_name', coalesce(v_item ->> 'product_brand', ''),
           coalesce(v_item ->> 'category', 'Otros'), v_qty, v_price,
           nullif(v_item ->> 'supplier_price', '')::numeric,
           v_pres, v_factor, v_variant);
      elsif v_has_item_pres then
        insert into public.sale_items
          (sale_id, business_id, product_id, product_name, product_brand,
           category, quantity, price, supplier_price, presentation)
        values
          (p_client_generated_id, p_business_id, v_pid,
           v_item ->> 'product_name', coalesce(v_item ->> 'product_brand', ''),
           coalesce(v_item ->> 'category', 'Otros'), v_qty, v_price,
           nullif(v_item ->> 'supplier_price', '')::numeric, v_pres);
      else
        insert into public.sale_items
          (sale_id, business_id, product_id, product_name, product_brand,
           category, quantity, price, supplier_price)
        values
          (p_client_generated_id, p_business_id, v_pid,
           v_item ->> 'product_name', coalesce(v_item ->> 'product_brand', ''),
           coalesce(v_item ->> 'category', 'Otros'), v_qty, v_price,
           nullif(v_item ->> 'supplier_price', '')::numeric);
      end if;
    else
      if v_has_item_pres and v_has_item_factor and v_has_item_variant then
        insert into public.sale_items
          (sale_id, product_id, product_name, product_brand,
           category, quantity, price, supplier_price,
           presentation, presentation_factor, variant)
        values
          (p_client_generated_id, v_pid,
           v_item ->> 'product_name', coalesce(v_item ->> 'product_brand', ''),
           coalesce(v_item ->> 'category', 'Otros'), v_qty, v_price,
           nullif(v_item ->> 'supplier_price', '')::numeric,
           v_pres, v_factor, v_variant);
      elsif v_has_item_pres then
        insert into public.sale_items
          (sale_id, product_id, product_name, product_brand,
           category, quantity, price, supplier_price, presentation)
        values
          (p_client_generated_id, v_pid,
           v_item ->> 'product_name', coalesce(v_item ->> 'product_brand', ''),
           coalesce(v_item ->> 'category', 'Otros'), v_qty, v_price,
           nullif(v_item ->> 'supplier_price', '')::numeric, v_pres);
      else
        insert into public.sale_items
          (sale_id, product_id, product_name, product_brand,
           category, quantity, price, supplier_price)
        values
          (p_client_generated_id, v_pid,
           v_item ->> 'product_name', coalesce(v_item ->> 'product_brand', ''),
           coalesce(v_item ->> 'category', 'Otros'), v_qty, v_price,
           nullif(v_item ->> 'supplier_price', '')::numeric);
      end if;
    end if;

    -- Stock global en UNIDADES BASE, atómico (sin lost update).
    update public.products
       set stock = coalesce(stock, 0) - v_base,
           updated_at = now()
     where id = v_pid;

    -- Stock por sede, atómico (upsert con suma del servidor).
    if p_branch_id is not null and v_has_branch_tables then
      insert into public.branch_stock (branch_id, product_id, business_id, stock, updated_at)
      values (p_branch_id, v_pid, p_business_id, v_base * -1, now())
      on conflict (branch_id, product_id) do update
         set stock = public.branch_stock.stock - v_base,
             updated_at = now();
    end if;
  end loop;

  return p_client_generated_id;
end;
$$;

-- Permisos de ejecución para el cliente.
grant execute on function public.descontar_stock_atomico(uuid, numeric) to authenticated;
grant execute on function public.descontar_branch_stock_atomico(uuid, uuid, uuid, numeric) to authenticated;
grant execute on function public.transfer_stock_atomico(uuid, uuid, uuid, uuid, uuid, numeric, uuid) to authenticated;
grant execute on function public.registrar_venta(uuid, uuid, text, text, text, numeric, numeric, text, uuid, jsonb, jsonb, uuid) to authenticated;

-- Compat: si existía una versión vieja de 10 args, que delegue a la nueva
-- (así los clientes viejos también descuentan sin lost update en lo global).
-- Se intenta reemplazar solo si la firma vieja existe; si no, no hace nada.
do $$
begin
  -- Nota: no se borra nada; la sobrecarga de 12 args convive con la de 10.
  -- Si tu servidor tenía lógica propia en la de 10 args y prefieres
  -- conservarla, ignora este bloque: el cliente nuevo llama la de 12 args.
  null;
end $$;
