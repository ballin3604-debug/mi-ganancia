import { assertSupabase, isSupabaseConfigured } from './supabaseClient';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/environment';
import { getDeviceId, getSyncHealthSnapshot } from './syncEngine';
import { withTimeout } from '../utils/withTimeout';

const PROBE_TIMEOUT_MS = 8000;
const RPC_TIMEOUT_MS = 12000;
export const PROBE_INTERVAL_MS = 45 * 1000;
const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000;
const HEARTBEAT_INITIAL_DELAY_MS = 6000;
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '';
const HISTORY_LIMIT = 160;

let heartbeatDisabled = false;

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function cleanError(err) {
  if (!err) return '';
  if (typeof err === 'string') return err.slice(0, 300);
  return String(err.message || err.error_description || err.details || err).slice(0, 300);
}

function isMissingMigrationError(err) {
  const msg = String((err?.message || '') + ' ' + (err?.hint || '')).toLowerCase();
  return err?.code === 'PGRST202'
    || err?.code === '42883'
    || msg.includes('could not find the function')
    || msg.includes('no existe la función')
    || msg.includes('does not exist');
}

async function fetchWithTimeout(url, options = {}, timeoutMs = PROBE_TIMEOUT_MS) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    return await fetch(url, {
      ...options,
      signal: controller ? controller.signal : undefined,
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function buildProbe(source, startedAt, ok, statusCode, error = '') {
  return {
    source,
    ok: Boolean(ok),
    latencyMs: Math.max(0, Math.round(nowMs() - startedAt)),
    statusCode: statusCode || null,
    error: error || '',
    created_at: new Date().toISOString(),
  };
}

// Sonda liviana al API REST de Supabase (mismo camino que usan las consultas
// de la app: CDN + PostgREST + RLS). No descarga filas: usa HEAD.
export async function probeSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return {
      source: 'supabase',
      ok: false,
      latencyMs: null,
      statusCode: null,
      error: 'Falta configuración de Supabase.',
      created_at: new Date().toISOString(),
    };
  }

  const baseUrl = SUPABASE_URL.replace(/\/+$/, '');
  const started = nowMs();
  try {
    const response = await fetchWithTimeout(`${baseUrl}/rest/v1/businesses?select=id&limit=1`, {
      method: 'HEAD',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      cache: 'no-store',
    });
    return buildProbe(
      'supabase',
      started,
      response.ok,
      response.status,
      response.ok ? '' : `HTTP ${response.status}`,
    );
  } catch (err) {
    return buildProbe('supabase', started, false, null, cleanError(err) || 'Sin respuesta');
  }
}

// Sonda al hosting de Firebase: pide el index.html real sin caché (HEAD).
// Mide la misma CDN que sirve la PWA, no solo la conexión local.
export async function probeFirebaseHosting() {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return {
      source: 'firebase',
      ok: false,
      latencyMs: null,
      statusCode: null,
      error: 'Sin origen web para medir Firebase Hosting.',
      created_at: new Date().toISOString(),
    };
  }

  const started = nowMs();
  try {
    const url = `${window.location.origin}/index.html?mg_health=${Date.now()}`;
    const response = await fetchWithTimeout(url, {
      method: 'HEAD',
      cache: 'no-store',
    });
    return buildProbe(
      'firebase',
      started,
      response.ok,
      response.status,
      response.ok ? '' : `HTTP ${response.status}`,
    );
  } catch (err) {
    return buildProbe('firebase', started, false, null, cleanError(err) || 'Sin respuesta');
  }
}

async function persistProbe(probe) {
  const { error } = await withTimeout(
    assertSupabase().rpc('record_health_probe', {
      p_source: probe.source,
      p_ok: probe.ok,
      p_latency_ms: probe.latencyMs,
      p_status_code: probe.statusCode,
      p_error: probe.error || null,
    }),
    RPC_TIMEOUT_MS,
    'Timeout registrando la sonda de salud.',
  );
  if (error) throw error;
}

export async function runInfraProbes() {
  const probes = await Promise.all([probeSupabase(), probeFirebaseHosting()]);
  await Promise.allSettled(probes.map((probe) => persistProbe(probe)));
  return probes;
}

export async function getBusinessHealth() {
  const { data, error } = await withTimeout(
    assertSupabase().rpc('admin_business_health'),
    RPC_TIMEOUT_MS,
    'Supabase tardó demasiado en responder.',
  );
  if (error) throw error;
  return data || [];
}

