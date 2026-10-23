# Estado del rediseño visual

Actualizado: 2026-10-23

## Resumen

| Fase | Alcance | Implementación | Validación visual | Validación funcional |
| --- | --- | --- | --- | --- |
| F1 | Login y onboarding | Completada | Completada | Pendiente de credenciales |
| F2 | Sistema visual y componentes base | Completada | Completada | Build validado |
| F3 | Shell, navegación y responsive | Completada | Completada | Build validado |
| F4 | Inicio dueño y cajero | Completada | Completada con mock | **Pendiente de datos** |
| F5 | Ventas y compras | Completada | Completada con harness | **Pendiente de datos** |
| F6 | Reportes | Completada | Completada con harness | **Pendiente de datos** |
| F7 | Inventario y administración | Completada | Completada con harness | **Pendiente de datos** |
| F8 | Pantallas transversales | Completada | Completada con harness | **Pendiente de datos** |
| F9 | Limpieza técnica | Completada | No aplica | Build y referencias validados |
| F10 | PWA, Android TWA y marca | Completada en web y recursos | Revisión de recursos y runtime PWA | **Compilación Android bloqueada** |

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

## F7: Inventario y administración

**Estado:** IMPLEMENTACIÓN VISUAL COMPLETADA — VALIDACIÓN FUNCIONAL PENDIENTE.

- Se rediseñaron egresos (métricas, filtros, listado, alta y detalle), equipo y accesos, sucursales y almacenes, ajustes, inventario, panel de administración y mejora de plan.
- Se reemplazaron colores sueltos por tokens de marca, se incorporaron `PageHeader`, `MetricCard`, `SectionCard`, `EmptyState` y `AppIcon`, y se corrigieron contrastes, badges, toggles y estados vacíos.
- Los modales de pago, egresos, equipo, ajustes, catálogo y administración exponen `role="dialog"`, `aria-modal`, nombres accesibles, cierre por teclado y controles etiquetados.
- En equipo se compactó la tabla móvil: rol y estado pasan debajo del colaborador y las acciones se ajustan al ancho disponible, sin desplazamiento horizontal oculto.
- En inventario se fijó la cabecera responsive para tablet, se tokenizaron categorías, filtros, avisos de escaneo y acciones de riesgo, y se eliminaron degradados ajenos a la paleta.
- En sucursales se eliminó el botón duplicado de alta y se unificaron las métricas con `MetricCard`; en administración se sustituyeron el degradado índigo, los emojis decorativos y los colores hardcoded por la identidad de marca.
- Los cambios fueron exclusivamente de presentación; no se modificaron servicios, contextos, cálculos, cobros, stock, permisos, sincronización ni datos.
- El build de producción se validó en un directorio temporal: 2493 módulos, sin errores; 92.64 kB CSS y 1,675.56 kB JS. Las 47 variables de `tokens.generated.css` coinciden con `tokens.js`.
- Se generaron 24 capturas con harness en `docs/audit/f7/` para desktop, tablet y mobile, incluidos el modal de egreso, inventario y administración. No se detectaron desbordes horizontales ni errores de consola.
- Se corrigieron el desborde de la cabecera de inventario en tablet y el corte de acciones del equipo en mobile detectados durante la revisión.
- Las capturas usan datos simulados; la validación autenticada y con datos reales sigue pendiente.

## F8: Pantallas transversales

**Estado:** IMPLEMENTACIÓN VISUAL COMPLETADA — VALIDACIÓN FUNCIONAL PENDIENTE.

