# Validación PostgreSQL: presentaciones configurables

La migración `supabase/migrations/20261026000000_configurable_presentations.sql` fue verificada con `npx supabase db push --dry-run` y aplicada exitosamente en Supabase mediante `npx supabase db push`.

## Verificación aislada sobre esquema de referencia

Se ejecutó la migración en PostgreSQL 18.6 embebido (PGlite 0.5.12) sobre una base temporal sin datos reales. El esquema de referencia se reconstruyó a partir de las migraciones versionadas y de las columnas usadas por el cliente y los RPC; **no es una copia del esquema desplegado**. Resultado: 7/7 comprobaciones superadas.

1. Backfill de `business_id` y `subtotal`, conservación del historial y segunda aplicación idempotente.
2. Aborto y rollback ante líneas huérfanas, ventas sin negocio o negocio discrepante.
3. Venta base y por presentación configurable, con persistencia de ID, nombre, factor, precio, subtotal y stock.
4. Reintento con el mismo ID sin duplicar la venta ni descontar stock dos veces.
5. Rollback completo ante stock global o de sucursal insuficiente.
6. Reglas de negocio, cajero sin permiso `cobrar`, sucursal ajena, usuario suspendido, producto ajeno y almacén.
7. Validación de factor/precio contra la presentación guardada, unicidad de ID y conciliación de pago mixto.

Limitaciones: PGlite usa una sola conexión, por lo que no demuestra concurrencia real entre transacciones; la fidelidad del fixture depende de definiciones base no versionadas; y la aplicación remota se confirmó por el historial de migraciones, no por una inspección del esquema desplegado.

## Verificaciones incluidas en la migración

1. Backfill de `sale_items.business_id` desde `sales.business_id` usando `sale_items.sale_id = sales.id` únicamente cuando `item.business_id is null`.
2. Comprobaciones transaccionales que abortan ante líneas huérfanas, ventas sin negocio o discrepancias entre el negocio de la línea y el de su venta padre antes de imponer `NOT NULL` y la FK `sale_items_business_id_businesses_fkey`.
3. Normalización y validación de `products.presentations` como arreglo JSON con default `'[]'::jsonb` y `NOT NULL`.
4. Persistencia de `presentation_id`, `presentation`, `presentation_factor`, `variant` y `subtotal` en `public.sale_items`.
5. Función `public.registrar_venta_presentaciones` con lock transaccional por `p_client_generated_id`, validación de pertenencia al negocio, permisos de cajero y sucursal, unicidad de `presentation_id`, descuento atómico de stock global y por sucursal, y triggers `prevent_negative_stock`.