export async function getPlatformHealth() {
  const { data, error } = await withTimeout(
    assertSupabase().rpc('admin_platform_health'),
    RPC_TIMEOUT_MS,
    'Supabase tardó demasiado en responder.',
  );
  if (error) throw error;
  return (data || [])[0] || null;
}

export async function getProbeHistory(limit = HISTORY_LIMIT) {
  const { data, error } = await withTimeout(
    assertSupabase()
      .from('health_probes')
      .select('source,ok,latency_ms,status_code,error,created_at')
      .order('created_at', { ascending: false })
      .limit(limit),
    RPC_TIMEOUT_MS,
    'Supabase tardó demasiado en responder.',
  );
  if (error) throw error;
  return data || [];
}

export async function getWatchdogSnapshot() {
  const [probesResult, businessesResult, platformResult] = await Promise.allSettled([
    runInfraProbes(),
    getBusinessHealth(),
    getPlatformHealth(),
  ]);

  const failures = [probesResult, businessesResult, platformResult]
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason);

  if (failures.some(isMissingMigrationError)) {
    throw new Error('Falta aplicar la migración del Vigía en Supabase (npx supabase db push).');
  }
  if (failures.length === 3) {
    throw failures[0];
  }

  const probes = probesResult.status === 'fulfilled' ? probesResult.value : [];
  const businesses = businessesResult.status === 'fulfilled' ? businessesResult.value : [];
  const platform = platformResult.status === 'fulfilled' ? platformResult.value : null;

  let history = [];
  try {
    history = await getProbeHistory();
  } catch {
    history = probes;
  }

  return {
    probes,
    businesses,
    platform,
    history,
    warning: failures.map(cleanError).filter(Boolean).join(' · '),
    fetchedAt: new Date().toISOString(),
  };
}

function getPlatformLabel() {
  if (typeof window === 'undefined') return '';
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) return 'pwa';
  } catch { /* sin matchMedia */ }
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || '') ? 'movil' : 'escritorio';
}

// Latido silencioso de cada equipo. No bloquea la app: si la RPC no existe
// todavía o falla la red, solo se registra una advertencia y se sigue.
export function startClientHealthReporter({ businessId }) {
  if (!businessId || !isSupabaseConfigured) return () => {};
  let stopped = false;
  let timer = null;

  async function send() {
    if (stopped || heartbeatDisabled) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    const deviceId = getDeviceId();
    if (!deviceId) return;

    const [supabaseProbe, firebaseProbe, syncHealth] = await Promise.all([
      probeSupabase(),
      probeFirebaseHosting(),
      getSyncHealthSnapshot(businessId).catch(() => null),
    ]);
    if (stopped || heartbeatDisabled) return;

    try {
      const { error } = await withTimeout(
        assertSupabase().rpc('report_client_health', {
          p_device_id: deviceId,
          p_platform: getPlatformLabel(),
          p_app_version: APP_VERSION,
          p_online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
          p_pending_ops: syncHealth?.pendingCount || 0,
          p_error_ops: syncHealth?.errorCount || 0,
          p_supabase_latency_ms: supabaseProbe.ok ? supabaseProbe.latencyMs : null,
          p_firebase_latency_ms: firebaseProbe.ok ? firebaseProbe.latencyMs : null,
          p_last_sync_at: syncHealth?.lastSyncAt || null,
          p_last_error: syncHealth?.lastError || null,
        }),
        RPC_TIMEOUT_MS,
        'Timeout enviando el latido.',
      );

      if (error) {
        if (isMissingMigrationError(error)) {
          heartbeatDisabled = true;
          console.warn('Vigía: falta la migración de salud; el latido queda desactivado hasta recargar.');
        } else {
          console.warn('Vigía: no se pudo enviar el latido:', error.message || error);
        }
      }
    } catch (err) {
      console.warn('Vigía: latido omitido:', cleanError(err));
    }
  }

  const initialTimer = setTimeout(send, HEARTBEAT_INITIAL_DELAY_MS);
  timer = setInterval(send, HEARTBEAT_INTERVAL_MS);

  const handleVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') send();
  };
  const handleOnline = () => { send(); };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibility);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
  }

  return () => {
    stopped = true;
    clearTimeout(initialTimer);
    if (timer) clearInterval(timer);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibility);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline);
    }
  };
}