- Se rediseñaron el login, el onboarding, el recibo en pantalla, las plantillas de impresión térmica y hoja, el splash, la carga inicial, la cola de sincronización, el error de configuración y el aviso de actualización PWA.
- Se reemplazaron emojis decorativos por `AppIcon` y se tokenizaron fondos, alertas, estados, botones, enlaces y controles; se conservaron los logos y la identidad de marca.
- El onboarding usa iconos reales, progreso accesible y una tarjeta de ejemplo; mantiene los cuatro pasos, el guardado en `localStorage` y el flujo original.
- En el login se mejoraron el contraste, los estados de error y éxito, la visibilidad de la contraseña, el control segmentado y el soporte para teclado y lectores de pantalla.
- El recibo en pantalla usa la acción azul de marca y una hoja monoespaciada consistente; la plantilla en hoja adoptó la nueva paleta petróleo/azul/esmeralda, eliminó emojis y conserva datos, cálculos, columnas, firmas y la impresión automática.
- El panel de sincronización expone `role="dialog"`, `aria-modal`, título accesible, cierre con Escape, botones de 44 px y estados con iconos; la lista se desplaza correctamente en mobile.
- Los cambios fueron exclusivamente de presentación; no se modificaron autenticación, cálculos, ventas, stock, sincronización, impresión ni servicios.
- El build de producción se validó en un directorio temporal: 2493 módulos, sin errores; 92.42 kB CSS y 1,681.58 kB JS. Las 47 variables de `tokens.generated.css` coinciden con `tokens.js`.
- Se generaron 24 capturas con harness en `docs/audit/f8/` para desktop, tablet y mobile, incluidos error de login, dos pasos del onboarding, splash, carga, recibo y sincronización, más la vista previa del recibo en hoja. No se detectaron desbordes horizontales ni errores de consola.
- Las capturas usan datos simulados; la validación autenticada, con datos reales y con impresión física sigue pendiente.

## F9: Limpieza técnica

**Estado:** COMPLETADA.

- Se retiró la dependencia `qrcode`, sin referencias en `src`, `scripts`, `dev`, configuración ni build; también se retiraron sus 29 paquetes transitivos del lockfile.
- Se eliminaron imports sin uso en componentes y páginas activas, incluidos `React` innecesario con el runtime automático, hooks no utilizados y `TransferModal` en Inventario.
- Se eliminaron utilidades CSS sin referencias (`mg-surface`, `mg-surface-bordered`, `mg-badge`, `mg-hover-lift`, `mg-tappable`) sin tocar estilos en uso.
- Se conservaron los harnesses y scripts de auditoría, los componentes de funciones no montadas y los recursos de marca; no se eliminaron `SaleDetailModal`, `LowStockAlert`, `BranchSelect` ni archivos de Android.
- Se detectaron imports no usados en `src/services/**`; se dejaron intactos para no modificar archivos de negocio.
- El build final de F9 pasó con 2493 módulos, 92.39 kB CSS y 1,681.58 kB JS; las 47 variables de tokens coinciden y `dist` no contiene harnesses ni mocks de desarrollo.

## F10: PWA, Android TWA y recursos de marca

**Estado:** IMPLEMENTACIÓN WEB COMPLETADA — COMPILACIÓN ANDROID BLOQUEADA.

- Se actualizó `public/manifest.json` con `scope`, idioma, fondo `#F4F6FA`, tema `#153449` e iconos `maskable` separados de 192 y 512 px.
- Se regeneraron `apple-touch-icon.png` y los nuevos iconos maskable a partir del logo oficial, con margen seguro y sin transparencias incorrectas.
- Se actualizaron los iconos legacy y adaptativos de Android, el icono de notificación monocromático, las imágenes de splash y `store_icon.png` con la marca actual.
- Se ajustaron los colores de estado, navegación y splash del TWA a la paleta de marca y se sincronizó el manifest empaquetado en `source/app/src/main/res/raw/`.
- Se verificó el manifest en runtime: los cuatro iconos responden 200 con `image/png`, el service worker queda activado y el precache contiene los 15 recursos de producción, sin harnesses.
- F9/F10 no modificaron `applicationId`, firma, keystore ni host; el host se actualizó después en F10.1.
- La compilación Android local no se ejecutó: el equipo solo tiene JRE 8 y JDK 16, el SDK instalado es Android 30/build-tools 30 y el proyecto requiere JDK 17, compileSdk 36 y Gradle 8.11.1.
- `assetlinks.json` de la raíz, `public/.well-known/assetlinks.json` y `dist/.well-known/assetlinks.json` contienen el mismo package y fingerprint; el archivo local está preparado, pero la huella no está verificada contra la firma de publicación.
- El dominio oficial es `tugananciaa.web.app`; `firebase.json` y `.firebaserc` ya apuntan al sitio/proyecto `tugananciaa`. La TWA quedó actualizada a ese host en F10.1, pendiente de compilación Android.

