-- Agencia de licorería: datos comerciales del cliente.
-- La tabla clientes solo guardaba nombre, NIT y teléfono. La dirección y el
-- cumpleaños se capturaban en pantalla pero se perdían al sincronizar.

alter table public.clientes
  add column if not exists address text,
  add column if not exists birthday date,
  add column if not exists notes text,
  add column if not exists credit_limit numeric(12, 2);

comment on column public.clientes.credit_limit is 'Límite de crédito del cliente para ventas al fiado (0 o null = sin límite).';
