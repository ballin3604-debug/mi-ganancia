import { describe, it, expect } from 'vitest';
import {
  cleanEnvValue,
  isStagingEnvironment,
  projectRefFromUrl,
  resolveAdminUid,
  validateBuildEnvironment,
  validateEnvironment,
} from './environmentRules';

// Todos los valores son sintéticos. No son credenciales ni proyectos reales.
const STAGING_REF = 's7t4g1n9r2e5f8a3c6b0';
const PRODUCTION_REF = 'p3r7o1d5u9c2t4i6o8n0';
const OTHER_REF = 'o1t2h3e4r5r6e7f8a9b0';
const STAGING_URL = `https://${STAGING_REF}.supabase.co`;
const PRODUCTION_URL = `https://${PRODUCTION_REF}.supabase.co`;
const syntheticJwt = (role) => [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ role })).toString('base64url'),
  'synthetic-signature',
].join('.');
const ANON_KEY = syntheticJwt('anon');
const STAGING_ADMIN_UID = '11111111-1111-4111-8111-111111111111';
const PRODUCTION_ADMIN_UID = '22222222-2222-4222-8222-222222222222';

function stagingEnv(overrides = {}) {
  return {
    mode: 'staging',
    appEnv: 'staging',
    url: STAGING_URL,
    anonKey: ANON_KEY,
    expectedRef: STAGING_REF,
    productionRef: PRODUCTION_REF,
    ...overrides,
  };
}

function buildEnv(overrides = {}) {
  return {
    VITE_APP_ENV: 'staging',
    VITE_STAGING_SUPABASE_URL: STAGING_URL,
    VITE_STAGING_SUPABASE_ANON_KEY: ANON_KEY,
    VITE_STAGING_SUPABASE_PROJECT_REF: STAGING_REF,
    VITE_STAGING_ADMIN_UID: STAGING_ADMIN_UID,
    VITE_PRODUCTION_SUPABASE_PROJECT_REF: PRODUCTION_REF,
    VITE_SUPABASE_URL: PRODUCTION_URL,
    VITE_SUPABASE_ANON_KEY: 'synthetic-shared-production-key',
    VITE_SUPABASE_PROJECT_REF: PRODUCTION_REF,
    VITE_ADMIN_UID: PRODUCTION_ADMIN_UID,
    ...overrides,
  };
}

function productionBuildEnv(overrides = {}) {
  return {
    VITE_APP_ENV: 'production',
    VITE_SUPABASE_URL: PRODUCTION_URL,
    VITE_SUPABASE_ANON_KEY: ANON_KEY,
    ...overrides,
  };
}

describe('projectRefFromUrl', () => {
  it('extracts the project ref from a standard Supabase URL', () => {
    expect(projectRefFromUrl(STAGING_URL)).toBe(STAGING_REF);
  });

  it('trims surrounding whitespace and normalizes the host casing', () => {
    const value = `  https://${STAGING_REF.toUpperCase()}.SUPABASE.CO  `;
    expect(projectRefFromUrl(value)).toBe(STAGING_REF);
  });

  it.each([
    ['empty', ''],
    ['whitespace only', '   '],
    ['not a URL', 'not-a-url'],
    ['a non-Supabase host', 'https://example.com'],
    ['an insecure Supabase URL', `http://${STAGING_REF}.supabase.co`],
    ['a lookalike host', `https://${STAGING_REF}.supabase.co.evil.test`],
    ['credentials that hide the real host', `https://${STAGING_REF}.supabase.co@evil.test`],
    ['an empty project ref', 'https://.supabase.co'],
  ])('returns null for %s', (_label, value) => {
    expect(projectRefFromUrl(value)).toBeNull();
  });

  it('returns null for non-string values', () => {
    expect(projectRefFromUrl(null)).toBeNull();
    expect(projectRefFromUrl(undefined)).toBeNull();
    expect(projectRefFromUrl(123)).toBeNull();
  });
});

