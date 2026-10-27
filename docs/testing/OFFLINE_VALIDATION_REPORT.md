# Informe de validación offline → online de Mi Ganancia

**Fecha:** 2026-10-25
**Objetivo:** Verificar el flujo offline-first en condiciones reales sin poner en riesgo datos de producción.
**Restricciones aplicadas:** no deploy, no commit, no push, no cambios al esquema remoto, no ventas de prueba en producción, no exposición de secretos.

## 1. Inspección del código y artefactos

### APK existente
- **Archivo:** `release/MiGanancia-1.0.0-signed.apk`
- **Tamaño:** 1 022 746 bytes
- **Fecha de modificación:** 2026-10-25 14:18:47
- **Conclusión:** el APK fue generado **antes** de los cambios offline-first actuales (que están sin commitear). **No contiene** los nuevos estados `sync_status`, el outbox mejorado ni Background Sync. No debe usarse para validar esta fase.

### Configuración Android/TWA
- `source/app/build.gradle` apunta a `tugananciaa.web.app`.
- Es un Trusted Web Activity que carga la PWA alojada en Firebase Hosting.
- `source/app/src/main/AndroidManifest.xml` contiene la corrección `androidx.browser.trusted` aplicada en la fase anterior.

### Dispositivos/emuladores disponibles
- `adb` no está instalado ni en PATH.
- No se detectó Android SDK, emulador ni dispositivo físico conectado.
- **Conclusión:** no es posible instalar ni probar la app en Android desde este entorno.

### Entorno de Supabase aislado
- No existe un proyecto de staging/documentado en el repositorio.
- El `.env` contiene credenciales de producción (no inspeccionadas ni expuestas).
- **Conclusión:** no hay entorno seguro donde registrar ventas de prueba.

## 2. Lista de comprobación y resultados

| # | Caso | Entorno esperado | Resultado | Evidencia | Riesgo / bloqueo | Próxima acción |
|---|------|------------------|-----------|-----------|------------------|----------------|
| 1 | Abrir la app con internet y acceder con usuario de prueba | Dispositivo Android real o emulador + Supabase staging | **Bloqueado** | APK desactualizado; sin adb/SDK ni entorno de test | No se puede confirmar que el usuario de prueba acceda en la versión offline-first | Reconstruir APK con el código actual y contar con un dispositivo/emulador + usuario de staging. |
| 2 | Desconectar internet | Dispositivo Android real o emulador | **Bloqueado** | Sin adb/SDK ni dispositivo | No se validó el cambio de `navigator.onLine` ni el ping a Supabase en hardware real | Repetir con un dispositivo físico o emulador disponible. |
| 3 | Registrar una venta de prueba | Dispositivo Android + Supabase staging | **No ejecutado** | Sin entorno aislado | Riesgo de crear ventas en producción | Crear proyecto de Supabase de staging con negocio/usuario/productos de prueba. |
| 4 | Verificar venta + ítems en IndexedDB | Navegador real o inspector del dispositivo | **No ejecutado** | Sin dispositivo/emulador | No se confirmó persistencia local en IndexedDB real | Usar Chrome DevTools en el dispositivo o emulador para inspeccionar `MiGananciaDB`. |
| 5 | Verificar operación pendiente en outbox | Navegador real o inspector | **No ejecutado** | Sin dispositivo/emulador | No se confirmó que `pending_operations` se cree con `status: 'pending'` en un entorno real | Inspeccionar tabla `pending_operations` tras registrar venta offline. |
| 6 | Cerrar y volver a abrir la app sin borrar datos | Dispositivo Android | **No ejecutado** | Sin dispositivo/emulador | No se verificó que Dexie/IndexedDB sobreviva al ciclo de vida de la TWA | Ejecutar en dispositivo real y verificar que la cola persiste. |
| 7 | Confirmar que la operación pendiente sigue existiendo | Dispositivo Android | **No ejecutado** | Sin dispositivo/emulador | Riesgo de pérdida de outbox al cerrar la app | Repetir caso 6 y verificar `pending_operations`. |
| 8 | Restablecer internet | Dispositivo Android | **No ejecutado** | Sin dispositivo/emulador | No se validó el evento `online` real ni el polling de 30 s | Probar con modo avión y recuperación de red en dispositivo real. |
| 9 | Confirmar sincronización y estado "Confirmado" | Dispositivo Android + Supabase staging | **No ejecutado** | Sin entorno aislado ni dispositivo | No se validó que `sync_status` cambie a `confirmed` tras respuesta 2xx real | Ejecutar en staging y verificar tanto UI como tabla `sales` remota. |
| 10 | Comprobar que no hay duplicados ni stock doblemente decrementado | Supabase staging + dispositivo | **No ejecutado** | Sin entorno aislado ni dispositivo | Riesgo de duplicación si la idempotencia por `client_generated_id` falla en producción | Crear escenario de respuesta perdida en staging y verificar que `registrar_venta` no se invoca dos veces. |
| 11 | Desconexión durante el envío | Dispositivo Android + Supabase staging | **No ejecutado** | Sin entorno aislado ni dispositivo | Riesgo de estado inconsistente si el servidor ya creó la venta pero el cliente no lo sabe | Simular timeout en staging y verificar reintento con idempotencia. |

