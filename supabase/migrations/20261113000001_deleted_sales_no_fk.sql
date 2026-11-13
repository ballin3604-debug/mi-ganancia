-- Los tombstones son un registro de auditoría del negocio, no una tabla
-- operativa: si se elimina un negocio completo, no deben bloquear ni
-- duplicar el borrado en cascada de sales. Se quita la FK y se conserva
-- business_id como dato plano (las filas de negocios borrados quedan
-- inaccesibles por RLS).
alter table public.deleted_sales
  drop constraint if exists deleted_sales_business_id_fkey;
