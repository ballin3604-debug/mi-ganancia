import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Todos los valores son sintéticos. No son credenciales ni proyectos reales.
const STAGING_REF = 's7t4g1n9r2e5f8a3c6b0';
const PRODUCTION_REF = 'p3r7o1d5u9c2t4i6o8n0';
const STAGING_URL = `https://${STAGING_REF}.supabase.co`;
const PRODUCTION_URL = `https://${PRODUCTION_REF}.supabase.co`;
const STAGING_KEY = 'synthetic-staging-anon-key-not-real';
const PRODUCTION_KEY = [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url'),
  'synthetic-signature',
].join('.');
const STAGING_ADMIN_UID = '11111111-1111-4111-8111-111111111111';
const PRODUCTION_ADMIN_UID = '22222222-2222-4222-8222-222222222222';

const ENV_KEYS = [
  'MODE',
  'VITE_APP_ENV',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_PROJECT_REF',
  'VITE_ADMIN_UID',
  'VITE_STAGING_SUPABASE_URL',
  'VITE_STAGING_SUPABASE_ANON_KEY',
  'VITE_STAGING_SUPABASE_PROJECT_REF',
  'VITE_STAGING_ADMIN_UID',
  'VITE_PRODUCTION_SUPABASE_PROJECT_REF',
];

function productionValues(overrides = {}) {
  return {
    MODE: 'production',
    VITE_APP_ENV: 'production',
    VITE_SUPABASE_URL: PRODUCTION_URL,
    VITE_SUPABASE_ANON_KEY: PRODUCTION_KEY,
    VITE_SUPABASE_PROJECT_REF: PRODUCTION_REF,
    VITE_ADMIN_UID: PRODUCTION_ADMIN_UID,
    VITE_STAGING_SUPABASE_URL: '',
    VITE_STAGING_SUPABASE_ANON_KEY: '',
    VITE_STAGING_SUPABASE_PROJECT_REF: '',
    VITE_STAGING_ADMIN_UID: '',
    VITE_PRODUCTION_SUPABASE_PROJECT_REF: '',
    ...overrides,
  };
}

function stagingValues(overrides = {}) {
  return {
    MODE: 'staging',
    VITE_APP_ENV: 'staging',
    VITE_SUPABASE_URL: PRODUCTION_URL,
    VITE_SUPABASE_ANON_KEY: PRODUCTION_KEY,
    VITE_SUPABASE_PROJECT_REF: PRODUCTION_REF,
    VITE_ADMIN_UID: PRODUCTION_ADMIN_UID,
    VITE_STAGING_SUPABASE_URL: STAGING_URL,
    VITE_STAGING_SUPABASE_ANON_KEY: STAGING_KEY,
    VITE_STAGING_SUPABASE_PROJECT_REF: STAGING_REF,
    VITE_STAGING_ADMIN_UID: STAGING_ADMIN_UID,
    VITE_PRODUCTION_SUPABASE_PROJECT_REF: PRODUCTION_REF,
    ...overrides,
  };
}

