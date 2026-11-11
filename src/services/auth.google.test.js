import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ calls: [] }));

vi.mock('./supabaseClient', () => {
  const client = {
    auth: {
      signInWithOAuth: vi.fn(async (options) => {
        state.calls.push(options);
        return { data: { provider: 'google' }, error: null };
      }),
    },
  };
  return {
    supabase: client,
    assertSupabase: () => client,
    isSupabaseConfigured: true,
    supabaseConfigError: '',
  };
});

const { signInWithGoogle } = await import('./auth');

describe('signInWithGoogle', () => {
  it('fuerza el selector de cuentas para poder elegir otro correo', async () => {
    state.calls = [];

    await signInWithGoogle();

    expect(state.calls).toHaveLength(1);
    expect(state.calls[0]).toMatchObject({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: 'select_account' },
      },
    });
  });
});
