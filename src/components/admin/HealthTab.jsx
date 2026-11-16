import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getWatchdogSnapshot, PROBE_INTERVAL_MS } from '../../services/healthWatchdog';
import {
  evaluateInfraHealth,
  evaluateBusinessHealth,
  overallHealth,
  formatRelativeTime,
  formatLatency,
  formatBytes,
} from '../../utils/healthStatus';
import { AppIcon } from '../icons';

const TONES = {
  ok: { bg: 'var(--mg-success-bg)', text: 'var(--mg-success-text)', border: 'var(--mg-success-border)' },
  warning: { bg: 'var(--mg-warning-bg)', text: 'var(--mg-warning-text)', border: 'var(--mg-warning-border)' },
  critical: { bg: 'var(--mg-danger-bg)', text: 'var(--mg-danger)', border: 'var(--mg-danger-border)' },
  idle: { bg: 'var(--mg-bg-elevated)', text: 'var(--mg-text-muted)', border: 'var(--mg-border)' },
};

const LEVEL_RANK = { critical: 0, warning: 1, idle: 2, ok: 3 };

function plural(count, singular, pluralWord) {
  return `${count} ${count === 1 ? singular : pluralWord}`;
}

function tone(level) {
  return TONES[level] || TONES.idle;
}

function ToneBadge({ level, children }) {
  const style = tone(level);
  return (
    <span
      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide"
      style={{ background: style.bg, color: style.text }}
    >
      {children}
    </span>
  );
}

function ProbeBars({ probes, source }) {
  const list = useMemo(
    () => (probes || []).filter((probe) => probe.source === source).slice(0, 36).reverse(),
    [probes, source],
  );

  if (list.length === 0) {
    return (
      <div className="flex h-8 items-center text-[10px] text-[var(--mg-text-faint)]">
        Sin historial todavía
      </div>
    );
  }

  return (
    <div className="flex h-8 items-end gap-[2px]" aria-hidden="true">
      {list.map((probe, index) => {
        const ms = Number(probe.latency_ms) || 0;
        const height = probe.ok ? Math.min(28, Math.max(5, Math.round((ms / 2000) * 28) + 5)) : 28;
        const color = !probe.ok
          ? 'var(--mg-danger)'
          : ms >= 3000
            ? 'var(--mg-danger)'
            : ms >= 1200
              ? 'var(--mg-warning)'
              : 'var(--mg-success)';
        const title = `${new Date(probe.created_at).toLocaleString('es-BO')} · ${
          probe.ok ? formatLatency(probe.latency_ms) : `falló${probe.status_code ? ` (HTTP ${probe.status_code})` : ''}`
        }`;
        return (
          <div
            key={index}
            title={title}
            className="flex-1 rounded-t-sm"
            style={{ height, background: color, opacity: probe.ok ? 0.85 : 1 }}
          />
        );
      })}
    </div>
  );
}

function InfraCard({ title, subtitle, icon, state, avgMs, okRate, probes, source }) {
  const style = tone(state.level);
  return (
    <div
      className="rounded-2xl border-2 p-3.5 shadow-sm"
      style={{ borderColor: style.border, background: 'var(--mg-bg-surface)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
            style={{ background: style.bg, color: style.text }}
          >
            <AppIcon name={icon} size={17} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-[var(--mg-text-primary)]">{title}</p>
            <p className="truncate text-[10px] text-[var(--mg-text-faint)]">{subtitle}</p>
          </div>
        </div>
        <ToneBadge level={state.level}>{state.label}</ToneBadge>
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--mg-text-faint)]">Latencia ahora</p>
          <p className="text-xl font-black text-[var(--mg-text-primary)]">
            {formatLatency(state.latest?.latency_ms)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--mg-text-faint)]">Promedio 24 h</p>
          <p className="text-sm font-bold text-[var(--mg-text-secondary)]">{formatLatency(avgMs)}</p>
        </div>
      </div>

      <div className="mt-2">
        <ProbeBars probes={probes} source={source} />
      </div>

      <div className="mt-1.5 flex items-center justify-between text-[10px] text-[var(--mg-text-faint)]">
        <span>
          Disponibilidad 24 h: <b className="text-[var(--mg-text-secondary)]">{okRate === null || okRate === undefined ? '—' : `${okRate}%`}</b>
        </span>
        <span>{state.latest ? formatRelativeTime(state.latest.created_at) : 'Sin mediciones'}</span>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] px-2.5 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--mg-text-faint)]">{label}</p>
      <p className="text-base font-black text-[var(--mg-text-primary)]">{value}</p>
      {hint && <p className="text-[10px] text-[var(--mg-text-faint)]">{hint}</p>}
    </div>
  );
}

