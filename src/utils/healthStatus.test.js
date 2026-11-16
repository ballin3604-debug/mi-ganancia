import { describe, it, expect } from 'vitest';
import {
  evaluateInfraHealth,
  evaluateBusinessHealth,
  overallHealth,
  formatRelativeTime,
  formatLatency,
  formatBytes,
  minutesSince,
} from './healthStatus';

const NOW = new Date('2026-11-16T12:00:00.000Z').getTime();

function probe(source, ok, latencyMs, minutesAgo = 0) {
  return {
    source,
    ok,
    latency_ms: latencyMs,
    status_code: ok ? 200 : 503,
    created_at: new Date(NOW - minutesAgo * 60 * 1000).toISOString(),
  };
}

function business(overrides = {}) {
  return {
    business_id: 'biz-1',
    business_name: 'Tienda',
    devices_total: 2,
    devices_online: 1,
    pending_ops: 0,
    error_ops: 0,
    avg_supabase_latency_ms: 250,
    avg_firebase_latency_ms: 120,
    last_sale_at: new Date(NOW - 10 * 60 * 1000).toISOString(),
    last_seen_at: new Date(NOW - 2 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

describe('evaluateInfraHealth', () => {
  it('sin sondas devuelve estado sin datos', () => {
    expect(evaluateInfraHealth([], 'supabase', NOW).level).toBe('idle');
  });

  it('marca crítico cuando la última sonda falló', () => {
    const state = evaluateInfraHealth([
      probe('supabase', false, null, 0),
      probe('supabase', true, 200, 1),
    ], 'supabase', NOW);
    expect(state.level).toBe('critical');
    expect(state.label).toBe('Sin respuesta');
  });

  it('marca crítico con latencia promedio muy alta', () => {
    const state = evaluateInfraHealth([
      probe('supabase', true, 4000, 0),
      probe('supabase', true, 3500, 1),
    ], 'supabase', NOW);
    expect(state.level).toBe('critical');
    expect(state.avgMs).toBe(3750);
  });

  it('marca advertencia con latencia sostenida alta', () => {
    const state = evaluateInfraHealth([
      probe('firebase', true, 1500, 0),
      probe('firebase', true, 1400, 1),
    ], 'firebase', NOW);
    expect(state.level).toBe('warning');
  });

  it('ignora sondas de otro servicio', () => {
    const state = evaluateInfraHealth([probe('firebase', true, 100, 0)], 'supabase', NOW);
    expect(state.level).toBe('idle');
  });
});

describe('evaluateBusinessHealth', () => {
  it('es sano sin pendientes ni errores', () => {
    const state = evaluateBusinessHealth(business(), NOW);
    expect(state.level).toBe('ok');
    expect(state.reasons).toEqual([]);
  });

  it('es crítico si hay operaciones con error', () => {
    const state = evaluateBusinessHealth(business({ error_ops: 2 }), NOW);
    expect(state.level).toBe('critical');
    expect(state.reasons.join(' ')).toContain('2 operaciones con error');
  });

  it('avisa cuando hay operaciones por sincronizar', () => {
    const state = evaluateBusinessHealth(business({ pending_ops: 5 }), NOW);
    expect(state.level).toBe('warning');
    expect(state.reasons.join(' ')).toContain('5 operaciones esperando');
  });

  it('avisa cuando no hay equipos conectados ahora', () => {
    const state = evaluateBusinessHealth(business({ devices_online: 0 }), NOW);
    expect(state.level).toBe('warning');
    expect(state.reasons.join(' ')).toContain('Ningún equipo');
  });

  it('queda sin reportes si nunca llegó un latido', () => {
    const state = evaluateBusinessHealth(business({ devices_total: 0, devices_online: 0 }), NOW);
    expect(state.level).toBe('idle');
  });

  it('es crítico con latencia de Supabase muy alta', () => {
    const state = evaluateBusinessHealth(business({ avg_supabase_latency_ms: 3500 }), NOW);
    expect(state.level).toBe('critical');
  });
});

describe('overallHealth', () => {
  it('hereda el peor nivel de la infraestructura', () => {
    const result = overallHealth(
      {
        supabase: { level: 'critical' },
        firebase: { level: 'ok' },
      },
      [business()],
      NOW,
    );
    expect(result.level).toBe('critical');
    expect(result.criticalBusinesses).toBe(0);
  });

  it('cuenta negocios con problemas y advertencias', () => {
    const result = overallHealth(
      {
        supabase: { level: 'ok' },
        firebase: { level: 'ok' },
      },
      [
        business({ business_id: 'a', error_ops: 1 }),
        business({ business_id: 'b', pending_ops: 2 }),
        business({ business_id: 'c' }),
      ],
      NOW,
    );
    expect(result.level).toBe('critical');
    expect(result.criticalBusinesses).toBe(1);
    expect(result.warningBusinesses).toBe(1);
  });
});

describe('formato', () => {
  it('muestra tiempos relativos legibles', () => {
    expect(formatRelativeTime(new Date(NOW - 30 * 1000).toISOString(), NOW)).toBe('ahora');
    expect(formatRelativeTime(new Date(NOW - 8 * 60 * 1000).toISOString(), NOW)).toBe('hace 8 min');
    expect(formatRelativeTime(new Date(NOW - 3 * 60 * 60 * 1000).toISOString(), NOW)).toBe('hace 3 h');
    expect(formatRelativeTime(new Date(NOW - 2 * 24 * 60 * 60 * 1000).toISOString(), NOW)).toBe('hace 2 d');
    expect(formatRelativeTime(null, NOW)).toBe('—');
  });

  it('calcula minutos y formatea latencias/bytes', () => {
    expect(minutesSince(new Date(NOW - 5 * 60 * 1000).toISOString(), NOW)).toBe(5);
    expect(formatLatency(450)).toBe('450 ms');
    expect(formatLatency(1500)).toBe('1.5 s');
    expect(formatLatency(null)).toBe('—');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe('2.00 GB');
  });
});
