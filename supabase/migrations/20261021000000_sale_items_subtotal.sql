-- Fix: registrar_venta insertaba sale_items sin `subtotal`, que es NOT NULL.
-- El RPC fallaba con "null value in column subtotal ... violates not-null
-- constraint" y las ventas quedaban atascadas en la cola de sincronización.
-- Aplicar con:  npx supabase db push   (o pegar en SQL Editor)

alter table public.sale_items
  add column if not exists subtotal numeric;

update public.sale_items
   set subtotal = coalesce(quantity, 0) * coalesce(price, 0)
 where subtotal is null;

alter table public.sale_items
  alter column subtotal set default 0,
  alter column subtotal set not null;

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

  perform pg_advisory_xact_lock(hashtextextended(p_client_generated_id::text, 0));

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
    v_base := v_qty * v_factor;

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
     where id = v_pid;

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

grant execute on function public.registrar_venta(uuid, uuid, text, text, text, numeric, numeric, text, uuid, jsonb, jsonb, uuid) to authenticated;
