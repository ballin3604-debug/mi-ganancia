-- Campos antes inexistentes en Ajustes (segundo diseño).
-- Solo agrega columnas, no toca estilos ni datos existentes.
alter table public.business_settings
  add column if not exists legal_name text default '' not null,
  add column if not exists nit text default '' not null,
  add column if not exists city text default '' not null,
  add column if not exists address text default '' not null,
  add column if not exists footer_message text default '' not null,
  add column if not exists show_qr boolean default true not null;
