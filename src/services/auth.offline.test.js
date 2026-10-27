import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db, generateUUID } from './localDb';
import { getUserData, signOut } from './auth';
import { getLastAuthUser, saveLastAuthUser } from './offlineSession';

const state = vi.hoisted(() => ({
  globalSignOutError: null,
  localSignOutCalls: 0,
  fromCalls: 0,
}));

vi.mock('./supabaseClient', () => {
  const client = {
    auth: {
      signOut: vi.fn((options) => {
        if (options?.scope === 'local') {
          state.localSignOutCalls += 1;
          return Promise.resolve({ error: null });
        }
        return Promise.resolve({ error: state.globalSignOutError });
      }),
    },
    from: () => {
      state.fromCalls += 1;
      throw new Error('Failed to fetch');
    },
  };
  return {
    supabase: client,
    assertSupabase: () => client,
    isSupabaseConfigured: true,
    supabaseConfigError: '',
  };
});

function setOnline(value) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
}

describe('auth offline', () => {
  beforeEach(async () => {
    state.globalSignOutError = null;
    state.localSignOutCalls = 0;
    state.fromCalls = 0;
    setOnline(false);
    saveLastAuthUser({ id: generateUUID() });
    await db.delete();
    await db.open();
  });

  afterEach(() => {
    setOnline(true);
  });

  it('lee el perfil de IndexedDB sin tocar la red cuando está offline', async () => {
    const id = generateUUID();
    const profile = { id, business_id: generateUUID(), role: 'owner', status: 'active' };
    await db.profiles.put(profile);

    await expect(getUserData(id)).resolves.toEqual(profile);
    expect(state.fromCalls).toBe(0);
  });

  it('falla de forma controlada si está offline y no hay perfil cacheado', async () => {
    await expect(getUserData(generateUUID())).rejects.toThrow(/sin perfil guardado/i);
    expect(state.fromCalls).toBe(0);
  });

  it('cae a la caché si hay red pero la consulta falla', async () => {
    setOnline(true);
    const id = generateUUID();
    const profile = { id, business_id: generateUUID(), role: 'cashier', status: 'active' };
    await db.profiles.put(profile);

    await expect(getUserData(id)).resolves.toEqual(profile);
    expect(state.fromCalls).toBe(1);
  });

  it('cierra la sesión local aunque falle el logout global', async () => {
    const id = generateUUID();
    saveLastAuthUser({ id, email: 'dueno@ejemplo.com' });
    state.globalSignOutError = new Error('Failed to fetch');

    await signOut();

    expect(state.localSignOutCalls).toBe(1);
    expect(getLastAuthUser()).toBeNull();
  });
});
