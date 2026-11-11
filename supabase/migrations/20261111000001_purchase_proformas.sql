-- Proformas de compra: agrupa varias líneas de reposición bajo una cabecera
-- común (número, proveedor, fecha, sede) y guarda lote/vencimiento por línea.
-- Los gastos extra se prorratean en cada línea para que el total de la
-- proforma coincida con la suma de los total_cost de replenishments.
alter table public.replenishments
  add column if not exists proforma_id uuid,
  add column if not exists proforma_number text,
  add column if not exists proforma_date date,
  add column if not exists proforma_doc_type text,
  add column if not exists proforma_notes text,
  add column if not exists proforma_extra_costs jsonb default '[]'::jsonb,
  add column if not exists proforma_extra_total numeric default 0,
  add column if not exists lot_code text,
  add column if not exists line_number integer,
  add column if not exists presentation_name text,
  add column if not exists branch_id uuid,
  add column if not exists branch_name text;

create index if not exists replenishments_proforma_idx
  on public.replenishments (business_id, proforma_id);
