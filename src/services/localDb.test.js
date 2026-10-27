import { describe, it, expect, beforeEach } from 'vitest';
import { db, generateUUID } from './localDb';

describe('localDb schema', () => {
  beforeEach(async () => {
    // Ensure a fresh IndexedDB for each test
    await db.delete();
    await db.open();
  });

  it('should expose all expected object stores', () => {
    const storeNames = Array.from(db.tables.map((t) => t.name));
    expect(storeNames).toContain('products');
    expect(storeNames).toContain('sales');
    expect(storeNames).toContain('sale_items');
    expect(storeNames).toContain('expenses');
    expect(storeNames).toContain('clientes');
    expect(storeNames).toContain('pending_operations');
    expect(storeNames).toContain('business_settings');
    expect(storeNames).toContain('profiles');
    expect(storeNames).toContain('cart_drafts');
    expect(storeNames).toContain('purchase_drafts');
    expect(storeNames).toContain('branch_stock');
    expect(storeNames).toContain('transfers');
    expect(storeNames).toContain('sync_state');
    expect(storeNames).toContain('branches');
    expect(storeNames).toContain('businesses');
  });

  it('should store and retrieve a pending operation with all metadata fields', async () => {
    const op = {
      id: generateUUID(),
      operation_type: 'REGISTER_SALE',
      payload: { total: 100 },
      business_id: generateUUID(),
      status: 'pending',
      created_at: new Date().toISOString(),
      retry_count: 0,
      last_attempt_at: null,
      created_by: generateUUID(),
      branch_id: generateUUID(),
      device_id: 'test-device',
    };

    await db.pending_operations.add(op);
    const stored = await db.pending_operations.get(op.id);

    expect(stored).toBeDefined();
    expect(stored.id).toBe(op.id);
    expect(stored.operation_type).toBe('REGISTER_SALE');
    expect(stored.status).toBe('pending');
    expect(stored.created_by).toBe(op.created_by);
    expect(stored.branch_id).toBe(op.branch_id);
    expect(stored.device_id).toBe('test-device');
  });

  it('generateUUID should return a stable-looking UUID v4', () => {
    const uuid = generateUUID();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});