async function loadEnvironment(values) {
  for (const key of ENV_KEYS) {
    vi.stubEnv(key, values[key] ?? '');
  }
  vi.resetModules();
  return import('./environment');
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('environment runtime selection in production', () => {
  it('exports the production values and leaves STAGING_ADMIN_UID empty', async () => {
    const env = await loadEnvironment(productionValues({
      VITE_STAGING_SUPABASE_URL: STAGING_URL,
      VITE_STAGING_SUPABASE_ANON_KEY: STAGING_KEY,
      VITE_STAGING_SUPABASE_PROJECT_REF: STAGING_REF,
      VITE_STAGING_ADMIN_UID: STAGING_ADMIN_UID,
    }));

    expect(env.BUILD_MODE).toBe('production');
    expect(env.APP_ENV).toBe('production');
    expect(env.IS_STAGING).toBe(false);
    expect(env.SUPABASE_URL).toBe(PRODUCTION_URL);
    expect(env.SUPABASE_ANON_KEY).toBe(PRODUCTION_KEY);
    expect(env.SUPABASE_PROJECT_REF).toBe(PRODUCTION_REF);
    expect(env.STAGING_ADMIN_UID).toBe('');
    expect(env.IS_SUPABASE_ENV_VALID).toBe(true);
    expect(env.ENVIRONMENT_ERROR).toBe('');
  });

  it('does not require staging-only variables', async () => {
    const env = await loadEnvironment(productionValues());

    expect(env.IS_STAGING).toBe(false);
    expect(env.IS_SUPABASE_ENV_VALID).toBe(true);
    expect(env.ENVIRONMENT_ERROR).toBe('');
    expect(env.STAGING_ADMIN_UID).toBe('');
  });

  it('rejects a non-production VITE_APP_ENV at runtime without echoing values', async () => {
    const env = await loadEnvironment(productionValues({
      VITE_APP_ENV: 'development',
    }));

    expect(env.IS_SUPABASE_ENV_VALID).toBe(false);
    expect(env.ENVIRONMENT_ERROR).toContain('VITE_APP_ENV');
    expect(env.ENVIRONMENT_ERROR).not.toContain('development');
    expect(env.ENVIRONMENT_ERROR).not.toContain(PRODUCTION_URL);
    expect(env.ENVIRONMENT_ERROR).not.toContain(PRODUCTION_KEY);
  });

  it('rejects invalid production Supabase configuration at runtime', async () => {
    const invalidUrl = 'http://synthetic-invalid.supabase.co';
    const invalidKey = 'synthetic-invalid-anon-key';
    const env = await loadEnvironment(productionValues({
      VITE_SUPABASE_URL: invalidUrl,
      VITE_SUPABASE_ANON_KEY: invalidKey,
    }));

    expect(env.IS_SUPABASE_ENV_VALID).toBe(false);
    expect(env.ENVIRONMENT_ERROR).toContain('VITE_SUPABASE_URL');
    expect(env.ENVIRONMENT_ERROR).toContain('VITE_SUPABASE_ANON_KEY');
    expect(env.ENVIRONMENT_ERROR).not.toContain(invalidUrl);
    expect(env.ENVIRONMENT_ERROR).not.toContain(invalidKey);
  });
});

describe('environment runtime selection in staging', () => {
  it('uses only the staging URL, key, ref and admin UID', async () => {
    const env = await loadEnvironment(stagingValues());

    expect(env.BUILD_MODE).toBe('staging');
    expect(env.APP_ENV).toBe('staging');
    expect(env.IS_STAGING).toBe(true);
    expect(env.SUPABASE_URL).toBe(STAGING_URL);
    expect(env.SUPABASE_ANON_KEY).toBe(STAGING_KEY);
    expect(env.SUPABASE_PROJECT_REF).toBe(STAGING_REF);
    expect(env.STAGING_ADMIN_UID).toBe(STAGING_ADMIN_UID);
    expect(env.IS_SUPABASE_ENV_VALID).toBe(true);
    expect(env.ENVIRONMENT_ERROR).toBe('');

    expect(env.SUPABASE_URL).not.toBe(PRODUCTION_URL);
    expect(env.SUPABASE_ANON_KEY).not.toBe(PRODUCTION_KEY);
    expect(env.STAGING_ADMIN_UID).not.toBe(PRODUCTION_ADMIN_UID);
  });

  it('detects staging from the Vite mode even if VITE_APP_ENV has different case or spaces', async () => {
    const env = await loadEnvironment(stagingValues({ VITE_APP_ENV: '  STAGING  ' }));

    expect(env.IS_STAGING).toBe(true);
    expect(env.SUPABASE_URL).toBe(STAGING_URL);
    expect(env.SUPABASE_ANON_KEY).toBe(STAGING_KEY);
    expect(env.STAGING_ADMIN_UID).toBe(STAGING_ADMIN_UID);
    expect(env.IS_SUPABASE_ENV_VALID).toBe(true);
  });

  it('never falls back to the shared production variables', async () => {
    const env = await loadEnvironment(stagingValues({
      VITE_STAGING_SUPABASE_URL: '',
      VITE_STAGING_SUPABASE_ANON_KEY: '',
      VITE_STAGING_SUPABASE_PROJECT_REF: '',
      VITE_STAGING_ADMIN_UID: '',
    }));

    expect(env.IS_STAGING).toBe(true);
    expect(env.SUPABASE_URL).toBe('');
    expect(env.SUPABASE_ANON_KEY).toBe('');
    expect(env.STAGING_ADMIN_UID).toBe('');
    expect(env.IS_SUPABASE_ENV_VALID).toBe(false);
    expect(env.ENVIRONMENT_ERROR).toContain('VITE_STAGING_SUPABASE_URL');
    expect(env.ENVIRONMENT_ERROR).toContain('VITE_STAGING_SUPABASE_ANON_KEY');
    expect(env.ENVIRONMENT_ERROR).toContain('VITE_STAGING_SUPABASE_PROJECT_REF');
    expect(env.ENVIRONMENT_ERROR).not.toContain(PRODUCTION_KEY);
    expect(env.ENVIRONMENT_ERROR).not.toContain(PRODUCTION_ADMIN_UID);
  });

  it('rejects staging when the production project ref is missing', async () => {
    const env = await loadEnvironment(stagingValues({
      VITE_PRODUCTION_SUPABASE_PROJECT_REF: '',
    }));

    expect(env.IS_SUPABASE_ENV_VALID).toBe(false);
    expect(env.ENVIRONMENT_ERROR).toContain('VITE_PRODUCTION_SUPABASE_PROJECT_REF');
    expect(env.ENVIRONMENT_ERROR).not.toContain(STAGING_KEY);
    expect(env.ENVIRONMENT_ERROR).not.toContain(PRODUCTION_KEY);
    expect(env.ENVIRONMENT_ERROR).not.toContain(STAGING_ADMIN_UID);
    expect(env.ENVIRONMENT_ERROR).not.toContain(PRODUCTION_ADMIN_UID);
  });

  it('rejects staging when both project refs are equal', async () => {
    const env = await loadEnvironment(stagingValues({
      VITE_STAGING_SUPABASE_URL: PRODUCTION_URL,
      VITE_STAGING_SUPABASE_PROJECT_REF: PRODUCTION_REF,
      VITE_PRODUCTION_SUPABASE_PROJECT_REF: PRODUCTION_REF,
    }));

    expect(env.IS_SUPABASE_ENV_VALID).toBe(false);
    expect(env.ENVIRONMENT_ERROR).toContain('mismo que el de producción');
    expect(env.ENVIRONMENT_ERROR).not.toContain(STAGING_KEY);
    expect(env.ENVIRONMENT_ERROR).not.toContain(PRODUCTION_ADMIN_UID);
  });

  it('rejects an invalid production project ref', async () => {
    const env = await loadEnvironment(stagingValues({
      VITE_PRODUCTION_SUPABASE_PROJECT_REF: 'not-a-valid-ref',
    }));

    expect(env.IS_SUPABASE_ENV_VALID).toBe(false);
    expect(env.ENVIRONMENT_ERROR).toContain('VITE_PRODUCTION_SUPABASE_PROJECT_REF no tiene formato');
    expect(env.ENVIRONMENT_ERROR).not.toContain(STAGING_KEY);
  });

  it('rejects VITE_APP_ENV=staging when Vite is not in staging mode', async () => {
    const env = await loadEnvironment(stagingValues({
      MODE: 'production',
      VITE_APP_ENV: 'staging',
    }));

    expect(env.IS_STAGING).toBe(true);
    expect(env.IS_SUPABASE_ENV_VALID).toBe(false);
    expect(env.ENVIRONMENT_ERROR).toContain('contradice el modo de Vite');
  });
});
