# Evaluación de pruebas E2E offline→online con Playwright

## Estado actual

- El proyecto solo tiene `playwright-core` instalado (`v1.64.1`).
- No hay `@playwright/test`, ni navegadores descargados, ni configuración de Playwright.
- No existe un entorno de prueba aislado de Supabase ni credenciales de test.

## Viabilidad

**No es viable implementar una prueba E2E real de offline→online en esta fase** sin antes montar infraestructura adicional. Las razones son:

1. **Autenticación**: la aplicación requiere iniciar sesión con Supabase Auth. Una prueba E2E necesitaría:
   - Un proyecto de Supabase de prueba, o
   - Un mock del endpoint de auth, o
   - Un usuario/credencial de test (que no debe ser real ni de producción).

2. **Datos de prueba**: registrar una venta requiere productos, negocio y usuario. Una prueba real necesitaría seed de datos en el entorno aislado.

3. **Simulación de red**: Playwright puede cortar la red (`page.context().setOffline(true)`), pero la app usa `navigator.onLine`, eventos `online`/`offline` y pings a Supabase. Hay que asegurar que todos los puntos de red se intercepten correctamente.

4. **Service Worker**: la PWA registra `sw.js`. En un navegador controlado por Playwright, el SW puede activarse y generar sincronización real con Supabase si no se intercepta todo.

5. **Base de datos real**: la restricción es no generar ventas de prueba en la base de datos real. Sin entorno aislado, cualquier E2E conectado a Supabase violaría esta regla.

## Requisitos para una prueba E2E aislada (futura)

- `npm install -D @playwright/test` y descargar navegadores (`npx playwright install`).
- Proyecto de Supabase de staging con:
  - Un negocio de prueba.
  - Un usuario de prueba.
  - Productos de prueba.
- Configurar `.env.test` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` del staging.
- Interceptar o deshabilitar el service worker durante la prueba, o usar un build de test sin SW.
- Limpiar la base de datos antes/después de cada ejecución.

## Plan de la prueba E2E cuando sea viable

```
1. Navegar a la app con credenciales de test.
2. Iniciar sesión y seleccionar el negocio de prueba.
3. Cortar la red (setOffline(true) + interceptar fetch).
4. Registrar una venta con productos de prueba.
5. Verificar que la venta aparece con estado "Local".
6. Verificar que existe una operación pendiente en IndexedDB.
7. Restaurar la red.
8. Disparar el evento online o esperar al polling.
9. Verificar que el estado cambia a "Confirmado" solo después de una respuesta 2xx del servidor.
10. Verificar en Supabase staging que la venta existe y no hay duplicados.
```

## Decisión de esta fase

No se agrega Playwright ni se ejecutan pruebas E2E. Se cubre el comportamiento offline→online con pruebas unitarias e integración usando mocks de Supabase y `fake-indexeddb`, que demuestran la lógica sin riesgo de datos reales.

## Riesgos que quedan

- Los mocks asumen que el servidor responde como `registrar_venta` y `sales` están diseñados. Un cambio en el RPC o en las políticas RLS puede romper la sincronización real aunque los tests pasen.
- No se ha verificado el flujo completo en un navegador real contra un backend aislado.
- Background Sync en Android depende del sistema operativo y no está garantizado.
