import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import HealthTab from './HealthTab';
import { getWatchdogSnapshot } from '../../services/healthWatchdog';

vi.mock('../../services/healthWatchdog', () => ({
  PROBE_INTERVAL_MS: 45000,
  getWatchdogSnapshot: vi.fn(),
}));

function iso(minutesAgo = 0) {
  return new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
}

describe('HealthTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWatchdogSnapshot.mockResolvedValue({
      fetchedAt: new Date().toISOString(),
      probes: [],
      platform: {
        database_size_bytes: 25 * 1024 * 1024,
        businesses_total: 2,
        businesses_active: 2,
        users_total: 5,
        devices_online: 2,
        pending_ops: 3,
        error_ops: 1,
        sales_24h: 14,
        supabase_avg_ms: 240,
        supabase_ok_rate: 100,
        firebase_avg_ms: 90,
        firebase_ok_rate: 100,
      },
      history: [
        { source: 'supabase', ok: true, latency_ms: 240, status_code: 200, created_at: iso(1) },
        { source: 'firebase', ok: true, latency_ms: 90, status_code: 200, created_at: iso(1) },
      ],
      businesses: [
        {
          business_id: 'biz-1',
          business_name: 'Tienda Centro',
          business_status: 'active',
          plan_id: 'pro',
          users_count: 2,
          products_count: 30,
          sales_24h: 10,
          sales_7d: 60,
          last_sale_at: iso(5),
          devices_total: 2,
          devices_online: 1,
          pending_ops: 3,
          error_ops: 1,
          avg_supabase_latency_ms: 260,
          avg_firebase_latency_ms: 100,
          last_seen_at: iso(1),
          last_sync_at: iso(2),
          last_error: 'No se pudo sincronizar una venta.',
          last_error_at: iso(1),
        },
        {
          business_id: 'biz-2',
          business_name: 'Licorería Sur',
          business_status: 'active',
          plan_id: 'premium',
          users_count: 3,
          products_count: 50,
          sales_24h: 4,
          sales_7d: 20,
          last_sale_at: iso(20),
          devices_total: 1,
          devices_online: 1,
          pending_ops: 0,
          error_ops: 0,
          avg_supabase_latency_ms: 180,
          avg_firebase_latency_ms: 85,
          last_seen_at: iso(2),
          last_sync_at: iso(2),
          last_error: null,
          last_error_at: null,
        },
      ],
    });
  });

  it('muestra el semáforo, la infraestructura y los negocios', async () => {
    render(<HealthTab />);

    const title = await screen.findByText('Vigía de la app');
    expect(title).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Tienda Centro')).toBeTruthy());

    expect(screen.getAllByText('Supabase').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Firebase Hosting').length).toBeGreaterThan(0);
    expect(screen.getByText('Rendimiento por negocio')).toBeTruthy();
    expect(screen.getByText('Licorería Sur')).toBeTruthy();
    expect(screen.getByText('No se pudo sincronizar una venta.')).toBeTruthy();
    expect(screen.getAllByText('Crítico').length).toBeGreaterThan(0);
  });

  it('avisa cuando una métrica no se pudo leer pero mantiene el panel', async () => {
    getWatchdogSnapshot.mockResolvedValueOnce({
      fetchedAt: new Date().toISOString(),
      probes: [],
      platform: null,
      history: [],
      businesses: [],
      warning: 'column reference "pending_ops" is ambiguous',
    });

    render(<HealthTab />);

    expect(await screen.findByText('Algunas métricas no se pudieron leer')).toBeTruthy();
    expect(screen.getByText(/pending_ops/)).toBeTruthy();
    expect(screen.getByText('Rendimiento por negocio')).toBeTruthy();
  });
});
