-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · Índices para el sync incremental.
-- El cliente ahora baja SOLO lo que cambió (products/branch_stock por
-- updated_at; ventas por created_at) en vez de traer la tabla entera cada
-- ciclo. Estos índices hacen que esas consultas no escaneen todo. Son
-- aditivos: si no se corren, el sync funciona igual (solo más lento).
-- Aplicar con:  npx supabase db push   (o pegar en SQL Editor)
-- ─────────────────────────────────────────────────────────────

create index if not exists products_business_updated_idx
  on public.products (business_id, updated_at);

create index if not exists sales_business_created_idx
  on public.sales (business_id, created_at);

create index if not exists clientes_business_idx
  on public.clientes (business_id);

create index if not exists expenses_business_idx
  on public.expenses (business_id);

-- Tablas opcionales (Fase 2 / legado): solo si existen.
do $$
begin
  if to_regclass('public.branch_stock') is not null then
    execute 'create index if not exists branch_stock_business_updated_idx on public.branch_stock (business_id, updated_at)';
  end if;
  if to_regclass('public.debts') is not null then
    execute 'create index if not exists debts_business_idx on public.debts (business_id)';
  end if;
  if to_regclass('public.replenishments') is not null then
    execute 'create index if not exists replenishments_business_idx on public.replenishments (business_id)';
  end if;
  if to_regclass('public.transfers') is not null then
    execute 'create index if not exists transfers_business_created_idx on public.transfers (business_id, created_at desc)';
  end if;
end $$;