describe('isStagingEnvironment', () => {
  it('detects staging from either the Vite mode or VITE_APP_ENV', () => {
    expect(isStagingEnvironment('staging', '')).toBe(true);
    expect(isStagingEnvironment('production', 'staging')).toBe(true);
    expect(isStagingEnvironment('staging', 'production')).toBe(true);
  });

  it('keeps production and test outside staging', () => {
    expect(isStagingEnvironment('production', 'production')).toBe(false);
    expect(isStagingEnvironment('production', '')).toBe(false);
    expect(isStagingEnvironment('test', 'test')).toBe(false);
  });
});

describe('validateEnvironment in staging', () => {
  it('accepts a matching staging ref that differs from production', () => {
    const result = validateEnvironment(stagingEnv());

    expect(result.isStaging).toBe(true);
    expect(result.projectRef).toBe(STAGING_REF);
    expect(result.errors).toEqual([]);
    expect(result.error).toBe('');
  });

  it('accepts matching refs regardless of case and surrounding whitespace', () => {
    const result = validateEnvironment(stagingEnv({
      url: `  ${STAGING_URL}  `,
      expectedRef: `  ${STAGING_REF.toUpperCase()}  `,
      productionRef: `  ${PRODUCTION_REF.toUpperCase()}  `,
    }));

    expect(result.errors).toEqual([]);
    expect(result.projectRef).toBe(STAGING_REF);
  });
});

describe('validateEnvironment project mismatch', () => {
  it('rejects a URL that points to a different project than expected', () => {
    const result = validateEnvironment(stagingEnv({
      url: PRODUCTION_URL,
      expectedRef: STAGING_REF,
      productionRef: OTHER_REF,
    }));

    expect(result.errors).toHaveLength(1);
    expect(result.error).toContain('El proyecto Supabase no coincide');
    expect(result.error).not.toContain(STAGING_REF);
    expect(result.error).not.toContain(PRODUCTION_REF);
  });

  it('rejects an expected ref when the URL is not a standard Supabase URL', () => {
    const result = validateEnvironment(stagingEnv({ url: 'https://example.com' }));

    expect(result.errors.join(' ')).toContain('no es una URL estándar de Supabase');
  });

  it('rejects a lookalike URL even when it contains the expected ref', () => {
    const result = validateEnvironment(stagingEnv({
      url: `https://${STAGING_REF}.supabase.co.evil.test`,
    }));

    expect(result.errors.join(' ')).toContain('no es una URL estándar de Supabase');
  });

  it('rejects a URL whose extracted ref does not have a valid format', () => {
    const result = validateEnvironment(stagingEnv({
      url: 'https://foo.bar.supabase.co',
      expectedRef: STAGING_REF,
    }));

    expect(result.error).toContain('ref de proyecto válido');
  });

  it('rejects staging when the expected staging project ref is missing', () => {
    const result = validateEnvironment(stagingEnv({ expectedRef: '' }));

    expect(result.error).toContain('Falta VITE_STAGING_SUPABASE_PROJECT_REF');
  });
});

describe('validateEnvironment production reference', () => {
  it('rejects staging when the production project ref is missing', () => {
    const result = validateEnvironment(stagingEnv({ productionRef: '' }));

    expect(result.error).toContain('Falta VITE_PRODUCTION_SUPABASE_PROJECT_REF');
  });

  it('rejects an invalid production project ref', () => {
    const result = validateEnvironment(stagingEnv({ productionRef: 'not-a-ref' }));

    expect(result.error).toContain('VITE_PRODUCTION_SUPABASE_PROJECT_REF no tiene formato');
  });

  it('rejects staging when both projects have the same ref', () => {
    const result = validateEnvironment(stagingEnv({
      url: PRODUCTION_URL,
      expectedRef: PRODUCTION_REF,
      productionRef: PRODUCTION_REF,
    }));

    expect(result.error).toContain('mismo que el de producción');
  });
});

