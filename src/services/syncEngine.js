import { assertSupabase, isSupabaseConfigured } from './supabaseClient';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/environment';
import { db, generateUUID } from './localDb';

function getDeviceId() {
  try {
    if (typeof localStorage === 'undefined') return null;
    let deviceId = localStorage.getItem('mg-device-id');
    if (!deviceId) {
      deviceId = generateUUID();
      localStorage.setItem('mg-device-id', deviceId);
    }
    return deviceId;
  } catch {
    return null;
  }
}

let online = navigator.onLine;
let pendingCount = 0;
let errorCount = 0;
let syncPromise = null;
let syncRequested = false;
const listeners = new Set();

// ── Cadencia del sync (antes: pull COMPLETO de todo cada 15 s, que quemaba
// el egress del plan) ────────────────────────────────────────────────
//  · Cada POLL_INTERVAL_MS se sincroniza de forma INCREMENTAL: products y
//    branch_stock por updated_at, y solo las ventas de hoy (acotadas al día).
//  · Cada FULL_SYNC_INTERVAL_MS se hace un pase COMPLETO de las tablas
//    chicas (sin updated_at) + una reconciliación de borrados por id.
const POLL_INTERVAL_MS = 30000;
const FULL_SYNC_INTERVAL_MS = 5 * 60 * 1000;
// PostgREST corta las respuestas en max-rows (típicamente 1000). Se pagina
// con .range() para no truncar catálogos grandes (antes, un producto #1001+
// no llegaba del server y la caché local lo BORRABA).
const PAGE_SIZE = 1000;

