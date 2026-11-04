-- Repara products.stock cuando quedó distinto de la suma de sus sedes.
-- Pasaba al ajustar el stock de una sede: el cliente actualizaba branch_stock
-- y el total local, pero el UPDATE_PRODUCT no se encolaba y el pull posterior
-- devolvía el global viejo. La pantalla mostraba el stock de la sede (20) y la
-- venta fallaba con "Stock insuficiente ... quedan 0 unidades base".
-- Idempotente: solo toca productos que tienen filas por sede y difieren.

begin;

update public.products p
set stock = s.total,
    updated_at = now()
from (
  select product_id, sum(stock) as total
  from public.branch_stock
  group by product_id
) s
where p.id = s.product_id
  and p.stock is distinct from s.total;

commit;