describe('validateEnvironment required configuration', () => {
  it('rejects staging without a staging Supabase URL', () => {
    const result = validateEnvironment(stagingEnv({ url: '' }));

    expect(result.error).toContain('Falta VITE_STAGING_SUPABASE_URL');
  });

  it('rejects staging without a staging anon key', () => {
    const result = validateEnvironment(stagingEnv({ anonKey: '' }));

    expect(result.error).toContain('Falta VITE_STAGING_SUPABASE_ANON_KEY');
  });

  it('reports every missing staging value without throwing', () => {
    const result = validateEnvironment({
      mode: 'staging',
      appEnv: 'staging',
      url: '',
      anonKey: '',
      expectedRef: '',
      productionRef: '',
    });

    expect(result.isStaging).toBe(true);
    expect(result.error).toContain('VITE_STAGING_SUPABASE_URL');
    expect(result.error).toContain('VITE_STAGING_SUPABASE_ANON_KEY');
    expect(result.error).toContain('VITE_STAGING_SUPABASE_PROJECT_REF');
    expect(result.error).toContain('VITE_PRODUCTION_SUPABASE_PROJECT_REF');
  });
});

describe('validateEnvironment mode contradictions', () => {
  it('rejects VITE_APP_ENV=staging when Vite mode is production', () => {
    const result = validateEnvironment(stagingEnv({ mode: 'production' }));

    expect(result.isStaging).toBe(true);
    expect(result.error).toContain('contradice el modo de Vite');
  });

  it('rejects Vite mode=staging when VITE_APP_ENV=production', () => {
    const result = validateEnvironment(stagingEnv({ appEnv: 'production' }));

    expect(result.error).toContain('contradice VITE_APP_ENV');
  });

  it('rejects Vite mode=staging when VITE_APP_ENV=test', () => {
    const result = validateEnvironment(stagingEnv({ appEnv: 'test' }));

    expect(result.error).toContain('contradice VITE_APP_ENV');
  });

  it('rejects an unknown VITE_APP_ENV value', () => {
    const result = validateEnvironment(stagingEnv({ appEnv: 'qa' }));

    expect(result.error).toContain('VITE_APP_ENV inválido');
  });

  it('keeps production valid when mode and VITE_APP_ENV agree', () => {
    const result = validateEnvironment({
      mode: 'production',
      appEnv: 'production',
      url: PRODUCTION_URL,
      anonKey: ANON_KEY,
      expectedRef: PRODUCTION_REF,
    });

    expect(result.isStaging).toBe(false);
    expect(result.errors).toEqual([]);
  });

  it('keeps production valid when VITE_APP_ENV is omitted', () => {
    const result = validateEnvironment({
      mode: 'production',
      url: PRODUCTION_URL,
      anonKey: ANON_KEY,
      expectedRef: '',
    });

    expect(result.isStaging).toBe(false);
    expect(result.errors).toEqual([]);
  });

  it('does not require production credentials in test mode', () => {
    const result = validateEnvironment({ mode: 'test', appEnv: 'test' });

    expect(result.errors).toEqual([]);
  });

  it('does not require staging-only variables in production', () => {
    const result = validateEnvironment({
      mode: 'production',
      appEnv: 'production',
      url: PRODUCTION_URL,
      anonKey: ANON_KEY,
      expectedRef: PRODUCTION_REF,
    });

    expect(result.errors).toEqual([]);
  });
});

