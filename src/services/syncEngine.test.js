import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db, generateUUID } from './localDb';
import {
  buildOutboxOp,
  checkOnlineStatus,
  enqueueOperation,
  getPendingOperations,
  isNetworkError,
  isAuthError,
  isPermanentError,
  isRetryableError,
} from './syncEngine';

// Prevent syncEngine from trying to talk to Supabase during these tests.
vi.mock('./supabaseClient', () => ({
  supabase: null,
  isSupabaseConfigured: false,
  supabaseConfigError: '',
  assertSupabase: () => { throw new Error('Supabase not configured in tests'); },
}));

describe('syncEngine outbox', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('buildOutboxOp creates an operation with all metadata fields', () => {
    const businessId = generateUUID();
    const userId = generateUUID();
    const branchId = generateUUID();
    const op = buildOutboxOp('REGISTER_SALE', { total: 123 }, businessId, {
      userId,
      branchId,
      origin: 'offline',
    });

    expect(op.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(op.operation_type).toBe('REGISTER_SALE');
    expect(op.payload.total).toBe(123);
    expect(op.business_id).toBe(businessId);
    expect(op.status).toBe('pending');
    expect(op.retry_count).toBe(0);
    expect(op.created_by).toBe(userId);
    expect(op.branch_id).toBe(branchId);
    expect(op.origin).toBe('offline');
    expect(op.server_confirmed_at).toBeNull();
    expect(op.device_id).toBeDefined();
  });

  it('buildOutboxOp works with legacy 3-argument callers', () => {
    const op = buildOutboxOp('ADD_EXPENSE', { amount: 50 }, 'biz-1');
    expect(op.operation_type).toBe('ADD_EXPENSE');
    expect(op.business_id).toBe('biz-1');
    expect(op.created_by).toBeNull();
    expect(op.branch_id).toBeNull();
    expect(op.origin).toBe('offline');
  });

  it('enqueueOperation stores a pending operation and returns it via getPendingOperations', async () => {
    const businessId = generateUUID();
    await enqueueOperation('ADD_CUSTOMER', { name: 'Ana' }, businessId, {
      userId: generateUUID(),
      branchId: generateUUID(),
    });

    const all = await getPendingOperations(businessId);
    expect(all.length).toBe(1);
    expect(all[0].operation_type).toBe('ADD_CUSTOMER');
    expect(all[0].status).toBe('pending');

    const pending = await getPendingOperations(businessId, 'pending');
    expect(pending.length).toBe(1);

    const confirmed = await getPendingOperations(businessId, 'confirmed');
    expect(confirmed.length).toBe(0);
  });

  it('getPendingOperations filters by business_id without losing orphan ops', async () => {
    const b1 = generateUUID();
    const b2 = generateUUID();
    await enqueueOperation('ADD_EXPENSE', { amount: 1 }, b1);
    await enqueueOperation('ADD_EXPENSE', { amount: 2 }, b2);

    expect((await getPendingOperations(b1)).length).toBe(1);
    expect((await getPendingOperations(b2)).length).toBe(1);
    expect((await getPendingOperations(null)).length).toBe(2);
  });
});

describe('syncEngine error classification', () => {
  it('classifies network errors as retryable', () => {
    expect(isNetworkError({ message: 'Failed to fetch' })).toBe(true);
    expect(isNetworkError({ code: 'ECONNREFUSED' })).toBe(true);
    expect(isNetworkError({ code: 'ETIMEDOUT' })).toBe(true);
    expect(isPermanentError({ message: 'Failed to fetch' })).toBe(false);
    expect(isRetryableError({ message: 'Failed to fetch' })).toBe(true);
  });

  it('classifies auth errors as retryable (session can be refreshed)', () => {
    expect(isAuthError({ code: 'PGRST301' })).toBe(true);
    expect(isAuthError({ message: 'JWT expired' })).toBe(true);
    expect(isPermanentError({ code: 'PGRST301' })).toBe(false);
    expect(isRetryableError({ code: 'PGRST301' })).toBe(true);
  });

  it('classifies constraint and data errors as permanent', () => {
    expect(isPermanentError({ code: '23505' })).toBe(true);
    expect(isPermanentError({ code: '23502' })).toBe(true);
    expect(isPermanentError({ code: '23503' })).toBe(true);
    expect(isPermanentError({ code: 'P0001' })).toBe(true);
    expect(isPermanentError({ message: 'duplicate key value violates unique constraint' })).toBe(true);
    expect(isRetryableError({ code: '23505' })).toBe(false);
  });

  it('keeps PGRST204 (missing column) retryable so serverCaps can adapt', () => {
    expect(isPermanentError({ code: 'PGRST204' })).toBe(false);
    expect(isRetryableError({ code: 'PGRST204' })).toBe(true);
  });

  it('treats unknown errors as retryable by default', () => {
    const err = new Error('Something weird happened');
    expect(isPermanentError(err)).toBe(false);
    expect(isRetryableError(err)).toBe(true);
  });

  it('enqueueOperation requests Background Sync when available', async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    const originalServiceWorker = navigator.serviceWorker;
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        ready: Promise.resolve({ sync: { register } }),
      },
      configurable: true,
      writable: true,
    });

    await enqueueOperation('ADD_EXPENSE', { amount: 10 }, generateUUID());

    // Give the microtask a chance to run.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(register).toHaveBeenCalledWith('tuganancia-sync');

    Object.defineProperty(navigator, 'serviceWorker', {
      value: originalServiceWorker,
      configurable: true,
      writable: true,
    });
  });
});

describe('syncEngine environment guard', () => {
  it('does not ping Supabase when the environment guard failed', async () => {
    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    try {
      await expect(checkOnlineStatus()).resolves.toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      Object.defineProperty(navigator, 'onLine', {
        value: originalOnLine,
        configurable: true,
      });
    }
  });
});
