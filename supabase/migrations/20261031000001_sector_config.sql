-- Preferencias por rubro guardadas por el dueño.
-- Restaurante: mostrar u ocultar el stock en las pantallas de trabajo.
alter table public.business_settings
  add column if not exists sector_config jsonb not null default '{}'::jsonb;