describe('validateBuildEnvironment', () => {
  it.each([
    ['empty', ''],
    ['production', 'production'],
  ])('accepts production with VITE_APP_ENV %s', (_label, appEnv) => {
    const result = validateBuildEnvironment({
      mode: 'production',
      env: productionBuildEnv({ VITE_APP_ENV: appEnv }),
    });

    expect(result.isStaging).toBe(false);
    expect(result.errors).toEqual([]);
  });

  it.each(['development', 'test', 'staging', 'synthetic-unknown-environment'])(
    'rejects production with VITE_APP_ENV=%s without echoing it', (appEnv) => {
      const result = validateBuildEnvironment({
        mode: 'production',
        env: productionBuildEnv({ VITE_APP_ENV: appEnv }),
      });

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.error).toContain('VITE_APP_ENV');
      expect(result.error).not.toContain('synthetic-unknown-environment');
    },
  );

  it.each([
    ['missing', ''],
    ['invalid', 'http://p3r7o1d5u9c2t4i6o8n0.supabase.co'],
    ['non-Supabase', 'https://synthetic-invalid-host.example'],
  ])('rejects a %s production Supabase URL without echoing it', (_label, url) => {
    const result = validateBuildEnvironment({
      mode: 'production',
      env: productionBuildEnv({ VITE_SUPABASE_URL: url }),
    });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.error).toContain('VITE_SUPABASE_URL');
    if (url) expect(result.error).not.toContain(url);
  });

  it.each([
    ['missing', ''],
    ['invalid', 'synthetic-invalid-anon-key'],
    ['non-public service role', syntheticJwt('service_role')],
  ])('rejects a %s production anon key without echoing it', (_label, anonKey) => {
    const result = validateBuildEnvironment({
      mode: 'production',
      env: productionBuildEnv({ VITE_SUPABASE_ANON_KEY: anonKey }),
    });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.error).toContain('VITE_SUPABASE_ANON_KEY');
    if (anonKey) expect(result.error).not.toContain(anonKey);
  });

  it('accepts the supported publishable key format for production', () => {
    const result = validateBuildEnvironment({
      mode: 'production',
      env: productionBuildEnv({
        VITE_SUPABASE_ANON_KEY: 'sb_publishable_synthetic_public_key_123',
      }),
    });

    expect(result.errors).toEqual([]);
  });

  it('accepts a valid staging build', () => {
    const result = validateBuildEnvironment({ mode: 'staging', env: buildEnv() });

    expect(result.isStaging).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects missing staging variables even when the shared ones exist', () => {
    const result = validateBuildEnvironment({
      mode: 'staging',
      env: buildEnv({
        VITE_STAGING_SUPABASE_URL: '',
        VITE_STAGING_SUPABASE_ANON_KEY: '',
        VITE_STAGING_SUPABASE_PROJECT_REF: '',
      }),
    });

    expect(result.error).toContain('VITE_STAGING_SUPABASE_URL');
    expect(result.error).toContain('VITE_STAGING_SUPABASE_ANON_KEY');
    expect(result.error).toContain('VITE_STAGING_SUPABASE_PROJECT_REF');
    expect(result.error).toContain('se ignora VITE_SUPABASE_URL');
    expect(result.error).toContain('se ignora VITE_SUPABASE_ANON_KEY');
    expect(result.error).toContain('se ignora VITE_SUPABASE_PROJECT_REF');
  });

  it('rejects staging when the staging ref equals the production ref', () => {
    const result = validateBuildEnvironment({
      mode: 'staging',
      env: buildEnv({
        VITE_STAGING_SUPABASE_URL: PRODUCTION_URL,
        VITE_STAGING_SUPABASE_PROJECT_REF: PRODUCTION_REF,
        VITE_PRODUCTION_SUPABASE_PROJECT_REF: PRODUCTION_REF,
      }),
    });

    expect(result.error).toContain('mismo que el de producción');
  });

  it('rejects staging when the production ref is invalid', () => {
    const result = validateBuildEnvironment({
      mode: 'staging',
      env: buildEnv({ VITE_PRODUCTION_SUPABASE_PROJECT_REF: 'bad-ref' }),
    });

    expect(result.error).toContain('VITE_PRODUCTION_SUPABASE_PROJECT_REF no tiene formato');
  });

  it('rejects a staging build that reuses the production admin UID', () => {
    const result = validateBuildEnvironment({
      mode: 'staging',
      env: buildEnv({
        VITE_ADMIN_UID: STAGING_ADMIN_UID,
        VITE_STAGING_ADMIN_UID: STAGING_ADMIN_UID,
      }),
    });

    expect(result.error).toContain('no puede ser igual a VITE_ADMIN_UID');
    expect(result.error).not.toContain(STAGING_ADMIN_UID);
    expect(result.error).not.toContain(PRODUCTION_ADMIN_UID);
  });

  it('accepts different staging and production admin UIDs', () => {
    const result = validateBuildEnvironment({ mode: 'staging', env: buildEnv() });

    expect(result.errors).toEqual([]);
  });

  it('rejects VITE_APP_ENV=staging when the Vite mode is production', () => {
    const result = validateBuildEnvironment({
      mode: 'production',
      env: buildEnv({ VITE_APP_ENV: 'staging' }),
    });

    expect(result.isStaging).toBe(true);
    expect(result.error).toContain('contradice el modo de Vite');
  });

  it('does not require staging variables in production', () => {
    const result = validateBuildEnvironment({
      mode: 'production',
      env: {
        VITE_APP_ENV: 'production',
        VITE_SUPABASE_URL: PRODUCTION_URL,
        VITE_SUPABASE_ANON_KEY: ANON_KEY,
        VITE_SUPABASE_PROJECT_REF: PRODUCTION_REF,
        VITE_ADMIN_UID: PRODUCTION_ADMIN_UID,
      },
    });

    expect(result.isStaging).toBe(false);
    expect(result.errors).toEqual([]);
  });
});

