import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Valores sintéticos: no son URLs ni claves reales.
const STAGING_REF = 's7t4g1n9r2e5f8a3c6b0';
const PRODUCTION_REF = 'p3r7o1d5u9c2t4i6o8n0';
const STAGING_URL = `https://${STAGING_REF}.supabase.co`;
const PRODUCTION_URL = `https://${PRODUCTION_REF}.supabase.co`;
const STAGING_KEY = 'synthetic-staging-anon-key-not-real';
const PRODUCTION_KEY = 'synthetic-production-anon-key-not-real';

const mocks = vi.hoisted(() => ({
  env: { url: '', key: '' },
}));

vi.mock('../config/environment', () => ({
  get SUPABASE_URL() {
    return mocks.env.url;
  },
  get SUPABASE_ANON_KEY() {
    return mocks.env.key;
  },
}));

vi.mock('./supabaseClient', () => ({
  isSupabaseConfigured: true,
  assertSupabase: () => {
    throw new Error('assertSupabase no debe usarse en checkOnlineStatus');
  },
}));

vi.mock('./localDb', () => ({
  db: {},
  generateUUID: () => 'synthetic-device-id',
}));

async function loadCheckOnlineStatus({ url, key }) {
  mocks.env = { url, key };
  vi.resetModules();
  const module = await import('./syncEngine');
  return module.checkOnlineStatus;
}

let originalOnLine;

beforeEach(() => {
  originalOnLine = navigator.onLine;
  Object.defineProperty(navigator, 'onLine', {
    value: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, 'onLine', {
    value: originalOnLine,
    configurable: true,
  });
  vi.resetModules();
});

describe('checkOnlineStatus uses the selected environment', () => {
  it('pings the staging URL with the staging anon key', async () => {
    const checkOnlineStatus = await loadCheckOnlineStatus({
      url: STAGING_URL,
      key: STAGING_KEY,
    });
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchSpy);

    await expect(checkOnlineStatus()).resolves.toBe(true);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [pingUrl, options] = fetchSpy.mock.calls[0];
    expect(pingUrl).toBe(`${STAGING_URL}/rest/v1/products?select=id&limit=1`);
    expect(pingUrl).not.toContain(PRODUCTION_REF);
    expect(options.headers.apikey).toBe(STAGING_KEY);
    expect(options.headers.Authorization).toBe(`Bearer ${STAGING_KEY}`);
  });

  it('pings the production URL with the production anon key', async () => {
    const checkOnlineStatus = await loadCheckOnlineStatus({
      url: PRODUCTION_URL,
      key: PRODUCTION_KEY,
    });
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchSpy);

    await expect(checkOnlineStatus()).resolves.toBe(true);

    const [pingUrl, options] = fetchSpy.mock.calls[0];
    expect(pingUrl).toBe(`${PRODUCTION_URL}/rest/v1/products?select=id&limit=1`);
    expect(pingUrl).not.toContain(STAGING_REF);
    expect(options.headers.apikey).toBe(PRODUCTION_KEY);
    expect(options.headers.Authorization).toBe(`Bearer ${PRODUCTION_KEY}`);
  });

  it('does not ping when the selected URL or key is empty', async () => {
    const checkOnlineStatus = await loadCheckOnlineStatus({ url: '', key: '' });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(checkOnlineStatus()).resolves.toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not ping when the browser is offline', async () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    });
    const checkOnlineStatus = await loadCheckOnlineStatus({
      url: STAGING_URL,
      key: STAGING_KEY,
    });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(checkOnlineStatus()).resolves.toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
