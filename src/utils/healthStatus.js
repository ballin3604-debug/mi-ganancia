const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

export const INFRA_WARNING_MS = 1200;
export const INFRA_CRITICAL_MS = 3000;
export const BUSINESS_WARNING_MS = 1500;
export const BUSINESS_CRITICAL_MS = 3000;

function toTime(value) {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

export function minutesSince(value, now = Date.now()) {
  const time = toTime(value);
  if (time === null) return null;
  return Math.max(0, Math.floor((now - time) / MINUTE_MS));
}

export function formatRelativeTime(value, now = Date.now()) {
  const minutes = minutesSince(value, now);
  if (minutes === null) return '—';
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} d`;
  const date = new Date(toTime(value));
  return date.toLocaleDateString('es-BO', { day: 'numeric', month: 'short' });
}

export function formatLatency(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value <= 0) return '—';
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

export function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '—';
  const mb = value / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function levelRank(level) {
  return { ok: 0, idle: 1, warning: 2, critical: 3 }[level] ?? 0;
}

function higherLevel(a, b) {
  return levelRank(a) >= levelRank(b) ? a : b;
}

function sortedByDate(probes) {
  return [...(probes || [])].sort(
    (a, b) => (toTime(b?.created_at) || 0) - (toTime(a?.created_at) || 0),
  );
}

// Evalúa las sondas de un servicio ('supabase' o 'firebase') tomando la
// última medición y un promedio corto. Una sonda fallida es crítica; la
// lentitud sostenida sube de nivel antes de que la app deje de responder.
export function evaluateInfraHealth(probes, source, now = Date.now()) {
  const list = sortedByDate((probes || []).filter((probe) => probe.source === source));
  if (list.length === 0) {
    return { level: 'idle', label: 'Sin datos', avgMs: null, successRate: null, latest: null, failures: 0 };
  }

  const latest = list[0];
  const recent = list.slice(0, 10);
  const successful = recent.filter((probe) => probe.ok);
  const avgMs = successful.length
    ? Math.round(successful.reduce((sum, probe) => sum + (Number(probe.latency_ms) || 0), 0) / successful.length)
    : null;
  const failures = recent.length - successful.length;
  const successRate = recent.length ? Math.round((successful.length / recent.length) * 100) : null;

  let level = 'ok';
  let label = 'Operativo';

  if (!latest.ok) {
    level = 'critical';
    label = 'Sin respuesta';
  } else if (avgMs !== null && avgMs >= INFRA_CRITICAL_MS) {
    level = 'critical';
    label = 'Muy lento';
  } else if ((avgMs !== null && avgMs >= INFRA_WARNING_MS) || failures >= 3) {
    level = 'warning';
    label = 'Lento';
  }

  if (level !== 'ok' && failures > 0 && latest.ok) {
    label = 'Inestable';
  }

  return {
    level,
    label,
    avgMs,
    successRate,
    latest,
    failures,
    lastOkAt: successful[0]?.created_at || null,
  };
}

// Salud operativa de un negocio según lo que reportan sus equipos.
// No exige que haya gente conectada de madrugada: "sin equipos ahora" es un
// aviso, no una caída. Los errores de sincronización sí son críticos porque
// el negocio puede estar vendiendo sin que sus datos lleguen a Supabase.
export function evaluateBusinessHealth(row, now = Date.now()) {
  const totalDevices = Number(row?.devices_total) || 0;
  const onlineDevices = Number(row?.devices_online) || 0;
  const pending = Number(row?.pending_ops) || 0;
  const errors = Number(row?.error_ops) || 0;
  const supabaseMs = Number(row?.avg_supabase_latency_ms) || 0;
  const firebaseMs = Number(row?.avg_firebase_latency_ms) || 0;
  const reasons = [];

  if (totalDevices === 0) {
    return {
      level: 'idle',
      label: 'Sin reportes',
      reasons: ['Ningún equipo de este negocio reportó estado todavía.'],
      pending,
      errors,
    };
  }

  let level = 'ok';

  if (errors > 0) {
    level = 'critical';
    reasons.push(
      `${errors} ${errors === 1 ? 'operación con error de sincronización' : 'operaciones con error de sincronización'}.`,
    );
  }

  if (supabaseMs >= BUSINESS_CRITICAL_MS || firebaseMs >= BUSINESS_CRITICAL_MS) {
    level = 'critical';
    reasons.push('Latencia muy alta en la conexión de sus equipos.');
  } else if (supabaseMs >= BUSINESS_WARNING_MS || firebaseMs >= BUSINESS_WARNING_MS) {
    level = higherLevel(level, 'warning');
    reasons.push('Conexión lenta en sus equipos.');
  }

  if (pending > 0) {
    level = higherLevel(level, 'warning');
    reasons.push(
      `${pending} ${pending === 1 ? 'operación esperando sincronizar' : 'operaciones esperando sincronizar'}.`,
    );
  }

  if (onlineDevices === 0) {
    level = higherLevel(level, 'warning');
    reasons.push('Ningún equipo conectado en los últimos 5 minutos.');
  }

  const lastSaleMinutes = minutesSince(row?.last_sale_at, now);
  if (lastSaleMinutes !== null && lastSaleMinutes >= 48 * 60) {
    const days = Math.floor(lastSaleMinutes / 1440);
    reasons.push(`Sin ventas hace ${days} ${days === 1 ? 'día' : 'días'}.`);
  }

  const labels = { ok: 'Sano', warning: 'Atención', critical: 'Crítico' };
  return {
    level,
    label: labels[level],
    reasons,
    pending,
    errors,
  };
}

export function overallHealth(infra, businesses, now = Date.now()) {
  const sources = [infra?.supabase, infra?.firebase].filter(Boolean);
  const states = (businesses || []).map((row) => evaluateBusinessHealth(row, now));
  const criticalBusinesses = states.filter((state) => state.level === 'critical').length;
  const warningBusinesses = states.filter((state) => state.level === 'warning').length;

  let level = 'ok';
  sources.forEach((source) => {
    level = higherLevel(level, source.level);
  });
  if (criticalBusinesses > 0) level = higherLevel(level, 'critical');
  else if (warningBusinesses > 0) level = higherLevel(level, 'warning');

  if (level === 'ok' && sources.every((source) => source.level === 'idle') && states.length === 0) {
    level = 'idle';
  }

  const labels = {
    ok: 'Todo en orden',
    warning: 'Atención',
    critical: 'Hay problemas',
    idle: 'Sin datos todavía',
  };

  return {
    level,
    label: labels[level],
    criticalBusinesses,
    warningBusinesses,
    totalBusinesses: states.length,
  };
}
