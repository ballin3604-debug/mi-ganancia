import { describe, it, expect, vi } from 'vitest';
import { findDuplicateBusinessIds } from './admin';

vi.mock('./supabaseClient', () => ({
  supabase: {},
  assertSupabase: () => ({}),
  isSupabaseConfigured: true,
  supabaseConfigError: '',
}));

vi.mock('./cashier', () => ({
  createJoinCode: vi.fn(),
}));

function biz(id, overrides = {}) {
  return {
    id,
    name: 'Prueba',
    owner_id: 'owner-1',
    isOwnerBusiness: false,
    ...overrides,
  };
}

describe('findDuplicateBusinessIds', () => {
  it('marca los repetidos del mismo dueño y nombre y conserva el que está en uso', () => {
    const businesses = [
      biz('biz-a', { isOwnerBusiness: false }),
      biz('biz-b', { isOwnerBusiness: true }),
      biz('biz-c', { isOwnerBusiness: false }),
    ];

    const duplicates = findDuplicateBusinessIds(businesses);

    expect([...duplicates]).toEqual(['biz-a', 'biz-c']);
    expect(duplicates.has('biz-b')).toBe(false);
  });

  it('conserva el más antiguo cuando ninguno está en uso (lista descendente)', () => {
    const businesses = [
      biz('nuevo', { createdAt: '2026-10-25T10:00:00Z' }),
      biz('medio', { createdAt: '2026-10-24T10:00:00Z' }),
      biz('antiguo', { createdAt: '2026-10-23T10:00:00Z' }),
    ];

    const duplicates = findDuplicateBusinessIds(businesses);

    expect([...duplicates].sort()).toEqual(['medio', 'nuevo']);
    expect(duplicates.has('antiguo')).toBe(false);
  });

  it('no mezcla dueños distintos aunque el nombre sea el mismo', () => {
    const businesses = [
      biz('a', { owner_id: 'owner-1' }),
      biz('b', { owner_id: 'owner-2' }),
    ];

    expect(findDuplicateBusinessIds(businesses).size).toBe(0);
  });

  it('no marca negocios del mismo dueño con nombres distintos', () => {
    const businesses = [
      biz('a', { name: 'Prueba' }),
      biz('b', { name: 'Otra tienda' }),
    ];

    expect(findDuplicateBusinessIds(businesses).size).toBe(0);
  });

  it('usa el correo del dueño cuando falta owner_id, sin distinguir mayúsculas', () => {
    const businesses = [
      biz('a', { owner_id: null, ownerEmail: 'Dueno@Mail.com' }),
      biz('b', { owner_id: null, ownerEmail: 'dueno@mail.com' }),
      biz('c', { owner_id: null, ownerEmail: 'otro@mail.com' }),
    ];

    const duplicates = findDuplicateBusinessIds(businesses);

    expect([...duplicates]).toEqual(['a']);
  });

  it('devuelve un set vacío sin negocios o con un solo registro', () => {
    expect(findDuplicateBusinessIds([]).size).toBe(0);
    expect(findDuplicateBusinessIds(null).size).toBe(0);
    expect(findDuplicateBusinessIds([biz('solo')]).size).toBe(0);
  });
});
