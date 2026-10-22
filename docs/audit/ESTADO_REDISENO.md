# Estado del rediseño visual

Actualizado: 2026-10-21

## Resumen

| Fase | Alcance | Implementación | Validación visual | Validación funcional |
| --- | --- | --- | --- | --- |
| F1 | Login y onboarding | Completada | Completada | Pendiente de credenciales |
| F2 | Sistema visual y componentes base | Completada | Completada | Build validado |
| F3 | Shell, navegación y responsive | Completada | Completada | Build validado |
| F4 | Inicio dueño y cajero | Completada | Completada con mock | **Pendiente de datos** |
| F5 | Ventas y compras | Completada | Completada con harness | **Pendiente de datos** |
| F6 | Reportes | Completada | Completada con harness | **Pendiente de datos** |
| F7 | Inventario y administración | Pendiente | Pendiente | Pendiente de datos |
| F8 | Pantallas transversales | Pendiente | Pendiente | Pendiente de datos |

## F4: Inicio

**Estado:** IMPLEMENTACIÓN VISUAL COMPLETADA — VALIDACIÓN FUNCIONAL PENDIENTE.

- Se rediseñaron la cabecera, las métricas, las tarjetas de productos y vencimientos, el pulso del negocio, los gráficos y el inicio del cajero.
- Cambios acotados a presentación: no se modificaron servicios, cálculos, consultas, sincronización ni permisos.
- El build de producción se ensayó en un directorio temporal con Vite y `scripts/build-sw.js`. Los artefactos coincidieron con `dist` y el service worker generado quedó intacto.
- No se detectaron errores de consola en las capturas realizadas con harness.
- Las capturas `before/after` de `docs/audit/f4/` son simuladas con datos controlados; no sustituyen una prueba contra la base real.
- El login sí se capturó contra la aplicación real en 1440×900, 834×1112 y 390×844 (`docs/audit/f4/real/`), sin errores de configuración, overflow ni fallos de consola.
- La validación autenticada del inicio quedó pendiente porque no hay credenciales E2E ni sesión persistida. No se crearon cuentas ni datos de prueba.

## F5: Ventas y compras

**Estado:** IMPLEMENTACIÓN VISUAL COMPLETADA — VALIDACIÓN FUNCIONAL PENDIENTE.

- Se rediseñaron la venta, el carrito, los métodos de pago, los modales de cobro/QR/scanner, la búsqueda y las tarjetas de producto, el reporte de ventas y el reporte por cajero.
- Compras y el formulario de compra se alinearon al sistema visual, incluidos el historial móvil, las métricas del período, los selectores de sede/presentación y los estados vacíos.
- Se actualizaron `ReportHeader`, `MetricCard`, `BranchSelect`, `ProductCatalogCard`, `ProductListRow`, `BarcodeScanner`, `PresentationPicker`, `AuditSalesList` y `AuditPurchasesList`.
- Los cambios fueron exclusivamente de presentación; no se tocaron servicios, cálculos, cobros, stock, sincronización ni permisos.
- El build de producción se validó en un directorio temporal: 2492 módulos, sin errores. Las 47 variables de `tokens.generated.css` coinciden con `tokens.js`.
- Se generaron 9 capturas con harness en `docs/audit/f5/` para desktop, tablet y mobile. No se detectaron desbordes horizontales ni errores de consola.
- Se corrigieron la alineación del selector de sede y la legibilidad de las métricas en mobile detectadas durante la revisión de capturas.
- Las capturas usan datos simulados; la validación autenticada y con datos reales sigue pendiente.

## F6: Reportes

**Estado:** IMPLEMENTACIÓN VISUAL COMPLETADA — VALIDACIÓN FUNCIONAL PENDIENTE.

- Se rediseñaron los cinco reportes de `MatrixReport`: ganancias diarias, egresos, inventario, ranking de productos y costo de lo vendido.
- Se unificaron las cabeceras, métricas, desglose de categorías, tablas desktop, listas móviles, estados vacíos, paginación y acciones de exportación con el sistema visual.
- Se rediseñaron los modales de kardex y detalle diario, con iconografía consistente, foco visible, cierre accesible y layouts adaptables.
- `DataTable` mejoró su paginación responsive y sus etiquetas accesibles; `QuickDateRangeButtons` expone el rango activo con `aria-pressed`.
- La exportación PDF usa la paleta de marca, tipografía Inter y encabezado sin emojis; se conservaron los datos, columnas, totales y el flujo de impresión.
- Los cambios fueron exclusivamente de presentación; no se modificaron cálculos, consultas, permisos, stock, sincronización ni servicios.
- El build de producción se validó en un directorio temporal: 2492 módulos, sin errores; 95.77 kB CSS y 1.68 MB JS. Las 47 variables de `tokens.generated.css` coinciden con `tokens.js`.
- Se generaron 22 capturas con harness en `docs/audit/f6/` para desktop, tablet y mobile, incluidos kardex, detalle diario y vista previa del PDF. No se detectaron desbordes horizontales ni errores de consola.
- Se corrigieron el truncado de gastos en la lista móvil de ganancias y el ajuste de saldos en el kardex móvil detectados durante la revisión.
- Las capturas usan datos simulados; la validación autenticada, con datos reales y con impresión PDF física sigue pendiente.

## Evidencia

- `docs/audit/baseline/`: capturas iniciales.
- `docs/audit/f1/`: login y onboarding.
- `docs/audit/f2/`: componentes, estados y modal.
- `docs/audit/f3/`: shell, navegación y responsive.
- `docs/audit/f4/before/` y `docs/audit/f4/after/`: comparativas simuladas.
- `docs/audit/f4/real/`: login real en tres viewports.
- `docs/audit/f5/`: venta, carrito y reporte en desktop, tablet y mobile con harness.
- `docs/audit/f6/`: reportes, modales y vista previa PDF en desktop, tablet y mobile con harness.

## Próximos lotes

- F7: Inventario, ajustes, equipo, sucursales, egresos y administración.
- F8: login, onboarding, recibos, estados de carga, alertas, modales y consistencia final.

La validación funcional con datos reales se completará cuando exista una sesión autorizada. Hasta entonces se distingue explícitamente de la validación visual y de build.