export async function checkOnlineStatus() {
  if (!navigator.onLine) return false;
  // Si el guard de entorno falló (por ejemplo, ref de staging distinto), no
  // se lee la URL ni se hace el ping: evita cualquier fuga hacia producción.
  if (!isSupabaseConfigured) return false;
  try {
    const url = SUPABASE_URL;
    const anonKey = SUPABASE_ANON_KEY;
    if (!url || !anonKey) return false;

    // Fast ping using HEAD method on a lightweight table (fully CORS enabled)
    const pingUrl = `${url}/rest/v1/products?select=id&limit=1`;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 5000) : null;
    try {
      const response = await fetch(pingUrl, {
        method: 'HEAD',
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`
        },
        cache: 'no-store',
        signal: controller ? controller.signal : undefined,
      });
      return response.ok || response.status === 200 || response.status === 206;
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch (err) {
    console.error('checkOnlineStatus: Ping failed with exception:', err);
    return false;
  }
}

// Ops sin business_id son de antes de este fix (quedan huérfanas de otro modo);
// se cuentan/procesan igual para no perderlas, pero nunca se filtra la cola de
// UN negocio con datos de otro negocio conocido.
function belongsToBusiness(op, businessId) {
  return !op.business_id || op.business_id === businessId;
}

export function attachSaleItemBusinessIds(sales, saleItems) {
  const businessBySaleId = new Map(sales.map((sale) => [sale.id, sale.business_id]));
  return saleItems.map((item) => {
    const saleBusinessId = businessBySaleId.get(item.sale_id);
    if (!saleBusinessId) {
      throw new Error('Una línea de venta sincronizada no tiene una venta padre con negocio.');
    }
    if (item.business_id && item.business_id !== saleBusinessId) {
      throw new Error('El negocio de una línea no coincide con el negocio de su venta.');
    }
    return { ...item, business_id: saleBusinessId };
  });
}

async function updatePendingCount(businessId) {
  const allOps = await db.pending_operations.toArray();
  const scoped = businessId ? allOps.filter((op) => belongsToBusiness(op, businessId)) : allOps;
  pendingCount = scoped.filter((op) => op.status === 'pending').length;
  errorCount = scoped.filter((op) => op.status === 'error').length;
  notifyListeners();
}

function notifyListeners() {
  listeners.forEach((callback) => callback({ online, pendingCount, errorCount }));
}

export function subscribeSyncStatus(callback) {
  listeners.add(callback);
  callback({ online, pendingCount, errorCount });
  return () => listeners.delete(callback);
}

// Periodically monitor connection with ping check
export async function initializeSyncEngine(businessId) {
  await updatePendingCount(businessId);

  const handleConnectivityChange = async () => {
    online = await checkOnlineStatus();
    notifyListeners();
    if (online) {
      triggerSync(businessId);
    }
  };

  window.addEventListener('online', handleConnectivityChange);
  window.addEventListener('offline', handleConnectivityChange);

  // Periodic ping interval (fallback: el sync incremental ya es barato)
  const intervalId = setInterval(async () => {
    const prevOnline = online;
    online = await checkOnlineStatus();
    if (online !== prevOnline) {
      notifyListeners();
    }
    if (online) {
      triggerSync(businessId);
    }
  }, POLL_INTERVAL_MS);

  // Al volver la app a primer plano (móvil/PC) se sincroniza de inmediato:
  // es justo cuando el usuario mira la pantalla y espera datos al día.
  const handleVisibility = () => {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
    checkOnlineStatus().then((isOn) => {
      online = isOn;
      notifyListeners();
      if (isOn) triggerSync(businessId);
    });
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibility);
  }

  // Initial check
  handleConnectivityChange();

  return () => {
    window.removeEventListener('online', handleConnectivityChange);
    window.removeEventListener('offline', handleConnectivityChange);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibility);
    }
    clearInterval(intervalId);
  };
}

// Construye el registro del outbox sin escribirlo — para que un caller con
// múltiples escrituras relacionadas (p.ej. registrar una venta: venta + items
// + stock) pueda incluirlo en su propia transacción Dexie y así o se guarda
// todo junto, o no se guarda nada. Ver refreshOutboxState/enqueueOperation.
export function buildOutboxOp(operationType, payload, businessId, { userId = null, branchId = null, origin = 'offline' } = {}) {
  return {
    id: generateUUID(),
    operation_type: operationType,
    payload,
    business_id: businessId,
    status: 'pending',
    created_at: new Date().toISOString(),
    retry_count: 0,
    last_attempt_at: null,
    created_by: userId,
    branch_id: branchId,
    device_id: getDeviceId(),
    origin,
    server_confirmed_at: null,
  };
}

// Refresca el contador visible y dispara un intento de sync — para usar
// después de agregar una op al outbox por fuera de enqueueOperation (dentro
// de una transacción propia).
export async function refreshOutboxState(businessId) {
  await updatePendingCount(businessId);
  triggerSync(businessId);
}

export async function enqueueOperation(operationType, payload, businessId, meta = {}) {
  const op = buildOutboxOp(operationType, payload, businessId, meta);
  await db.pending_operations.add(op);
  requestBackgroundSync();
  await refreshOutboxState(businessId);
}

// Solicita Background Sync cuando el navegador lo soporte. Es un mejorador
// opcional: si no está disponible, el fallback de sincronización al abrir /
// recuperar conexión / volver a primer plano sigue funcionando.
function requestBackgroundSync() {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
  try {
    navigator.serviceWorker.ready.then((registration) => {
      if (registration.sync) {
        registration.sync.register('tuganancia-sync').catch(() => {
          // Permission denied or unsupported: ignore, fallback will handle it.
        });
      }
    });
  } catch {
    // Ignore in environments without service worker support.
  }
}

function getErrorText(err) {
  if (typeof err === 'string') return err.toLowerCase();
  if (!err || typeof err !== 'object') return '';
  return [
    err.name, err.code, err.message, err.details, err.hint,
    err.cause?.name, err.cause?.code, err.cause?.message, err.cause?.details,
    err.error?.name, err.error?.code, err.error?.message, err.error?.details,
  ].filter((value) => value !== undefined && value !== null && value !== '').join(' ').toLowerCase();
}

function getErrorCodes(err) {
  if (!err || typeof err !== 'object') return [];
  return [
    err.code, err.status, err.statusCode,
    err.cause?.code, err.cause?.status, err.cause?.statusCode,
    err.error?.code, err.error?.status, err.error?.statusCode,
  ].filter((value) => value !== undefined && value !== null && value !== '')
    .map((value) => String(value).toUpperCase());
}

export function isNetworkError(err) {
  const codes = getErrorCodes(err);
  const networkCodes = [
    '0', '408', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN',
    'ETIMEDOUT', 'ERR_NETWORK', 'ERR_INTERNET_DISCONNECTED',
    'ERR_CONNECTION_RESET', 'ERR_CONNECTION_REFUSED', 'ERR_NAME_NOT_RESOLVED',
    'NETWORK_ERROR',
  ];
  if (codes.some((code) => networkCodes.includes(code))) return true;
  return /failed to fetch|fetch failed|network\s*error|networkerror|network request failed|timeout|timed out|socket hang up|load failed|offline|sin conexi[oó]n|no connection|no internet|\bcors\b|cross[- ]origin/.test(getErrorText(err));
}

export function isAuthError(err) {
  const codes = getErrorCodes(err);
  if (codes.includes('PGRST301') || codes.includes('401')) return true;
  return /jwt expired|jwt expirado|expired jwt|invalid jwt|jwt inv[aá]lido|invalid session|sesi[oó]n inv[aá]lida|session expired|sesi[oó]n expirada|auth session missing|invalid refresh token|refresh token not found|unauthorized|no autorizado/.test(getErrorText(err));
}

export function isPermanentError(err) {
  if (isNetworkError(err) || isAuthError(err)) return false;
  const permanentCodes = [
    '23505', '23502', '23503', '23514', 'P0001', '22P02',
    '42883', 'PGRST202', '42P01', '42501',
  ];
  const codes = getErrorCodes(err);
  if (codes.includes('PGRST204')) return false;
  if (codes.some((code) => permanentCodes.includes(code))) return true;
  return /duplicate key value violates unique constraint|violates (?:not-null|foreign key|check) constraint|constraint violation|violates row-level security policy|permission denied|invalid input syntax|invalid text representation|datos inv[aá]lidos|could not find the function|function[\s\S]*does not exist|relation[\s\S]*does not exist|table[\s\S]*does not exist|no existe la funci[oó]n|no existe la tabla/.test(getErrorText(err));
}

export function isRetryableError(err) {
  return !isPermanentError(err);
}

function isLegacyNegativeStockError(op) {
  if (op.status !== 'error' || op.auto_recovered) return false;
  if (op.operation_type !== 'REGISTER_SALE' && op.operation_type !== 'REGISTER_PRESENTATION_SALE') return false;
  return /stock no puede ser negativo|dejar[ií]a stock negativo/i.test(op.error_details || '');
}

export async function getPendingOperations(businessId, status = null) {
  const allOps = await db.pending_operations.orderBy('created_at').toArray();
  const scoped = businessId ? allOps.filter((op) => belongsToBusiness(op, businessId)) : allOps;
  return status === null ? scoped : scoped.filter((op) => op.status === status);
}

async function runSyncOnce(businessId) {
  try {
    const isOnline = await checkOnlineStatus();
    if (!isOnline) return;

    const allOps = await db.pending_operations.orderBy('created_at').toArray();
    const ops = allOps.filter((op) => belongsToBusiness(op, businessId));

    for (const op of ops) {
      if (op.status === 'error') {
        if (!isLegacyNegativeStockError(op)) continue; // Skip permanently failed operations
        // Este error lo producía el trigger viejo de stock. La migración ya
        // permite sincronizar la venta, así que se reintenta una sola vez.
        await db.pending_operations.update(op.id, {
          status: 'pending',
          retry_count: 0,
          last_attempt_at: null,
          error_details: null,
          auto_recovered: true,
        });
        op.status = 'pending';
        op.retry_count = 0;
        op.last_attempt_at = null;
      }

      // Simple exponential backoff check
      if (op.retry_count > 0 && op.last_attempt_at) {
        const backoffSeconds = Math.min(Math.pow(2, op.retry_count) * 10, 300); // max 5 min
        const msSinceAttempt = Date.now() - new Date(op.last_attempt_at).getTime();
        if (msSinceAttempt < backoffSeconds * 1000) {
          continue; // Skip this cycle for this operation
        }
      }

      try {
        await db.pending_operations.update(op.id, { status: 'syncing' });
        await processOperation(op, businessId);
        await db.pending_operations.update(op.id, {
          status: 'confirmed',
          server_confirmed_at: new Date().toISOString(),
        });
        await updatePendingCount(businessId);
        await new Promise((resolve) => setTimeout(resolve, 50));
        await db.pending_operations.delete(op.id);
      } catch (err) {
        const errorMessage = err?.message || err?.details || err?.hint || (typeof err === 'string' ? err : JSON.stringify(err)) || 'Error de sincronización.';
        console.error(`[SyncEngine Error] Operation ${op.id} (${op.operation_type}) - Attempt ${(op.retry_count || 0) + 1}:`, errorMessage, err);
        
        const currentRetry = op.retry_count || 0;
        const nextRetry = currentRetry + 1;
        const nowStr = new Date().toISOString();
        const shouldRetry = !isPermanentError(err) && currentRetry < 5;

        await db.pending_operations.update(op.id, {
          status: shouldRetry ? 'pending' : 'error',
          retry_count: nextRetry,
          last_attempt_at: nowStr,
          error_details: errorMessage
        });
      }
      await updatePendingCount(businessId);
    }

    // Antes esto solo corría si processedAny era true, es decir, solo si
    // ESTE dispositivo tenía algo propio para enviar. Eso significa que un
    // dispositivo sin cambios pendientes (el caso normal) nunca volvía a
    // bajar cambios hechos en OTRO dispositivo hasta recargar la página.
    // Ahora se sincroniza siempre que haya conexión, haya o no ops propias.
    await syncCacheFromServer(businessId);
  } catch (err) {
    console.error('Error during synchronization run:', err);
  }
}

async function runSyncLoop(businessId) {
  try {
    do {
      syncRequested = false;
      await runSyncOnce(businessId);
      // Si otro evento (online, reintento manual, venta nueva) pidió sync
      // mientras este pase corría, se hace otro pase en vez de perderlo.
    } while (syncRequested);
  } finally {
    syncPromise = null;
  }
}

export function triggerSync(businessId) {
  if (syncPromise) {
    syncRequested = true;
    return syncPromise;
  }
  syncPromise = runSyncLoop(businessId);
  return syncPromise;
}

// Espera a que terminen el pase actual y los que hayan quedado encolados.
export async function waitForSyncIdle() {
  while (syncPromise) {
    await syncPromise;
  }
}

export async function retryOperation(opId, businessId) {
  await db.pending_operations.update(opId, {
    status: 'pending',
    retry_count: 0,
    last_attempt_at: null,
    error_details: null
  });
  await updatePendingCount(businessId);
  triggerSync(businessId);
}

export async function discardOperation(opId, businessId) {
  await db.pending_operations.delete(opId);
  await updatePendingCount(businessId);
}

// ── Capacidades del servidor (migraciones SQL pendientes o no) ─────────
// Si el usuario aún no corrió una migración (barcode, presentaciones), las
// columnas no existen y el insert/update fallaría para SIEMPRE dejando la
// cola trabada. Probamos una vez por sesión y, si faltan, se recortan esas
// claves del payload: la app sigue sincronizando lo demás y gana fidelidad
// total en cuanto se corre el SQL.
let serverCaps = null;

async function getServerCaps() {
  if (serverCaps) return serverCaps;
  serverCaps = {
    productPres: true, productBarcode: true, productPresentations: true, productDish: true, itemPres: true, salesBranch: true,
    branchTables: true,
    businessSettings: null, // null = aún no probado; objeto {col: true/false}
    expenseExtra: null,
    atomicTransfer: null, // null = no probado; true/false tras primer uso
    atomicStock: null,
    atomicSale: null,
  };
  try {
    const { error } = await assertSupabase().from('products').select('unit_label').limit(0);
    if (error) serverCaps.productPres = false;
  } catch {
    serverCaps.productPres = false;
  }
  try {
    const { error } = await assertSupabase().from('products').select('barcode').limit(0);
    if (error) serverCaps.productBarcode = false;
  } catch {
    serverCaps.productBarcode = false;
  }
  try {
    const { error } = await assertSupabase().from('products').select('presentations').limit(0);
    if (error) serverCaps.productPresentations = false;
  } catch {
    serverCaps.productPresentations = false;
  }
  try {
    const { error } = await assertSupabase().from('products').select('is_dish').limit(0);
    if (error) serverCaps.productDish = false;
  } catch {
    serverCaps.productDish = false;
  }
  try {
    const { error } = await assertSupabase().from('sale_items').select('presentation').limit(0);
    if (error) serverCaps.itemPres = false;
  } catch {
    serverCaps.itemPres = false;
  }
  try {
    const { error } = await assertSupabase().from('sales').select('branch_id').limit(0);
    if (error) serverCaps.salesBranch = false;
  } catch {
    serverCaps.salesBranch = false;
  }
  // Tablas Fase 2: si no existen, todo lo de sedes se omite (local sigue válido).
  try {
    const { error } = await assertSupabase().from('branch_stock').select('branch_id').limit(0);
    if (error) serverCaps.branchTables = false;
  } catch {
    serverCaps.branchTables = false;
  }
  if (serverCaps.branchTables) {
    try {
      const { error } = await assertSupabase().from('transfers').select('id').limit(0);
      if (error) serverCaps.branchTables = false;
    } catch {
      serverCaps.branchTables = false;
    }
  }
  // Columnas opcionales de business_settings: se prueban una vez para poder
  // recortar ANTES del upsert en vez de reintentar a ciegas.
  try {
    serverCaps.businessSettings = await probeOptionalColumns('business_settings',
      ['legal_name', 'nit', 'city', 'address', 'footer_message', 'show_qr']);
  } catch {
    serverCaps.businessSettings = null;
  }
  try {
    const cols = await probeOptionalColumns('expenses',
      ['payment_method', 'invoice_number', 'notes']);
    serverCaps.expenseExtra = cols;
  } catch {
    serverCaps.expenseExtra = null;
  }
  if (!serverCaps.productPres || !serverCaps.productBarcode || !serverCaps.productPresentations || !serverCaps.productDish || !serverCaps.itemPres || !serverCaps.salesBranch || serverCaps.branchTables === false) {
    console.warn('syncEngine: columnas/tablas nuevas ausentes en el servidor, se sincroniza sin ellas. Corre el SQL de migración para fidelidad total.', serverCaps);
  }
  return serverCaps;
}

// Prueba qué columnas opcionales existen (true) sin traer datos.
async function probeOptionalColumns(table, cols) {
  const out = {};
  for (const c of cols) {
    try {
      const { error } = await assertSupabase().from(table).select(c).limit(0);
      out[c] = !error;
    } catch {
      out[c] = false;
    }
  }
  return out;
}

const NEW_PRES_KEYS = ['unit_label', 'pack_label', 'pack_price', 'pack_price_hot'];

async function stripUnknownProductKeys(obj) {
  const caps = await getServerCaps();
  if (!obj || typeof obj !== 'object') return obj;
  if (caps.productPres && caps.productBarcode && caps.productPresentations && caps.productDish) return obj;
  const copy = { ...obj };
  if (!caps.productPres) NEW_PRES_KEYS.forEach((k) => { delete copy[k]; });
  if (!caps.productBarcode) delete copy.barcode;
  if (!caps.productPresentations) delete copy.presentations;
  if (!caps.productDish) delete copy.is_dish;
  return copy;
}

// Recorte previo para business_settings: quita las keys que el servidor aún
// no tiene (migración pendiente) para que el upsert entre al primer intento.
async function stripUnknownBusinessSettingsKeys(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const caps = await getServerCaps();
  const known = caps.businessSettings;
  if (!known) return { ...obj };
  if (Object.values(known).every(Boolean)) return { ...obj };
  const copy = { ...obj };
  for (const [col, ok] of Object.entries(known)) {
    if (!ok) delete copy[col];
  }
  return copy;
}

async function stripUnknownExpenseKeys(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const caps = await getServerCaps();
  const known = caps.expenseExtra;
  if (!known) return { ...obj };
  if (Object.values(known).every(Boolean)) return { ...obj };
  const copy = { ...obj };
  for (const [col, ok] of Object.entries(known)) {
    if (!ok) delete copy[col];
  }
  return copy;
}

function isMissingColumnError(err) {
  const msg = String(err?.message || '').toLowerCase();
  return err?.code === 'PGRST204' || msg.includes('column') || msg.includes('columna');
}

function isMissingFunctionError(err) {
  const msg = String((err?.message || '') + ' ' + (err?.hint || '')).toLowerCase();
  const code = String(err?.code || '');
  return code === 'PGRST202' || code === '42883'
    || msg.includes('function') || msg.includes('could not find the function')
    || msg.includes('no existe la función') || msg.includes('does not exist');
}

function isBranchTablesMissingError(err) {
  const msg = String((err?.message || '') + ' ' + (err?.details || '') + ' ' + (err?.hint || '')).toLowerCase();
  return isMissingColumnError(err)
    || msg.includes('branch_stock') || msg.includes('transfers')
    || String(err?.code || '') === '42P01'; // undefined_table
}

// Un maybeSingle/select con error (red, RLS, sesión expirada) NO significa
// "no existe": se propaga para reintentar, nunca se asume 0 ni se sobrescribe.
function throwIfReadError(res, context) {
  if (res?.error) {
    const e = new Error(`${context}: ${res.error.message || 'error de lectura'}`);
    e.cause = res.error;
    e.code = res.error.code;
    throw e;
  }
  return res?.data;
}

async function processOperation(op, businessId) {
  const { operation_type, payload } = op;

  switch (operation_type) {
    case 'ADD_PRODUCT': {
      const caps = await getServerCaps();
      if (payload.presentations !== undefined && !caps.productPresentations) {
        throw new Error('El servidor aún no tiene la migración de presentaciones configurables.');
      }
      const body = await stripUnknownProductKeys(payload);
      const { error } = await assertSupabase().from('products').insert(body);
      if (error) throw error;
      break;
    }
    case 'UPDATE_PRODUCT': {
      const { id, ...updateData } = payload;
      const caps = await getServerCaps();
      if (updateData.presentations !== undefined && !caps.productPresentations) {
        throw new Error('El servidor aún no tiene la migración de presentaciones configurables.');
      }
      const body = await stripUnknownProductKeys(updateData);
      const { error } = await assertSupabase().from('products').update(body).eq('id', id);
      if (error) throw error;
      break;
    }
    case 'DELETE_PRODUCT': {
      const { error } = await assertSupabase().from('products').delete().eq('id', payload.id);
      if (error) throw error;
      break;
    }
    case 'SET_BRANCH_STOCK': {
      // Upsert tolerante del stock de una sede (Fase 2)
      try {
        const { error } = await assertSupabase().from('branch_stock').upsert({
          branch_id: payload.branch_id,
          product_id: payload.product_id,
          business_id: businessId,
          stock: Number(payload.stock || 0),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'branch_id,product_id' });
        if (error) throw error;
      } catch (err) {
        if (isMissingColumnError(err) || String(err?.message || '').includes('branch_stock')) {
          const caps = await getServerCaps();
          caps.branchTables = false;
        } else throw err;
      }
      break;
    }
    case 'TRANSFER_STOCK': {
      // Traspaso ATÓMICO: un solo RPC con SELECT ... FOR UPDATE + idempotencia
      // por transfer_id. Sin read-modify-write del lado cliente: dos traspasos
      // concurrentes no se pisan porque Postgres serializa por row lock.
      // Ante error de lectura/red/RLS se lanza (reintenta), nunca se asume 0.
      const capsT = await getServerCaps();
      if (capsT.branchTables === false) break;
      try {
        const { error: rpcErr } = await assertSupabase().rpc('transfer_stock_atomico', {
          p_transfer_id: payload.transfer_id,
          p_business_id: businessId,
          p_product_id: payload.product_id,
          p_from_branch_id: payload.from_branch_id,
          p_to_branch_id: payload.to_branch_id,
          p_quantity: Number(payload.quantity || 0),
          p_created_by: payload.created_by || null,
        });
        if (!rpcErr) {
          capsT.atomicTransfer = true;
          break;
        }
        if (isBranchTablesMissingError(rpcErr)) {
          capsT.branchTables = false;
          break; // Fase 2 sin migrar: local sigue válido, nada que sincronizar.
        }
        if (isMissingFunctionError(rpcErr)) {
          capsT.atomicTransfer = false;
          // Sin RPC atómico NO se hace read-modify-write (perdería stock bajo
          // concurrencia y asumiría 0 ante errores de lectura). Se deja la op
          // pendiente hasta que corra la migración SQL.
          throw new Error('Falta RPC transfer_stock_atomico en el servidor (corre la migración SQL).');
        }
        throw rpcErr;
      } catch (err) {
        if (isBranchTablesMissingError(err)) {
          (await getServerCaps()).branchTables = false;
          break;
        }
        throw err;
      }
    }
    case 'REGISTER_PRESENTATION_SALE': {
      const { error } = await assertSupabase().rpc('registrar_venta_presentaciones', {
        p_client_generated_id: payload.client_generated_id,
        p_business_id: payload.business_id,
        p_client_name: payload.client_name,
        p_client_nit: payload.client_nit,
        p_payment_method: payload.payment_method,
        p_total: Number(payload.total),
        p_item_count: Number(payload.item_count || 0),
        p_seller_name: payload.seller_name || '',
        p_created_by: payload.created_by || null,
        p_items: payload.p_items,
        p_branch_id: payload.extraFields?.branchId || null,
      });
      if (error) {
        if (isMissingFunctionError(error)) {
          throw Object.assign(
            new Error('La venta configurable queda pendiente hasta que el servidor tenga la migración de presentaciones.'),
            { code: 'PRESENTATION_RPC_MISSING' },
          );
        }
        throw error;
      }
      if (payload.extraFields && (payload.extraFields.montoEfectivo !== undefined || payload.extraFields.montoQR !== undefined)) {
        const updateData = {};
        if (payload.extraFields.montoEfectivo !== undefined) updateData.monto_efectivo = Number(payload.extraFields.montoEfectivo);
        if (payload.extraFields.montoQR !== undefined) updateData.monto_qr = Number(payload.extraFields.montoQR);
        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await assertSupabase()
            .from('sales')
            .update(updateData)
            .eq('id', payload.client_generated_id);
          if (updateError && !isMissingColumnError(updateError)) throw updateError;
        }
      }
      try {
        await db.sales.update(payload.client_generated_id, { sync_status: 'confirmed' });
      } catch (confirmErr) {
        console.warn('syncEngine: no se pudo marcar venta configurable como confirmada:', confirmErr);
      }
      break;
    }
    case 'REGISTER_SALE': {
      // 1. Idempotencia: un error de lectura (red/RLS/sesión) NO es "no existe".
      // Se propaga para reintentar; nunca se crea duplicado ni se asume stock.
      const existRes = await assertSupabase()
        .from('sales')
        .select('id')
        .eq('id', payload.client_generated_id)
        .maybeSingle();
      const existing = throwIfReadError(existRes, 'idempotencia de venta');

      // Solo se descuenta stock si el RPC realmente creó la venta ahora.
      // En reintentos (ya sincronizada) se omite para no descontar doble.
      let didCreate = false;
      // true si el RPC nuevo ya descontó TODO (base + sede) en una transacción.
      let stockYaDescontado = false;

      if (!existing) {
        const factors = Array.isArray(payload.p_factors) ? payload.p_factors : [];
        const branchId = payload.extraFields?.branchId || null;
        const baseArgs = {
          p_client_generated_id: payload.client_generated_id,
          p_business_id: payload.business_id,
          p_client_name: payload.client_name,
          p_client_nit: payload.client_nit,
          p_payment_method: payload.payment_method,
          p_total: Number(payload.total),
          p_item_count: Number(payload.item_count || 0),
          p_seller_name: payload.seller_name || '',
          p_created_by: payload.created_by || null,
          p_items: payload.p_items,
        };
        // 2a. Intento atómico total: venta + ítems + stock base + stock sede
        // en UNA transacción del servidor (row locks, sin lost update).
        const { error: atomicErr } = await assertSupabase().rpc('registrar_venta', {
          ...baseArgs,
          p_factors: factors,
          p_branch_id: branchId,
        });
        if (!atomicErr) {
          didCreate = true;
          stockYaDescontado = true;
          (await getServerCaps()).atomicSale = true;
        } else if (isMissingFunctionError(atomicErr)) {
          // Servidor con RPC viejo (sin p_factors/p_branch_id): venta vieja +
          // decrementos atómicos por helper (nunca read-modify-write).
          (await getServerCaps()).atomicSale = false;
          const { error: oldErr } = await assertSupabase().rpc('registrar_venta', baseArgs);
          if (oldErr) throw oldErr;
          didCreate = true;
          stockYaDescontado = false;
        } else if (isBranchTablesMissingError(atomicErr) && branchId) {
          // La parte de sede falló por tablas ausentes: reintentar sin sede.
          // La venta global igual debe crearse (local ya la tiene por sede).
          const { error: noBranchErr } = await assertSupabase().rpc('registrar_venta', {
            ...baseArgs,
            p_factors: factors,
            p_branch_id: null,
          });
          if (noBranchErr) {
            if (isMissingFunctionError(noBranchErr)) {
              const { error: oldErr2 } = await assertSupabase().rpc('registrar_venta', baseArgs);
              if (oldErr2) throw oldErr2;
            } else throw noBranchErr;
          }
          didCreate = true;
          stockYaDescontado = false;
          (await getServerCaps()).branchTables = false;
        } else {
          throw atomicErr;
        }

        // 2b. Servidor viejo: compensar paquetes + sede con RPCs atómicos
        // (UPDATE ... SET stock = stock - X). Sin lecturas previas: dos ventas
        // concurrentes se serializan por row lock y ninguna se pierde.
        if (didCreate && !stockYaDescontado) {
          const capsA = await getServerCaps();
          // Paquetes: el RPC viejo descontó `quantity` (paquetes); falta
          // qty×(factor−1) en unidades base.
          for (const f of factors) {
            const factor = Number(f.factor || 1);
            const qty = Number(f.quantity || 0);
            if (!(factor > 1 && qty > 0)) continue;
            const extra = qty * (factor - 1);
            try {
              const { error: decErr } = await assertSupabase().rpc('descontar_stock_atomico', {
                p_product_id: f.product_id,
                p_qty: extra,
              });
              if (!decErr) {
                capsA.atomicStock = true;
                continue;
              }
              if (isMissingFunctionError(decErr)) {
                capsA.atomicStock = false;
                // Sin helper atómico NO se hace read-modify-write: asumiría 0
                // ante errores de lectura y perdería ventas concurrentes.
                console.warn('syncEngine: falta RPC descontar_stock_atomico (corre la migración); se omite compensación de paquete para no corromper stock.', f.product_id);
                continue;
              }
              throw decErr;
            } catch (decErr) {
              if (isMissingFunctionError(decErr)) continue;
              throw decErr;
            }
          }
          // Sede: descuenta unidades base por producto (agregado).
          if (branchId && capsA.branchTables !== false) {
            const byProduct = {};
            for (const f of factors) {
              const pid = f.product_id;
              if (!pid) continue;
              byProduct[pid] = (byProduct[pid] || 0) + Number(f.quantity || 0) * Number(f.factor || 1);
            }
            // Sin p_factors (ventas viejas) se cae a p_items en unidades.
            if (Object.keys(byProduct).length === 0 && Array.isArray(payload.p_items)) {
              for (const it of payload.p_items) {
                if (!it.product_id) continue;
                byProduct[it.product_id] = (byProduct[it.product_id] || 0) + Number(it.quantity || 0);
              }
            }
            for (const [pid, baseQty] of Object.entries(byProduct)) {
              if (!(Number(baseQty) > 0)) continue;
              try {
                const { error: bsErr } = await assertSupabase().rpc('descontar_branch_stock_atomico', {
                  p_branch_id: branchId,
                  p_product_id: pid,
                  p_business_id: payload.business_id,
                  p_qty: Number(baseQty),
                });
                if (!bsErr) continue;
                if (isBranchTablesMissingError(bsErr)) {
                  (await getServerCaps()).branchTables = false;
                  break;
                }
                if (isMissingFunctionError(bsErr)) {
                  (await getServerCaps()).atomicStock = false;
                  console.warn('syncEngine: falta RPC descontar_branch_stock_atomico (corre la migración); se omite descuento por sede para no corromper stock.', pid);
                  break;
                }
                throw bsErr;
              } catch (bsErr) {
                if (isBranchTablesMissingError(bsErr)) {
                  (await getServerCaps()).branchTables = false;
                  break;
                }
                if (isMissingFunctionError(bsErr)) break;
                throw bsErr;
              }
            }
          }
        }
      } else {
        console.log(`Sale ${payload.client_generated_id} already synced.`);
      }

      // 3. Campos extra de pago mixto (idempotente, ciego: sin lecturas).
      if (payload.extraFields && (payload.extraFields.montoEfectivo !== undefined || payload.extraFields.montoQR !== undefined)) {
        const updateData = {};
        if (payload.extraFields.montoEfectivo !== undefined) updateData.monto_efectivo = Number(payload.extraFields.montoEfectivo);
        if (payload.extraFields.montoQR !== undefined) updateData.monto_qr = Number(payload.extraFields.montoQR);
        if (Object.keys(updateData).length > 0) {
          try {
            const { error: updErr } = await assertSupabase()
              .from('sales')
              .update(updateData)
              .eq('id', payload.client_generated_id);
            if (updErr) {
              if (isMissingColumnError(updErr)) {
                console.warn('syncEngine: sales sin columnas monto_*; se omite pago mixto.', updErr.message);
              } else throw updErr;
            }
          } catch (updErr) {
            if (!isMissingColumnError(updErr)) throw updErr;
            console.warn('syncEngine: sales sin columnas monto_*; se omite pago mixto.');
          }
        }
      }

      // 3b. Presentación en ítems (ciego, idempotente; solo metadata).
      // Si el RPC nuevo ya la estampó, este update es no-op.
      if (didCreate && Array.isArray(payload.p_factors) && (await getServerCaps()).itemPres) {
        for (const f of payload.p_factors || []) {
          const factor = Number(f?.factor || 1);
          if (factor <= 1) continue;
          try {
            const { error: presErr } = await assertSupabase()
              .from('sale_items')
              .update({
                presentation: f.presentation || '',
                presentation_factor: factor,
                variant: f.variant || '',
              })
              .eq('sale_id', payload.client_generated_id)
              .eq('product_id', f.product_id)
              .eq('quantity', Number(f.quantity))
              .eq('price', Number(f.price));
            if (presErr) {
              if (isMissingColumnError(presErr)) {
                (await getServerCaps()).itemPres = false;
                break;
              }
              throw presErr;
            }
          } catch (presErr) {
            if (isMissingColumnError(presErr)) {
              (await getServerCaps()).itemPres = false;
              break;
            }
            throw presErr;
          }
        }
      }

      // 3d. Sello de sucursal en la venta del servidor (ciego, tolerante).
      if (didCreate && payload.extraFields?.branchId && (await getServerCaps()).salesBranch) {
        try {
          const { error: brErr } = await assertSupabase()
            .from('sales')
            .update({ branch_id: payload.extraFields.branchId })
            .eq('id', payload.client_generated_id);
          if (brErr) {
            if (isMissingColumnError(brErr)) (await getServerCaps()).salesBranch = false;
            else throw brErr;
          }
        } catch (brErr) {
          if (isMissingColumnError(brErr)) (await getServerCaps()).salesBranch = false;
          else throw brErr;
        }
      }

      // 4. Alertas de stock negativo (solo lectura; nunca bloquea la venta).
      if (didCreate) {
        for (const item of payload.p_items || []) {
          try {
            const res = await assertSupabase()
              .from('products')
              .select('name, stock')
              .eq('id', item.product_id)
              .maybeSingle();
            if (res?.error) {
              console.warn('syncEngine: no se pudo verificar stock para alerta:', res.error.message);
              continue;
            }
            const prod = res?.data;
            if (prod && Number(prod.stock) < 0) {
              try {
                await assertSupabase().from('stock_alerts').insert({
                  business_id: payload.business_id,
                  product_id: item.product_id,
                  product_name: prod.name,
                  current_stock: prod.stock,
                  sale_id: payload.client_generated_id,
                  message: `Stock negativo detected para ${prod.name} (Cantidad: ${prod.stock}) tras sincronización offline.`
                });
              } catch (alertErr) {
                console.warn('syncEngine: no se pudo registrar alerta de stock:', alertErr?.message || alertErr);
              }
            }
          } catch (alertErr) {
            console.warn('syncEngine: verificación de stock omitida:', alertErr?.message || alertErr);
          }
        }
      }

      // 5. Marcar la venta local como confirmada por el servidor. Esto es
      // best-effort: si la venta no existe localmente (p.ej. se borró la caché),
      // no debe fallar el sync.
      try {
        await db.sales.update(payload.client_generated_id, { sync_status: 'confirmed' });
      } catch (confirmErr) {
        console.warn('syncEngine: no se pudo marcar venta como confirmada:', confirmErr);
      }
      break;
    }
    case 'ADD_EXPENSE': {
      // Recorte previo por capacidades (un intento); si el schema cambió a
      // mitad de sesión se refresca caps y se reintenta una vez.
      let insertPayload = await stripUnknownExpenseKeys(payload);
      {
        const { error } = await assertSupabase().from('expenses').insert(insertPayload);
        if (error) {
          if (isMissingColumnError(error)) {
            serverCaps = null;
            insertPayload = await stripUnknownExpenseKeys(payload);
            const { error: e2 } = await assertSupabase().from('expenses').insert(insertPayload);
            if (e2) throw e2;
          } else throw error;
        }
      }
      break;
    }
    case 'UPDATE_EXPENSE': {
      const { id, ...updateData } = payload;
      let upd = await stripUnknownExpenseKeys(updateData);
      {
        const { error } = await assertSupabase().from('expenses').update(upd).eq('id', id);
        if (error) {
          if (isMissingColumnError(error)) {
            serverCaps = null;
            upd = await stripUnknownExpenseKeys(updateData);
            const { error: e2 } = await assertSupabase().from('expenses').update(upd).eq('id', id);
            if (e2) throw e2;
          } else throw error;
        }
      }
      break;
    }
    case 'DELETE_EXPENSE': {
      const { error } = await assertSupabase().from('expenses').delete().eq('id', payload.id);
      if (error) throw error;
      break;
    }
    case 'ADD_REPLENISHMENT': {
      const { error } = await assertSupabase().from('replenishments').insert(payload);
      if (error) throw error;
      break;
    }
    case 'UPDATE_REPLENISHMENT': {
      const { id, ...updateData } = payload;
      const { error } = await assertSupabase().from('replenishments').update(updateData).eq('id', id);
      if (error) throw error;
      break;
    }
    case 'ADD_DEBT': {
      const { error } = await assertSupabase().from('debts').insert(payload);
      if (error) throw error;
      break;
    }
    case 'PAY_DEBT': {
      const { error: dErr } = await assertSupabase()
        .from('debts')
        .update({
          status: 'paid',
          paid_at: payload.paid_at,
          payment_method_received: payload.payment_method_received,
        })
        .eq('id', payload.debtId);
      if (dErr) throw dErr;
      // La venta original no se toca — ver nota en debts.js/payDebt.
      break;
    }
    case 'DELETE_DEBT': {
      const { error } = await assertSupabase().from('debts').delete().eq('id', payload.id);
      if (error) throw error;
      break;
    }
    case 'ADD_CUSTOMER': {
      const { error } = await assertSupabase().from('clientes').insert(payload);
      if (error) throw error;
      break;
    }
    case 'UPDATE_CUSTOMER': {
      const { id, ...updateData } = payload;
      const { error } = await assertSupabase().from('clientes').update(updateData).eq('id', id);
      if (error) throw error;
      break;
    }
    case 'DELETE_CUSTOMER': {
      const { error } = await assertSupabase().from('clientes').delete().eq('id', payload.id);
      if (error) throw error;
      break;
    }
    case 'SAVE_BUSINESS_SETTINGS': {
      // Recorte PREVIO por capacidades: un solo upsert con las columnas que el
      // servidor realmente tiene (getServerCaps), en vez de reintentar N veces
      // parseando mensajes de error. Si el schema cambió a mitad de sesión se
      // refresca caps una vez y se reintenta.
      const { business_id, ...data } = payload;
      let body = await stripUnknownBusinessSettingsKeys(data);
      {
        const { error } = await assertSupabase()
          .from('business_settings')
          .upsert({ business_id, ...body });
        if (error) {
          if (isMissingColumnError(error)) {
            serverCaps = null; // caps obsoletas: reprobar y recortar de nuevo
            body = await stripUnknownBusinessSettingsKeys(data);
            const { error: e2 } = await assertSupabase()
              .from('business_settings')
              .upsert({ business_id, ...body });
            if (e2) throw e2;
          } else throw error;
        }
      }
      break;
    }
    default:
      console.warn(`Unhandled operation type: ${operation_type}`);
  }
}

// isEligibleFn decides which LOCAL records are even candidates for deletion.
// This matters because some server fetches below are partial (e.g. sales are
// only fetched from today onward, to keep the sync payload small) — without
// restricting deletion to that same window, every local record outside it
// looks "missing from the server" and gets wiped, silently collapsing local
// history down to whatever the last fetch window covered. It also guards
// against deleting another business's cached rows on a shared device.
async function safeSyncTable(table, serverData, isPendingFn, isEligibleFn = () => true) {
  await db.transaction('rw', table, async () => {
    const localRecords = await table.toArray();
    const serverKeys = new Set(serverData.map((item) => item.id));
    const eligibleLocalCount = localRecords.filter(isEligibleFn).length;

    // Red de seguridad: si el servidor "no devolvió nada" pero localmente sí
    // había registros elegibles, NO se borra nada. Con RLS, una consulta que
    // debería traer filas puede devolver 0 filas sin ningún error (sesión a
    // punto de expirar, una policy mal aplicada, etc. — ya pasó en este
    // proyecto). Sin esta protección, ese 0 silencioso se interpretaba como
    // "el servidor los borró todos" y se vaciaba la caché local completa
    // (clientes, deudas, productos...) aunque los datos siguieran intactos
    // en la base de datos real. El único costo es que, si alguna vez borrás
    // TODOS los registros de una tabla hasta dejarla en cero, la caché local
    // tarda hasta el próximo registro nuevo en reflejarlo — un precio bajo
    // comparado con perder de vista datos de clientes por un glitch.
    if (serverData.length === 0 && eligibleLocalCount > 0) {
      console.warn('[SyncEngine] Sincronización de caché omitida: el servidor devolvió 0 registros pero había datos locales. Se preservó la caché local por seguridad.');
      return;
    }

    // Delete local records that are not on the server and are not pending sync
    const recordsToDelete = localRecords.filter(
      (item) => isEligibleFn(item) && !serverKeys.has(item.id) && !isPendingFn(item)
    );
    if (recordsToDelete.length > 0) {
      await table.bulkDelete(recordsToDelete.map((r) => r.id));
    }

    // Upsert server records that are not pending sync
    const recordsToPut = serverData.filter((item) => !isPendingFn(item));
    if (recordsToPut.length > 0) {
      await table.bulkPut(recordsToPut);
    }
  });
}

// ── Helpers del sync incremental ────────────────────────────────────
// Pagina con .range() hasta agotar (ver PAGE_SIZE). buildQuery(from,to)
// debe devolver una query ya ordenada (orden estable = paginación correcta).
async function fetchAll(buildQuery) {
  const rows = [];
  let from = 0;
  for (;;) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
    if (from > 500000) break;
  }
  return rows;
}

// Upsert SIN borrado (modo incremental: lo que no vino, NO se toca).
async function upsertRows(table, rows, isPendingFn = () => false) {
  if (!rows || rows.length === 0) return;
  const toPut = rows.filter((r) => !isPendingFn(r));
  if (toPut.length > 0) await table.bulkPut(toPut);
}

// Reconciliación de borrados: recibe SOLO ids del servidor y elimina locales
// que ya no existen. Red de seguridad: si el servidor devolvió 0 filas pero
// hay datos locales, no borra nada (posible error de red/RLS transitorio).
async function reconcileDeletes(table, businessId, serverRows, isPendingFn = () => false) {
  if (!serverRows) return;
  const local = await table.where('business_id').equals(businessId).toArray();
  if (serverRows.length === 0 && local.length > 0) {
    console.warn('[SyncEngine] Reconciliación omitida: el servidor devolvió 0 registros pero había datos locales. Se preservó la caché.');
    return;
  }
  const serverIds = new Set(serverRows.map((r) => r.id));
  const toDelete = local.filter((r) => !serverIds.has(r.id) && !isPendingFn(r));
  if (toDelete.length > 0) await table.bulkDelete(toDelete.map((r) => r.id));
}

// Mayor timestamp (ISO) de un lote — el watermark para el próximo gt().
// Las cadenas ISO UTC se comparan lexicográficamente de forma correcta.
function maxStamp(rows, field) {
  let max = null;
  for (const r of rows || []) {
    const v = r && r[field];
    if (v && (max === null || v > max)) max = v;
  }
  return max;
}

async function saveSyncState(businessId, patch) {
  if (!patch || Object.keys(patch).length === 0) return;
  const cur = (await db.sync_state.get(businessId)) || { business_id: businessId };
  await db.sync_state.put({ ...cur, ...patch });
}

export async function syncCacheFromServer(businessId) {
  if (!businessId) return;
  const isOnline = await checkOnlineStatus();
  if (!isOnline) return;

  try {
    const pendingOps = await db.pending_operations.toArray();
    const pendingIds = new Set();
    pendingOps.forEach((op) => {
      if (!op.payload) return;
      
      // Protect primary ID if present
      if (op.payload.id) pendingIds.add(op.payload.id);

      // Handle rules based on operation type
      switch (op.operation_type) {
        case 'ADD_PRODUCT':
        case 'UPDATE_PRODUCT':
        case 'DELETE_PRODUCT':
          if (op.payload.id) pendingIds.add(op.payload.id);
          break;
        case 'REGISTER_SALE':
        case 'REGISTER_PRESENTATION_SALE':
          if (op.payload.client_generated_id) pendingIds.add(op.payload.client_generated_id);
          if (Array.isArray(op.payload.p_items)) {
            op.payload.p_items.forEach(item => {
              if (item.product_id) pendingIds.add(item.product_id);
            });
          }
          // Proteger también las filas de stock por sede tocadas por la venta
          if (op.payload.extraFields?.branchId && Array.isArray(op.payload.p_factors)) {
            op.payload.p_factors.forEach(f => {
              if (f.product_id) pendingIds.add(`${op.payload.extraFields.branchId}:${f.product_id}`);
            });
          }
          break;
        case 'ADD_REPLENISHMENT':
        case 'UPDATE_REPLENISHMENT':
          if (op.payload.id) pendingIds.add(op.payload.id);
          if (op.payload.product_id) pendingIds.add(op.payload.product_id);
          break;
        case 'ADD_DEBT':
        case 'DELETE_DEBT':
          if (op.payload.id) pendingIds.add(op.payload.id);
          if (op.payload.sale_id) pendingIds.add(op.payload.sale_id);
          if (op.payload.saleId) pendingIds.add(op.payload.saleId);
          break;
        case 'SET_BRANCH_STOCK':
          if (op.payload.branch_id && op.payload.product_id) {
            pendingIds.add(`${op.payload.branch_id}:${op.payload.product_id}`);
          }
          break;
        case 'TRANSFER_STOCK':
          if (op.payload.from_branch_id && op.payload.product_id) {
            pendingIds.add(`${op.payload.from_branch_id}:${op.payload.product_id}`);
          }
          if (op.payload.to_branch_id && op.payload.product_id) {
            pendingIds.add(`${op.payload.to_branch_id}:${op.payload.product_id}`);
          }
          if (op.payload.transfer_id) pendingIds.add(op.payload.transfer_id);
          break;
        case 'PAY_DEBT':
          if (op.payload.debtId) pendingIds.add(op.payload.debtId);
          if (op.payload.saleId) pendingIds.add(op.payload.saleId);
          break;
        case 'ADD_CUSTOMER':
        case 'UPDATE_CUSTOMER':
        case 'DELETE_CUSTOMER':
          if (op.payload.id) pendingIds.add(op.payload.id);
          break;
        case 'ADD_EXPENSE':
        case 'UPDATE_EXPENSE':
        case 'DELETE_EXPENSE':
          if (op.payload.id) pendingIds.add(op.payload.id);
          break;
      }
    });

    // Elegibilidad para borrado: siempre restringida al negocio activo, para
    // no tocar la caché de otro negocio en un dispositivo compartido.
    const belongsToBiz = (item) => item.business_id === businessId;

    const state = (await db.sync_state.get(businessId)) || { business_id: businessId };
    const fullDue = !state.full_at
      || (Date.now() - new Date(state.full_at).getTime()) >= FULL_SYNC_INTERVAL_MS;
    if (fullDue) serverCaps = null;
    const caps = await getServerCaps();
    const stampPatch = {};

    // ── BRANCHES: tabla chica; se cachea completa para que BranchContext y
    // las ventas por sede funcionen sin internet desde el arranque. ──
    if (db.branches) {
      try {
        const rows = await fetchAll((from, to) => assertSupabase()
          .from('branches')
          .select('*')
          .eq('business_id', businessId)
          .order('is_main', { ascending: false })
          .order('name', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to));
        await safeSyncTable(db.branches, rows, () => false, belongsToBiz);
      } catch (err) {
        console.warn('syncEngine: no se pudo sincronizar branches:', err);
      }
    }

    // El nombre del negocio sale en recibos y en la barra lateral; se cachea
    // junto con las sedes para no mostrar "Mi negocio" cuando no hay red.
    if (db.businesses) {
      try {
        const { data: bizRow, error: bizErr } = await assertSupabase()
          .from('businesses')
          .select('*')
          .eq('id', businessId)
          .maybeSingle();
        if (bizErr) {
          console.warn('syncEngine: no se pudo sincronizar businesses:', bizErr);
        } else if (bizRow) {
          await db.businesses.put(bizRow);
        }
      } catch (err) {
        console.warn('syncEngine: no se pudo sincronizar businesses:', err);
      }
    }

    // ── PRODUCTS: incremental por updated_at. El catálogo ya NO se baja
    // entero cada ciclo: solo las filas que cambiaron desde el watermark. ──
    try {
      const wm = state.products || null;
      const rows = await fetchAll((from, to) => {
        let q = assertSupabase().from('products').select('*').eq('business_id', businessId);
        if (wm) q = q.gt('updated_at', wm);
        return q.order('updated_at', { ascending: true }).order('id', { ascending: true }).range(from, to);
      });
      const rowsForCache = caps.productPresentations
        ? rows
        : await Promise.all(rows.map(async (row) => {
          const local = await db.products.get(row.id);
          return local && Array.isArray(local.presentations) && local.presentations.length > 0
            ? { ...row, presentations: local.presentations }
            : row;
        }));
      await upsertRows(db.products, rowsForCache, (item) => pendingIds.has(item.id));
      const m = maxStamp(rows, 'updated_at');
      if (m) stampPatch.products = m;
    } catch (err) {
      console.warn('syncEngine: no se pudo sincronizar products:', err);
    }

    // ── BRANCH_STOCK: incremental por updated_at (tolerante si falta la tabla). ──
    if (caps.branchTables !== false) {
      try {
        const wm = state.branch_stock || null;
        const rows = await fetchAll((from, to) => {
          let q = assertSupabase().from('branch_stock').select('*').eq('business_id', businessId);
          if (wm) q = q.gt('updated_at', wm);
          return q.order('updated_at', { ascending: true })
            .order('branch_id', { ascending: true })
            .order('product_id', { ascending: true })
            .range(from, to);
        });
        const norm = rows.map((r) => ({ ...r, id: `${r.branch_id}:${r.product_id}` }));
        await upsertRows(db.branch_stock, norm, (item) => pendingIds.has(item.id));
        const m = maxStamp(rows, 'updated_at');
        if (m) stampPatch.branch_stock = m;
      } catch (e) {
        console.warn('syncEngine: sin tablas de Fase 2 (branch_stock):', e?.message || e);
      }
    }

    // ── TRANSFERS: últimos 200 (barato, se baja en cada ciclo). ──
    if (caps.branchTables !== false) {
      try {
        const { data: trs, error: trsErr } = await assertSupabase()
          .from('transfers').select('*').eq('business_id', businessId)
          .order('created_at', { ascending: false }).limit(200);
        if (trsErr) {
          console.warn('syncEngine: no se pudo sincronizar transfers:', trsErr);
        } else if (trs) {
          await safeSyncTable(db.transfers, trs, (item) => pendingIds.has(item.id), belongsToBiz);
        }
      } catch (e) {
        console.warn('syncEngine: sin tablas de Fase 2 (transfers):', e?.message || e);
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    try {
      const sales = await fetchAll((from, to) => assertSupabase()
        .from('sales')
        .select('*')
        .eq('business_id', businessId)
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to));

      // Solo se pidió al servidor "de hoy en adelante" — restringimos el
      // borrado local a ese mismo rango, si no cualquier venta local de un
      // día anterior "no está en el servidor" (porque no se la pidió) y se
      // borraba igual, dejando el historial local recortado a "solo hoy".
      const isTodaysSale = (item) => {
        if (item.business_id !== businessId) return false;
        const d = item.created_at ? new Date(item.created_at) : null;
        return !!d && d >= today;
      };
      await safeSyncTable(db.sales, sales, (item) => pendingIds.has(item.id), isTodaysSale);

      const saleIds = sales.map((s) => s.id);
      if (saleIds.length > 0) {
        const items = await fetchAll((from, to) => assertSupabase()
          .from('sale_items').select('*').in('sale_id', saleIds)
          .order('id', { ascending: true }).range(from, to));
        const scopedItems = attachSaleItemBusinessIds(sales, items);
        const todaySaleIdSet = new Set(saleIds);
        await safeSyncTable(db.sale_items, scopedItems, (item) => pendingIds.has(item.sale_id), (item) => todaySaleIdSet.has(item.sale_id));
      }
    } catch (err) {
      console.warn('syncEngine: no se pudo sincronizar sales:', err);
    }

    // Sync business settings
    const { data: settingsData, error: settingsErr } = await assertSupabase()
      .from('business_settings')
      .select('*')
      .eq('business_id', businessId)
      .maybeSingle();

    if (settingsErr) {
      console.warn('syncEngine: no se pudo sincronizar business_settings:', settingsErr);
    } else if (settingsData) {
      const isSettingsPending = pendingOps.some(op => op.operation_type === 'SAVE_BUSINESS_SETTINGS');
      if (!isSettingsPending) {
        await db.business_settings.put({
          ...settingsData,
          _fullySynced: true
        });
      }
    }

    // ── PASE COMPLETO (cada FULL_SYNC_INTERVAL_MS): tablas chicas + borrados ──
    // clientes/egresos/deudas/reposiciones no tienen updated_at: se bajan
    // enteras pero con baja frecuencia (el incremental no vería sus ediciones
    // ni sus borrados). Acá también se reconcilian los borrados de products,
    // pidiendo SOLO los ids (no el catálogo entero).
    if (fullDue) {
      const smallTables = [
        { table: db.clientes, name: 'clientes' },
        { table: db.expenses, name: 'expenses' },
        { table: db.debts, name: 'debts' },
        { table: db.replenishments, name: 'replenishments' },
      ];
      for (const t of smallTables) {
        try {
          const rows = await fetchAll((from, to) => assertSupabase()
            .from(t.name).select('*').eq('business_id', businessId)
            .order('id', { ascending: true }).range(from, to));
          await safeSyncTable(t.table, rows, (item) => pendingIds.has(item.id), belongsToBiz);
        } catch (err) {
          console.warn(`syncEngine: no se pudo sincronizar ${t.name}:`, err);
        }
      }
      try {
        const ids = await fetchAll((from, to) => assertSupabase()
          .from('products').select('id').eq('business_id', businessId)
          .order('id', { ascending: true }).range(from, to));
        await reconcileDeletes(db.products, businessId, ids, (item) => pendingIds.has(item.id));
      } catch (err) {
        console.warn('syncEngine: reconciliación de products falló:', err);
      }
      stampPatch.full_at = new Date().toISOString();
    }

    await saveSyncState(businessId, stampPatch);

    // Broadcast cache sync event to refresh local service views without circular imports
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tuganancia-cache-synced', { detail: { businessId } }));
    }
  } catch (err) {
    console.error('Error synchronizing local cache from server:', err);
  }
}
