-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · Repara el stock global de productos existentes.
-- Los productos creados antes del fix en Inventory.jsx nacieron con
-- products.stock = 0 mientras branch_stock sí tinha el stock real;
-- el pull posterior pisaba el stock local a 0 y las ventas fallaban
-- con "Stock insuficiente". Deja products.stock = suma de sus sedes,
-- SOLO donde difieren y SOLO en productos con filas por sede.
-- Idempotente: si ya coincide, no hace nada.
-- Aplicar con:  npx supabase db push
-- ─────────────────────────────────────────────────────────────

UPDATE public.products p
SET stock = s.total, updated_at = now()
FROM (
  SELECT product_id, SUM(stock) AS total
  FROM public.branch_stock
  GROUP BY product_id
) s
WHERE p.id = s.product_id
  AND p.stock IS DISTINCT FROM s.total;
