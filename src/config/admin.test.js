import { describe, it, expect, vi, afterEach } from 'vitest';

// Valores sintéticos: no son UIDs reales.
const STAGING_ADMIN_UID = '11111111-1111-4111-8111-111111111111';
const PRODUCTION_ADMIN_UID = '22222222-2222-4222-8222-222222222222';

async function loadAdmin({ isStaging, stagingAdminUid, productionAdminUid }) {
  vi.resetModules();
  vi.stubEnv('VITE_ADMIN_UID', productionAdminUid);
  vi.doMock('./environment', () => ({
    IS_STAGING: isStaging,
    STAGING_ADMIN_UID: stagingAdminUid,
  }));
  return import('./admin');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock('./environment');
  vi.resetModules();
});

describe('admin UID environment isolation', () => {
  it('ignores VITE_ADMIN_UID in staging and uses the staging admin', async () => {
    const admin = await loadAdmin({
      isStaging: true,
      stagingAdminUid: STAGING_ADMIN_UID,
      productionAdminUid: PRODUCTION_ADMIN_UID,
    });

    expect(admin.ADMIN_UID).toBe(STAGING_ADMIN_UID);
    expect(admin.isAdmin(STAGING_ADMIN_UID)).toBe(true);
    expect(admin.isAdmin(PRODUCTION_ADMIN_UID)).toBe(false);
  });

  it('does not inherit the production admin when staging has no admin', async () => {
    const admin = await loadAdmin({
      isStaging: true,
      stagingAdminUid: '',
      productionAdminUid: PRODUCTION_ADMIN_UID,
    });

    expect(admin.ADMIN_UID).toBe('');
    expect(admin.isAdmin(PRODUCTION_ADMIN_UID)).toBe(false);
  });

  it('uses VITE_ADMIN_UID outside staging', async () => {
    const admin = await loadAdmin({
      isStaging: false,
      stagingAdminUid: STAGING_ADMIN_UID,
      productionAdminUid: PRODUCTION_ADMIN_UID,
    });

    expect(admin.ADMIN_UID).toBe(PRODUCTION_ADMIN_UID);
    expect(admin.isAdmin(PRODUCTION_ADMIN_UID)).toBe(true);
    expect(admin.isAdmin(STAGING_ADMIN_UID)).toBe(false);
  });
});
