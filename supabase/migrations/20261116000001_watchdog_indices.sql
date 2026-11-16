-- ─────────────────────────────────────────────────────────────
-- Mi Ganancia · Índices de apoyo para el Vigía.
-- La salud global cuenta ventas de las últimas 24 h sin filtrar por negocio;
-- sin este índice esa consulta recorre toda la tabla cada 45 s. El índice de
-- retención acelera la limpieza de sondas viejas.
-- Aplicar con: npx supabase db push
-- ─────────────────────────────────────────────────────────────

create index if not exists sales_created_at_idx
  on public.sales (created_at desc);

create index if not exists health_probes_created_at_idx
  on public.health_probes (created_at);
