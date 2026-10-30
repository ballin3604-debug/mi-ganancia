-- Alertas de pagos fijos en Inicio.
-- El egreso sigue siendo el registro del pago; estas columnas solo guardan
-- cuándo y con cuánta anticipación se quiere recordar en el Inicio.
alter table public.expenses
  add column if not exists alert_enabled boolean not null default false,
  add column if not exists alert_date date,
  add column if not exists alert_days_before integer not null default 3;

create index if not exists expenses_alert_idx
  on public.expenses (business_id, alert_date)
  where alert_enabled;
