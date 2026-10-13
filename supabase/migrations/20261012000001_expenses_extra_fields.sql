-- Mejora Egresos según Inicio7: método de pago, comprobante y notas.
-- Solo agrega columnas, no toca datos existentes.
alter table public.expenses
  add column if not exists payment_method text default 'efectivo' not null,
  add column if not exists invoice_number text default '' not null,
  add column if not exists notes text default '' not null;