## Auditoría de coherencia (2026-10-23)

**Estado:** auditoría completada; sin commit, push ni deploy ejecutados por esta sesión.

- En el momento de la auditoría, el worktree contenía los cambios de F9/F10 y cambios paralelos no atribuidos a ellos; no se revirtió ni se sobrescribió ningún archivo. Posteriormente, una sesión externa los consolidó en `9588b35`.
- Los cambios paralelos (`App.jsx`, `SplashScreen.jsx`, `BrandMark.jsx`, `index.html`, `index.css` y `scripts/screenshots-f8.mjs`) aparecieron después del cierre de F10 y corresponden probablemente a una sesión o editor paralelo de rediseño del splash. No fueron modificados por esta auditoría; algunos archivos siguieron recibiendo cambios de esa sesión durante la revisión.
- Impacto de esos cambios: el splash ahora es una capa de marca sobre la app, el arranque monta la pantalla subyacente mientras espera auth, se añadió `BrandMark` vectorial y estilos/animation, y el harness F8 apunta a `.mg-splash`. El build y el smoke test local pasan; no hay validación funcional autenticada de los nuevos estados de arranque.
- Aparecieron scripts temporales no rastreados con prefijo `scripts/tmp-splash-*`; eran utilidades de prueba y ya no están en el worktree.
- `public/.well-known/assetlinks.json` pasó de placeholders a valores reales durante la revisión por una acción externa a esta auditoría. Raíz, `public` y `dist` coinciden semánticamente.
- `firebase.json` declara el sitio `tugananciaa`; `.firebaserc` usa el proyecto `tugananciaa`; la TWA usaba `tuganancia.web.app` antes de F10.1 y el package es `app.web.tuganancia.twa`.
- La producción de `tuganancia.web.app` sigue con manifest antiguo (`#ffffff`/`#007aff`) y `assetlinks` placeholder. `tugananciaa.web.app` ya sirve el manifest `#F4F6FA`/`#153449` y `assetlinks` real; ese despliegue fue externo a esta sesión.
- El package coincide en `applicationId`, namespace, `AndroidManifest.xml` y `assetlinks` local. El único fingerprint SHA-256 local (32 bytes, formato válido) coincide en raíz, `public`, `dist` y el artefacto Android generado; no se verificó contra el keystore ni Play Console porque no se accedió a ellos.
- Build de auditoría: 2495 módulos, 94.21 kB CSS, 1,682.88 kB JS, 15 recursos PWA; `tokens.generated.css` coincide (47 variables). Solo quedan warnings de `caniuse-lite` desactualizado, chunk >500 kB y conversión LF/CRLF.
- No se modificaron consultas, auth, RLS, sincronización, datos ni firma. Esta sesión no hizo commit, push, deploy ni publicación.

## F10.1: Preparación local de la asociación TWA

**Estado:** HOST LOCAL PREPARADO — COMPILACIÓN ANDROID PENDIENTE — ASOCIACIÓN NO VERIFICADA.

