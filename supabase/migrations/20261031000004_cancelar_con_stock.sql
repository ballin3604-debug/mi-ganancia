-- Cancelación de pedidos con decisión de stock.
-- Al anular un pedido, el cajero o dueño elige si los productos vuelven al
-- inventario o si quedan descontados (merma, producto consumido, etc.).
-- Se guarda la decisión en sales.stock_returned para mostrarla después.

begin;

alter table public.sales
  add column if not exists stock_returned boolean not null default true;

drop function if exists public.cancelar_venta(uuid, uuid, jsonb, text);

create or replace function public.cancelar_venta(
  p_sale_id uuid,
  p_business_id uuid,
  p_event jsonb default null,
  p_reason text default null,
  p_restock boolean default true
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
  v_restock boolean;
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
  v_restock := coalesce(p_restock, true);

  perform set_config('mg.allow_negative_stock', 'on', true);

  -- Solo devuelve al inventario si el usuario decidió que el producto sirve.
  if v_restock then
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
  end if;

  update public.sales
     set status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = v_actor,
         cancellation_reason = v_reason,
         stock_returned = v_restock,
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

revoke all on function public.cancelar_venta(uuid, uuid, jsonb, text, boolean) from public, anon;
grant execute on function public.cancelar_venta(uuid, uuid, jsonb, text, boolean) to authenticated;

commit;
