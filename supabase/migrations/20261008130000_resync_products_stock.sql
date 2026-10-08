-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · Repara products.stock partidos de branch_stock.
-- El guardado viejo escribía la sede pero encolaba el global anterior:
-- el servidor quedó con branch_stock nuevo y products.stock viejo.
-- Esta migración deja products.stock = suma de sus sedes, SOLO donde
-- difieren y SOLO en productos que tienen filas por sede.
-- Vista previa (solo lectura):
--   SELECT p.id, p.name, p.stock AS global_viejo, s.total AS suma_sedes
--   FROM public.products p
--   JOIN (SELECT product_id, SUM(stock) AS total
--         FROM public.branch_stock GROUP BY product_id) s
--     ON s.product_id = p.id
--   WHERE p.stock IS DISTINCT FROM s.total;
-- Aplicar con:  npx supabase db push   (tras `supabase link`)
-- O pegar el UPDATE en SQL Editor del dashboard.
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
