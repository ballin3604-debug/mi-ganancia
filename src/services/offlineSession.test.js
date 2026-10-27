import { describe, it, expect, beforeEach } from 'vitest';
import { db, generateUUID } from './localDb';
import {
  saveLastAuthUser,
  getLastAuthUser,
  clearLastAuthUser,
  getCachedProfile,
  getOfflineAuthUser,
} from './offlineSession';

describe('sesión offline', () => {
  beforeEach(async () => {
    clearLastAuthUser();
    await db.delete();
    await db.open();
  });

  it('guarda el usuario mínimo en localStorage y lo recupera', () => {
    const id = generateUUID();
    saveLastAuthUser({
      id,
      email: 'dueno@ejemplo.com',
      user_metadata: { displayName: 'Dueño' },
    });

    const cached = getLastAuthUser();
    expect(cached).toMatchObject({
      id,
      email: 'dueno@ejemplo.com',
      user_metadata: { displayName: 'Dueño' },
    });
  });

  it('ignora datos inválidos y permite limpiar el marcador', () => {
    localStorage.setItem('mg-last-auth-user', '{"sin":"id"}');
    expect(getLastAuthUser()).toBeNull();

    saveLastAuthUser({ id: generateUUID() });
    expect(getLastAuthUser()).not.toBeNull();
    clearLastAuthUser();
    expect(getLastAuthUser()).toBeNull();
  });

  it('solo devuelve sesión offline si el perfil está cacheado', async () => {
    const id = generateUUID();
    saveLastAuthUser({ id, email: 'cajero@ejemplo.com' });

    expect(await getOfflineAuthUser()).toBeNull();
    expect(await getCachedProfile(id)).toBeNull();

    const profile = { id, business_id: generateUUID(), role: 'cashier', status: 'active' };
    await db.profiles.put(profile);

    expect(await getCachedProfile(id)).toEqual(profile);
    expect(await getOfflineAuthUser()).toMatchObject({ id, email: 'cajero@ejemplo.com' });
  });
});