## 3. Cobertura alcanzada con mocks

Los siguientes escenarios **sí se validaron** con tests automatizados (no reemplazan la validación real, pero demuestran la lógica):

- Venta + ítems + operación pendiente en la misma transacción Dexie.
- Operación pendiente tras fallo de red.
- Reintento respetando backoff exponencial.
- No duplicación cuando el servidor crea la venta pero la respuesta se pierde.
- Estado `confirmed` solo tras respuesta exitosa del servidor.
- Errores permanentes (`23505`) pasan a estado `error` sin reintentos infinitos.
- Recuperación de la cola tras cerrar y reabrir IndexedDB.
- Concurrencia: `triggerSync` concurrente no procesa la operación dos veces.
- Evento `online` del navegador dispara sincronización.

**Resultado de tests:** `npm test` → 25/25 pasan.
**Resultado de build:** `npm run build` → exitoso.

## 4. Diagnóstico global

- **No se ejecutó ninguna prueba real en dispositivo Android ni contra un entorno aislado de Supabase.**
- La validación queda **bloqueada** por falta de:
  1. Dispositivo Android físico o emulador configurado.
  2. Android SDK / `adb` instalado en el entorno de trabajo.
  3. Proyecto de Supabase de staging con datos de prueba.
  4. APK actualizado que incluya los cambios offline-first.

## 5. Recomendaciones para validar en una siguiente sesión

1. **Crear entorno de staging:**
   - Nuevo proyecto de Supabase.
   - Aplicar las mismas migraciones que en `supabase/migrations/`.
   - Crear un negocio de prueba, un usuario de prueba y productos de prueba.
   - Configurar `.env.staging` con URL y anon key de staging (sin commitear).

2. **Preparar el dispositivo/emulador:**
   - Instalar Android Studio o las herramientas de línea de comandos.
   - Configurar `adb` y un emulador o conectar un dispositivo físico.
   - Reconstruir el APK con el código actual (sin firmar para debug es suficiente).
   - Instalar el APK con `adb install`.

3. **Ejecutar la lista de comprobación:**
   - Usar Chrome DevTools remoto para inspeccionar IndexedDB.
   - Alternar modo avión para simular desconexión.
   - Verificar en la consola del SW y de la app el estado del sync.
   - Revisar la tabla `sales` de staging tras cada sincronización.

4. **No usar producción:**
   - Nunca usar las credenciales de `.env` para pruebas.
   - Nunca registrar ventas de prueba en el negocio real.

## 6. Archivos modificados en esta fase

- `docs/testing/OFFLINE_VALIDATION_REPORT.md` (nuevo).

No se realizaron cambios de código productivo, no se tocó `.env`, no se desplegó, no se hizo commit ni push.
