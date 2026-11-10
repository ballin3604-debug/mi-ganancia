-- Fecha de vencimiento editable directamente en la ficha del producto.
-- Complementa las fechas que ya viven en cada compra (replenishments):
-- el aviso usa la más próxima entre ambas.
alter table public.products
  add column if not exists expiry_date date;