- Dominio oficial confirmado: `https://tugananciaa.web.app/`. `firebase.json` declara el sitio `tugananciaa`, `.firebaserc` usa el proyecto `tugananciaa` y la URL oficial responde 200.
- Se actualizó el host TWA en `source/app/build.gradle`: `hostName`, `webManifestUrl` y `fullScopeUrl` usan `tugananciaa.web.app`; `launchUrl` se corrigió a `/` en F10.2.
- Se actualizó el manifest Android empaquetado (`source/app/src/main/res/raw/web_app_manifest.json`) para que `start_url` y `scope` apunten al dominio oficial.
- Se actualizó `source/app/src/main/res/values/strings.xml` (`assetStatements`) al sitio oficial.
- No se modificaron `applicationId`, namespace, versión, firma, certificados ni keystore. No se accedió al keystore.
- `firebase.json` no requirió cambios: ya publica el sitio oficial `tugananciaa`. `public/manifest.json` conserva `start_url`/`scope` relativos (`/`), que resuelven correctamente al servirse desde el dominio oficial.
- `public/.well-known/assetlinks.json` ya contenía el package `app.web.tuganancia.twa` y un fingerprint estructuralmente válido; se conservó sin sustituir valores. Raíz, `public` y `dist` coinciden semánticamente y sus JSON son válidos.
- El fingerprint existente **no está verificado contra el certificado de firma de publicación**, por lo que la asociación no se declara verificada.
- Durante F10.1, una sesión externa creó el commit `9588b35`, lo subió a `origin/main` y desplegó en `tugananciaa.web.app`; esas acciones no fueron ejecutadas por esta sesión. El sitio oficial ya sirve el manifest `#F4F6FA`/`#153449` y el `assetlinks` real, coincidente con el package/fingerprint local.
- El sitio antiguo `tuganancia.web.app` sigue con manifest y `assetlinks` placeholders; ya no es el host configurado en la TWA fuente, pero una APK instalada previamente podría seguir apuntando allí hasta recompilar/reinstalar.
- Validaciones locales: build web OK (2495 módulos, 94.21 kB CSS, 1,682.85 kB JS, 15 recursos PWA), tokens OK (47 variables), `git diff --check` solo con avisos LF/CRLF, y `/manifest.json` y `/.well-known/assetlinks.json` responden 200 en preview.
- Pendiente para verificar la TWA: compilar Android con JDK 17, SDK 36 y Gradle 8.11.1; confirmar el fingerprint contra la firma de publicación/Play Console; instalar la APK resultante y comprobar la asociación en el dispositivo.

## F10.2: Diagnóstico del entorno para validación Android

**Estado:** BLOQUEADO POR HERRAMIENTAS — SIN COMPILACIÓN — SIN FIRMA NI PUBLICACIÓN.