function BusinessCard({ row, now }) {
  const state = evaluateBusinessHealth(row, now);
  const style = tone(state.level);
  const plan = row.plan_id === 'premium' ? 'Premium' : row.plan_id === 'free' ? 'Gratis' : 'Pro';
  const pending = Number(row.pending_ops) || 0;
  const errors = Number(row.error_ops) || 0;

  return (
    <div
      className="space-y-2.5 rounded-2xl border-2 p-3.5 shadow-sm"
      style={{ borderColor: style.border, background: 'var(--mg-bg-surface)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-[var(--mg-text-primary)]">{row.business_name}</p>
          <p className="truncate text-[10px] text-[var(--mg-text-faint)]">
            {plan} · {plural(Number(row.users_count) || 0, 'usuario', 'usuarios')} · {plural(Number(row.products_count) || 0, 'producto', 'productos')}
            {row.business_status === 'suspended' ? ' · Suspendido' : ''}
          </p>
        </div>
        <ToneBadge level={state.level}>{state.label}</ToneBadge>
      </div>

      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--mg-text-faint)]">Ventas 24 h</p>
          <p className="text-sm font-bold text-[var(--mg-text-primary)]">{row.sales_24h || 0}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--mg-text-faint)]">Última venta</p>
          <p className="text-sm font-bold text-[var(--mg-text-primary)]">{formatRelativeTime(row.last_sale_at, now)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--mg-text-faint)]">Equipos en línea</p>
          <p className="text-sm font-bold text-[var(--mg-text-primary)]">
            {row.devices_online || 0}/{row.devices_total || 0}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--mg-text-faint)]">Último contacto</p>
          <p className="text-sm font-bold text-[var(--mg-text-primary)]">{formatRelativeTime(row.last_seen_at, now)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--mg-text-faint)]">Supabase</p>
          <p className="text-sm font-bold text-[var(--mg-text-primary)]">{formatLatency(row.avg_supabase_latency_ms)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--mg-text-faint)]">Firebase Hosting</p>
          <p className="text-sm font-bold text-[var(--mg-text-primary)]">{formatLatency(row.avg_firebase_latency_ms)}</p>
        </div>
      </div>

      {(pending > 0 || errors > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {pending > 0 && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ background: 'var(--mg-warning-bg)', color: 'var(--mg-warning-text)' }}
            >
              {pending} por sincronizar
            </span>
          )}
          {errors > 0 && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ background: 'var(--mg-danger-bg)', color: 'var(--mg-danger)' }}
            >
              {errors} con error
            </span>
          )}
        </div>
      )}

      {row.last_error && (
        <p
          className="break-words rounded-lg px-2 py-1.5 text-[11px] leading-snug"
          style={{ background: 'var(--mg-danger-bg)', color: 'var(--mg-danger)' }}
        >
          <b>Último error:</b> {row.last_error}
        </p>
      )}

      {state.level !== 'ok' && state.reasons.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-[var(--mg-text-muted)]">
          {state.reasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      )}
    </div>
  );
}

