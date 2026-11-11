-- Turnos fijos del personal y su vínculo con la caja.
-- Cada miembro puede tener un horario (entrada, salida y días laborables).
-- La app solo permite abrir la caja mientras el turno del cajero está vigente.
begin;

alter table public.profiles
  add column if not exists shift_label text,
  add column if not exists shift_start time,
  add column if not exists shift_end time,
  add column if not exists shift_days jsonb;

alter table public.profiles drop constraint if exists profiles_shift_complete_check;
alter table public.profiles add constraint profiles_shift_complete_check check (
  (shift_start is null and shift_end is null and shift_days is null)
  or (
    shift_start is not null
    and shift_end is not null
    and shift_start <> shift_end
    and shift_days is not null
    and jsonb_typeof(shift_days) = 'array'
    and jsonb_array_length(shift_days) between 1 and 7
    and shift_days <@ '[1,2,3,4,5,6,7]'::jsonb
  )
);

alter table public.cash_sessions
  add column if not exists shift_label text,
  add column if not exists shift_start time,
  add column if not exists shift_end time;

alter table public.cash_arqueos
  add column if not exists shift_label text,
  add column if not exists shift_start time,
  add column if not exists shift_end time;

comment on column public.profiles.shift_label is 'Nombre del turno asignado (Mañana, Tarde, Noche o personalizado).';
comment on column public.profiles.shift_start is 'Hora de entrada del turno fijo del miembro.';
comment on column public.profiles.shift_end is 'Hora de salida del turno fijo del miembro.';
comment on column public.profiles.shift_days is 'Días laborables ISO: 1=lunes … 7=domingo.';

commit;