- Git: `HEAD` y `origin/main` en `9588b35`; solo hay cuatro archivos modificados sin commit (`docs/audit/ESTADO_REDISENO.md`, `source/app/build.gradle`, `source/app/src/main/res/raw/web_app_manifest.json` y `source/app/src/main/res/values/strings.xml`), sin archivos no rastreados. No se revirtió el commit externo ni se tocaron cambios paralelos.
- Host confirmado: `tugananciaa.web.app` en el host TWA, manifest empaquetado y `assetStatements`. `applicationId`, namespace, `versionCode 1` y `versionName 1.0.0.0` permanecen intactos; el diff de esta sesión solo contiene configuración de host/`launchUrl` y documentación.
- Se detectó y corrigió un error preexistente en `launchUrl`: era una URL absoluta, pero el template concatena `https://` + `hostName` + `launchUrl`. El artefacto anterior generaba `https://tuganancia.web.apphttps://tuganancia.web.app/`; con `launchUrl: '/'` la URL resultante es `https://tugananciaa.web.app/`. No se modificaron identificadores ni firma.
- Entorno Java: `java` en PATH es JRE 8u301, `JAVA_HOME` no está definido, hay un JDK 16 en `C:\Users\len\.jdks\openjdk-16.0.1`, Android Studio usa JRE 8u242 y el JBR de IntelliJ es 11.0.10. No se localizó un JDK 17; AGP 8.9.1 requiere JDK 17.
- SDK Android: solo `platforms/android-30` y `build-tools/30.0.3`; `platform-tools` incluye `adb`, pero no hay plataforma 36, build-tools para 36 ni `cmdline-tools`. Existe el `sdkmanager` legado en `tools/bin`. No hay `local.properties`; `ANDROID_HOME` está vacío y `source/local.properties` no está ignorado por Git.
- Gradle: el wrapper solicita 8.11.1, pero la caché local solo contiene 6.5; no hay comando global `gradle`. No se descargó ni instaló nada.
- Huella: el certificado público del AAB firmado local y del APK release local coincide con la huella de `assetlinks.json` (`6B:99:...:C1:17`). Esa comprobación se hizo con `keytool`/`apksigner` sobre los certificados públicos, sin abrir el keystore. Los artefactos existentes son del 14-abr-2026, anteriores al cambio de host, por lo que no se reutilizan para validar F10.1.
- La huella del artefacto local no confirma por sí sola la clave registrada en Play Console; si Play App Signing está activo, el certificado de publicación puede ser distinto del certificado de carga local. Esa comprobación requiere acceso a la consola o al certificado de publicación y queda pendiente.
- No se intentó compilar porque faltan JDK 17, plataforma 36, build-tools compatible y Gradle 8.11.1. Instalar o descargar esas herramientas requiere autorización.
- Para habilitar una compilación de diagnóstico sin firma: instalar JDK 17 y definir `JAVA_HOME`, instalar SDK Platform 36 y build-tools compatibles con el `sdkmanager` existente, permitir la descarga de Gradle 8.11.1, definir `ANDROID_HOME` en la sesión (evitando crear un `local.properties` no ignorado), y ejecutar `gradlew.bat :app:clean :app:assembleRelease` (salida unsigned). La validación instalable de la TWA requiere además firmar con la clave de publicación, fuera del alcance de esta tarea.
- No se abrió ni modificó `source/signingKey.keystore`; no se modificó la firma, los identificadores ni producción. No se ejecutó commit, push ni deploy.

## Evidencia

- `docs/audit/baseline/`: capturas iniciales.
- `docs/audit/f1/`: login y onboarding.
- `docs/audit/f2/`: componentes, estados y modal.
- `docs/audit/f3/`: shell, navegación y responsive.
- `docs/audit/f4/before/` y `docs/audit/f4/after/`: comparativas simuladas.
- `docs/audit/f4/real/`: login real en tres viewports.
- `docs/audit/f5/`: venta, carrito y reporte en desktop, tablet y mobile con harness.
- `docs/audit/f6/`: reportes, modales y vista previa PDF en desktop, tablet y mobile con harness.
- `docs/audit/f7/`: egresos, equipo, sucursales, ajustes, inventario y administración en desktop, tablet y mobile con harness.
- `docs/audit/f8/`: login y error, onboarding, splash, carga, recibo en pantalla, vista previa del recibo en hoja y sincronización en desktop, tablet y mobile con harness.
- `public/`: manifest, iconos PWA y apple-touch actualizados.
- `source/app/src/main/res/`: iconos Android, notificación, splash y manifest empaquetado actualizados.
- F10.1/F10.2: `source/app/build.gradle`, `source/app/src/main/res/raw/web_app_manifest.json` y `source/app/src/main/res/values/strings.xml` actualizados al dominio oficial; `launchUrl` corregido a `/`; `public/.well-known/assetlinks.json` conservado.

## Próximos pasos

- Validar los flujos con una sesión autorizada y datos reales, incluida la impresión física de ambos formatos de recibo.
- Compilar Android en un entorno con JDK 17, SDK 36 y Gradle 8.11.1.
- Verificar el fingerprint SHA-256 contra el certificado de firma de publicación o Play Console.
- Instalar la APK resultante y comprobar la asociación TWA contra `https://tugananciaa.web.app/`.

La validación funcional con datos reales se completará cuando exista una sesión autorizada. Hasta entonces se distingue explícitamente de la validación visual y de build.