describe('validateEnvironment secret handling', () => {
  it('never includes the anon key value in validation errors', () => {
    const sentinelKey = 'synthetic-secret-sentinel-1234567890';
    const cases = [
      stagingEnv({ anonKey: sentinelKey, expectedRef: PRODUCTION_REF }),
      stagingEnv({ anonKey: sentinelKey, expectedRef: '' }),
      stagingEnv({ anonKey: sentinelKey, productionRef: '' }),
      stagingEnv({ anonKey: sentinelKey, productionRef: 'bad-ref' }),
      stagingEnv({ anonKey: sentinelKey, url: 'https://example.com' }),
      stagingEnv({ anonKey: sentinelKey, mode: 'production' }),
      stagingEnv({ anonKey: sentinelKey, appEnv: 'production' }),
    ];

    for (const input of cases) {
      const result = validateEnvironment(input);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.error).not.toContain(sentinelKey);
    }
  });

  it('never includes admin UIDs in build validation errors', () => {
    const result = validateBuildEnvironment({
      mode: 'staging',
      env: buildEnv({
        VITE_ADMIN_UID: STAGING_ADMIN_UID,
        VITE_STAGING_ADMIN_UID: STAGING_ADMIN_UID,
      }),
    });

    expect(result.error).not.toContain(STAGING_ADMIN_UID);
    expect(result.error).not.toContain(PRODUCTION_ADMIN_UID);
  });

  it('does not echo unrelated environment values in errors', () => {
    const result = validateEnvironment(stagingEnv({
      expectedRef: PRODUCTION_REF,
      anonKey: 'synthetic-unrelated-value',
    }));

    expect(result.error).not.toContain('synthetic-unrelated-value');
  });
});

describe('resolveAdminUid (VITE_ADMIN_UID isolation)', () => {
  it('uses only the staging admin UID in staging', () => {
    const adminUid = resolveAdminUid({
      isStaging: true,
      stagingAdminUid: STAGING_ADMIN_UID,
      productionAdminUid: PRODUCTION_ADMIN_UID,
    });

    expect(adminUid).toBe(STAGING_ADMIN_UID);
    expect(adminUid).not.toBe(PRODUCTION_ADMIN_UID);
  });

  it('does not fall back to the production admin UID when staging has none', () => {
    const adminUid = resolveAdminUid({
      isStaging: true,
      stagingAdminUid: '',
      productionAdminUid: PRODUCTION_ADMIN_UID,
    });

    expect(adminUid).toBe('');
    expect(adminUid).not.toBe(PRODUCTION_ADMIN_UID);
  });

  it('uses the production admin UID only outside staging', () => {
    const adminUid = resolveAdminUid({
      isStaging: false,
      stagingAdminUid: STAGING_ADMIN_UID,
      productionAdminUid: PRODUCTION_ADMIN_UID,
    });

    expect(adminUid).toBe(PRODUCTION_ADMIN_UID);
  });

  it('trims admin UID values and treats non-strings as empty', () => {
    expect(resolveAdminUid({
      isStaging: true,
      stagingAdminUid: ` ${STAGING_ADMIN_UID} `,
      productionAdminUid: PRODUCTION_ADMIN_UID,
    })).toBe(STAGING_ADMIN_UID);

    expect(resolveAdminUid({
      isStaging: true,
      stagingAdminUid: null,
      productionAdminUid: PRODUCTION_ADMIN_UID,
    })).toBe('');
  });
});

describe('cleanEnvValue', () => {
  it('trims strings and normalizes non-strings to an empty string', () => {
    expect(cleanEnvValue('  value  ')).toBe('value');
    expect(cleanEnvValue('')).toBe('');
    expect(cleanEnvValue(null)).toBe('');
    expect(cleanEnvValue(42)).toBe('');
  });
});
