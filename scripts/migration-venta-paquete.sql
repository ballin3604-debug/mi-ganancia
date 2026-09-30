-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · Migración: venta por paquete (chipa/caja) frío/caliente
-- Ejecutar UNA vez en Supabase Dashboard → SQL Editor → Run
-- Incluye la columna barcode por si la migración anterior no se corrió.
-- ─────────────────────────────────────────────────────────────

-- 1. barcode (migración anterior, idempotente)
alter table products
  add column if not exists barcode text;
create index if not exists products_business_barcode_idx
  on products (business_id, barcode);

-- 2. Presentaciones de venta en productos
alter table products
  add column if not exists unit_label text,
  add column if not exists pack_label text,
  add column if not exists pack_price numeric,
  add column if not exists pack_price_hot numeric;

-- 3. Presentación en cada ítem de venta (para recibos y reportes)
alter table sale_items
  add column if not exists presentation text,
  add column if not exists presentation_factor numeric default 1,
  add column if not exists variant text;

-- 4. Verificación (debe listar las columnas nuevas)
-- select column_name from information_schema.columns
-- where table_name in ('products', 'sale_items')
-- and column_name in ('barcode','unit_label','pack_label','pack_price',
--   'pack_price_hot','presentation','presentation_factor','variant');
