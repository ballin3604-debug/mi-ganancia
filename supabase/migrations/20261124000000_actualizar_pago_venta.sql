-- Permite corregir el método de pago de una venta (efectivo/QR/mixto).
-- Se usa cuando el cajero se equivocó al registrar el cobro.

begin;

create or replace function public.actualizar_pago_venta(
  p_sale_id uuid,
  p_business_id uuid,
  p_payment_method text,
  p_monto_efectivo numeric default null,
  p_monto_qr numeric default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_sale public.sales%rowtype;
  v_method text;
begin
  if auth.uid() is null then
    raise exception 'Sesión requerida.' using errcode = '42501';
  end if;
  if p_sale_id is null or p_business_id is null then
    raise exception 'La venta necesita id y negocio.' using errcode = '22023';
  end if;

  v_method := lower(coalesce(trim(p_payment_method), ''));
  if v_method not in ('cash', 'qr', 'mixto') then
    raise exception 'Método de pago inválido.' using errcode = '22023';
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
    raise exception 'El usuario no tiene permiso para modificar ventas.' using errcode = '42501';
  end if;

  select * into v_sale
    from public.sales
   where id = p_sale_id and business_id = p_business_id
   for update;
  if not found then
    raise exception 'La venta no existe en este negocio.' using errcode = '42501';
  end if;
  if v_sale.status = 'cancelled' then
    raise exception 'No se puede cambiar el pago de una venta cancelada.' using errcode = '22023';
  end if;
  if v_sale.branch_id is not null
     and v_profile.role = 'cashier'
     and jsonb_typeof(v_profile.branch_ids) = 'array'
     and jsonb_array_length(v_profile.branch_ids) > 0
     and not (v_profile.branch_ids @> jsonb_build_array(v_sale.branch_id::text)) then
    raise exception 'El usuario no tiene acceso a la sucursal de la venta.' using errcode = '42501';
  end if;

  update public.sales
     set payment_method = v_method,
         monto_efectivo = case
           when v_method = 'mixto' then greatest(coalesce(p_monto_efectivo, 0), 0)
           when v_method = 'cash' then greatest(coalesce(p_monto_efectivo, coalesce(v_sale.total, 0)), 0)
           else null
         end,
         monto_qr = case
           when v_method = 'mixto' then greatest(coalesce(p_monto_qr, 0), 0)
           when v_method = 'qr' then greatest(coalesce(p_monto_qr, coalesce(v_sale.total, 0)), 0)
           else null
         end,
         updated_at = now()
   where id = p_sale_id and business_id = p_business_id;
end;
$$;

revoke all on function public.actualizar_pago_venta(uuid, uuid, text, numeric, numeric) from public, anon;
grant execute on function public.actualizar_pago_venta(uuid, uuid, text, numeric, numeric) to authenticated;

commit;
