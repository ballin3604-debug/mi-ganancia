-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · Ventas eliminadas definitivamente (tombstones).
-- La sincronización de ventas es incremental y nunca borra la caché local
-- cuando el servidor deja de devolver una venta. Sin un registro de borrados,
-- una venta eliminada a mano en la base seguía visible para siempre en los
-- dispositivos que ya la tenían. Este trigger guarda el id eliminado y el
-- sync lo usa para limpiar sales/sale_items en todos los equipos.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.deleted_sales (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  sale_created_at timestamptz,
  deleted_at timestamptz not null default now()
);

create index if not exists deleted_sales_business_deleted_idx
  on public.deleted_sales (business_id, deleted_at desc);

alter table public.deleted_sales enable row level security;
revoke all on table public.deleted_sales from anon, authenticated, public;
grant select on table public.deleted_sales to authenticated;

drop policy if exists "miembros ven ventas eliminadas de su negocio" on public.deleted_sales;
create policy "miembros ven ventas eliminadas de su negocio"
  on public.deleted_sales for select to authenticated
  using (business_id = public.get_my_business_id());

create or replace function public.registrar_venta_eliminada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.deleted_sales (id, business_id, sale_created_at)
  values (OLD.id, OLD.business_id, OLD.created_at)
  on conflict (id) do update
    set business_id = excluded.business_id,
        sale_created_at = excluded.sale_created_at,
        deleted_at = now();
  return OLD;
end;
$$;

drop trigger if exists trg_sales_deleted on public.sales;
create trigger trg_sales_deleted
after delete on public.sales
for each row execute function public.registrar_venta_eliminada();
