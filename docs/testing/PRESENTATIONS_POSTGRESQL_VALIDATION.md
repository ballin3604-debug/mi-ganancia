# Validación PostgreSQL: presentaciones configurables

La migración `supabase/migrations/20261026000000_configurable_presentations.sql` fue verificada con `npx supabase db push --dry-run` y aplicada exitosamente en Supabase mediante `npx supabase db push`.

## Verificaciones incluidas en la migración

1. Backfill de `sale_items.business_id` desde `sales.business_id` usando `sale_items.sale_id = sales.id` únicamente cuando `item.business_id is null`.
2. Comprobaciones transaccionales que abortan ante líneas huérfanas, ventas sin negocio o discrepancias entre el negocio de la línea y el de su venta padre antes de imponer `NOT NULL` y la FK `sale_items_business_id_businesses_fkey`.
3. Normalización y validación de `products.presentations` como arreglo JSON con default `'[]'::jsonb` y `NOT NULL`.
4. Persistencia de `presentation_id`, `presentation`, `presentation_factor`, `variant` y `subtotal` en `public.sale_items`.
5. Función `public.registrar_venta_presentaciones` con lock transaccional por `p_client_generated_id`, validación de pertenencia al negocio, permisos de cajero y sucursal, unicidad de `presentation_id`, descuento atómico de stock global y por sucursal, y triggers `prevent_negative_stock`.