export default function HealthTab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [now, setNow] = useState(() => Date.now());
  const busyRef = useRef(false);

  const refresh = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setRefreshing(true);
    try {
      const snapshot = await getWatchdogSnapshot();
      setData(snapshot);
      setError('');
    } catch (err) {
      setError(err?.message || 'No se pudo consultar el estado del sistema.');
    } finally {
      busyRef.current = false;
      setRefreshing(false);
      setNow(Date.now());
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(() => {
      if (typeof document === 'undefined' || !document.hidden) refresh();
    }, PROBE_INTERVAL_MS);
    const handleVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) refresh();
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }
    return () => {
      clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, [refresh]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(interval);
  }, []);

  const infra = useMemo(() => {
    const history = data?.history || [];
    return {
      supabase: evaluateInfraHealth(history, 'supabase', now),
      firebase: evaluateInfraHealth(history, 'firebase', now),
    };
  }, [data, now]);

  const overall = useMemo(
    () => overallHealth(infra, data?.businesses || [], now),
    [infra, data, now],
  );

  const rows = useMemo(() => {
    return (data?.businesses || [])
      .map((row) => ({ row, state: evaluateBusinessHealth(row, now) }))
      .sort((a, b) => {
        const rank = LEVEL_RANK[a.state.level] - LEVEL_RANK[b.state.level];
        if (rank !== 0) return rank;
        const errors = (Number(b.row.error_ops) || 0) - (Number(a.row.error_ops) || 0);
        if (errors !== 0) return errors;
        const pending = (Number(b.row.pending_ops) || 0) - (Number(a.row.pending_ops) || 0);
        if (pending !== 0) return pending;
        return String(a.row.business_name || '').localeCompare(String(b.row.business_name || ''));
      });
  }, [data, now]);

  const issues = rows.filter((entry) => entry.state.level === 'critical' || entry.state.level === 'warning');
  const idle = rows.filter((entry) => entry.state.level === 'idle');
  const shown = filter === 'issues' ? issues : filter === 'idle' ? idle : rows;
  const overallStyle = tone(overall.level);
  const platform = data?.platform || {};

  if (!data && !error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-14 text-[var(--mg-text-faint)]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--mg-accent)] border-t-transparent" />
        <p className="text-sm font-semibold">El Vigía está midiendo Supabase y Firebase…</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Encabezado del vigía */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--mg-brand)] text-[var(--mg-brand-contrast)]">
            <AppIcon name="perro" size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-base font-black text-[var(--mg-text-primary)]">Vigía de la app</p>
            <p className="text-[11px] text-[var(--mg-text-faint)]">
              Supabase y Firebase por negocio · {data ? `actualizado ${formatRelativeTime(data.fetchedAt, now)}` : `revisa cada ${Math.round(PROBE_INTERVAL_MS / 1000)} s`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-xl border-2 border-[var(--mg-border)] bg-[var(--mg-bg-surface)] px-3 py-2 text-xs font-bold text-[var(--mg-text-secondary)] active:scale-95 disabled:opacity-50"
        >
          <AppIcon name="sincronizar" size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Midiendo' : 'Probar'}
        </button>
      </div>

      {error && (
        <div
          className="rounded-2xl border-2 p-3.5"
          style={{ background: 'var(--mg-danger-bg)', borderColor: 'var(--mg-danger-border)', color: 'var(--mg-danger)' }}
        >
          <p className="text-sm font-black">El Vigía no pudo leer el estado</p>
          <p className="mt-1 text-xs break-words">{error}</p>
          <button
            type="button"
            onClick={refresh}
            className="mt-2 rounded-xl bg-[var(--mg-danger)] px-3 py-1.5 text-xs font-bold text-white active:scale-95"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Semáforo general */}
      {data && (
        <div
          className="flex items-center gap-3 rounded-2xl border-2 p-3.5"
          style={{ background: overallStyle.bg, borderColor: overallStyle.border }}
        >
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: 'var(--mg-bg-surface)', color: overallStyle.text }}
          >
            <AppIcon name={overall.level === 'ok' ? 'ok' : 'alerta'} size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black" style={{ color: overallStyle.text }}>{overall.label}</p>
            <p className="text-[11px] leading-snug" style={{ color: overallStyle.text, opacity: 0.85 }}>
              {overall.criticalBusinesses > 0
                ? `${plural(overall.criticalBusinesses, 'negocio', 'negocios')} con problemas críticos.`
                : overall.warningBusinesses > 0
                  ? overall.warningBusinesses === 1
                    ? '1 negocio necesita atención.'
                    : `${overall.warningBusinesses} negocios necesitan atención.`
                  : 'Ningún negocio con errores de sincronización.'}
              {' '}Supabase: {infra.supabase.label.toLowerCase()} · Firebase: {infra.firebase.label.toLowerCase()}.
            </p>
          </div>
          <ToneBadge level={overall.level}>
            {overall.level === 'critical' ? 'Crítico' : overall.level === 'warning' ? 'Atención' : overall.level === 'ok' ? 'Sano' : 'Sin datos'}
          </ToneBadge>
        </div>
      )}

      {/* Infraestructura */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <InfraCard
          title="Supabase"
          subtitle="Base de datos y API"
          icon="rayo"
          state={infra.supabase}
          avgMs={platform.supabase_avg_ms}
          okRate={platform.supabase_ok_rate}
          probes={data?.history || []}
          source="supabase"
        />
        <InfraCard
          title="Firebase Hosting"
          subtitle="Sitio y PWA"
          icon="tienda"
          state={infra.firebase}
          avgMs={platform.firebase_avg_ms}
          okRate={platform.firebase_ok_rate}
          probes={data?.history || []}
          source="firebase"
        />
      </div>

      {/* Resumen global */}
      {data && (
        <div className="grid grid-cols-3 gap-2">
          <SummaryStat
            label="Base de datos"
            value={formatBytes(platform.database_size_bytes)}
            hint="Tamaño en Supabase"
          />
          <SummaryStat
            label="Negocios"
            value={`${platform.businesses_active || 0}/${platform.businesses_total || 0}`}
            hint="Activos / total"
          />
          <SummaryStat
            label="Equipos en línea"
            value={platform.devices_online || 0}
            hint="Últimos 5 min"
          />
          <SummaryStat
            label="Ventas 24 h"
            value={platform.sales_24h || 0}
            hint="Todos los negocios"
          />
          <SummaryStat
            label="Por sincronizar"
            value={platform.pending_ops || 0}
            hint="En todos los equipos"
          />
          <SummaryStat
            label="Con error"
            value={platform.error_ops || 0}
            hint="Cola trabada"
          />
        </div>
      )}

      {/* Negocios */}
      <div className="space-y-2">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-sm font-black text-[var(--mg-text-primary)]">Rendimiento por negocio</p>
            <p className="text-[11px] text-[var(--mg-text-faint)]">
              {plural(rows.length, 'negocio', 'negocios')} · ordenados por riesgo
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {[
            { key: 'all', label: `Todos (${rows.length})` },
            { key: 'issues', label: `Problemas (${issues.length})` },
            { key: 'idle', label: `Sin reportes (${idle.length})` },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setFilter(option.key)}
              className={`flex-1 rounded-lg py-1.5 text-[11px] font-bold transition-all ${
                filter === option.key
                  ? 'bg-[var(--mg-text-primary)] text-white'
                  : 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="py-10 text-center text-[var(--mg-text-faint)]">
            <AppIcon name="perro" size={36} className="mx-auto mb-3" />
            <p className="font-semibold">Todavía no hay negocios para vigilar</p>
          </div>
        ) : shown.length === 0 ? (
          <div className="py-10 text-center text-[var(--mg-text-faint)]">
            <AppIcon name="ok" size={36} className="mx-auto mb-3" />
            <p className="font-semibold">
              {filter === 'issues' ? 'Ningún negocio con problemas ahora' : 'Todos los negocios ya reportaron'}
            </p>
          </div>
        ) : (
          shown.map((entry) => (
            <BusinessCard key={entry.row.business_id} row={entry.row} now={now} />
          ))
        )}
      </div>

      <div className="rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-section)] p-3">
        <p className="text-[11px] leading-relaxed text-[var(--mg-text-muted)]">
          <b className="text-[var(--mg-text-secondary)]">Cómo funciona:</b> este panel mide Supabase y Firebase
          Hosting cada {Math.round(PROBE_INTERVAL_MS / 1000)} s desde tu equipo. Además, cada dispositivo envía un
          latido cada 2 min con su cola de sincronización y la latencia que está viendo. Si un negocio acumula
          errores o deja de reportar, aparece primero en la lista. Firebase se usa solo para Hosting: la app ya no
          guarda datos en Firestore.
        </p>
      </div>
    </div>
  );
}
