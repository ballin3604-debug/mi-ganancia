import { describe, it, expect, vi, afterEach } from 'vitest';

// Valores sintéticos: no son credenciales ni proyectos reales.
const SYNTHETIC_URL = 'https://s7t4g1n9r2e5f8a3c6b0.supabase.co';
const SYNTHETIC_KEY = 'synthetic-anon-key-not-a-real-credential';

async function loadSupabaseClient({ environment, createClient }) {
  vi.resetModules();
  vi.doMock('@supabase/supabase-js', () => ({ createClient }));
  vi.doMock('../config/environment', () => environment);
  return import('./supabaseClient');
}

afterEach(() => {
  vi.doUnmock('@supabase/supabase-js');
  vi.doUnmock('../config/environment');
  vi.resetModules();
});

describe('supabaseClient environment guard', () => {
  it('does not create a client when the environment guard failed', async () => {
    const createClient = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const client = await loadSupabaseClient({
      environment: {
        SUPABASE_URL: SYNTHETIC_URL,
        SUPABASE_ANON_KEY: SYNTHETIC_KEY,
        IS_STAGING: true,
        IS_SUPABASE_ENV_VALID: false,
        ENVIRONMENT_ERROR: 'El proyecto Supabase no coincide: ref sintético.',
      },
      createClient,
    });

    expect(client.isSupabaseConfigured).toBe(false);
    expect(client.supabase).toBeNull();
    expect(client.supabaseConfigError).toContain('no coincide');
    expect(createClient).not.toHaveBeenCalled();
    expect(() => client.assertSupabase()).toThrow('no coincide');
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('No se creó el cliente')
    );

    consoleError.mockRestore();
  });

  it('creates the client only when URL, key and environment are valid', async () => {
    const fakeClient = { from: vi.fn() };
    const createClient = vi.fn(() => fakeClient);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const client = await loadSupabaseClient({
      environment: {
        SUPABASE_URL: SYNTHETIC_URL,
        SUPABASE_ANON_KEY: SYNTHETIC_KEY,
        IS_STAGING: true,
        IS_SUPABASE_ENV_VALID: true,
        ENVIRONMENT_ERROR: '',
      },
      createClient,
    });

    expect(client.isSupabaseConfigured).toBe(true);
    expect(client.supabase).toBe(fakeClient);
    expect(client.supabaseConfigError).toBe('');
    expect(createClient).toHaveBeenCalledWith(SYNTHETIC_URL, SYNTHETIC_KEY);
    expect(consoleError).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it('does not create a client when URL or anon key is missing', async () => {
    const createClient = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const client = await loadSupabaseClient({
      environment: {
        SUPABASE_URL: '',
        SUPABASE_ANON_KEY: SYNTHETIC_KEY,
        IS_STAGING: false,
        IS_SUPABASE_ENV_VALID: true,
        ENVIRONMENT_ERROR: '',
      },
      createClient,
    });

    expect(client.isSupabaseConfigured).toBe(false);
    expect(client.supabase).toBeNull();
    expect(client.supabaseConfigError).toContain('VITE_SUPABASE_URL');
    expect(createClient).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
