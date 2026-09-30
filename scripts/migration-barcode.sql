-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · Migración: código de barras en productos
-- Ejecutar UNA vez en Supabase Dashboard → SQL Editor → Run
-- Fecha: 2026-09-23
-- ─────────────────────────────────────────────────────────────

-- 1. Agregar columna barcode (idempotente)
alter table products
  add column if not exists barcode text;

-- 2. Índice para búsqueda rápida por código dentro de cada negocio
create index if not exists products_business_barcode_idx
  on products (business_id, barcode);

-- 3. Verificación (debe mostrar la columna barcode)
-- select column_name, data_type from information_schema.columns
-- where table_name = 'products' and column_name = 'barcode';
