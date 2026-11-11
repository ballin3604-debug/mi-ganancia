import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, generateUUID } from './localDb';
import { calculateCashMovements, createCashArqueo, openCashSession } from './cashRegister';
import { getPendingOperations } from './syncEngine';

vi.mock('./supabaseClient', () => ({
  supabase: null,
  isSupabaseConfigured: false,
  supabaseConfigError: '',
  assertSupabase: () => { throw new Error('Supabase no configurado en pruebas'); },
}));

describe('cash register arqueos', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('calcula el esperado solo con efectivo y egresos de la sucursal en el período', () => {
    const branchId = generateUUID();
    const otherBranchId = generateUUID();
    const periodStart = new Date('2026-11-01T10:00:00.000Z');
    const periodEnd = new Date('2026-11-01T12:00:00.000Z');
    const sales = [
      { branch_id: branchId, created_at: '2026-11-01T10:30:00.000Z', payment_method: 'cash', total: 100 },
      { branch_id: branchId, created_at: '2026-11-01T10:45:00.000Z', payment_method: 'qr', total: 60 },
      { branch_id: branchId, created_at: '2026-11-01T11:00:00.000Z', payment_method: 'mixto', total: 50, monto_efectivo: 20, monto_qr: 30 },
      { branch_id: branchId, created_at: '2026-11-01T11:10:00.000Z', payment_method: 'cash', total: 40, status: 'cancelled' },
      { branch_id: otherBranchId, created_at: '2026-11-01T11:15:00.000Z', payment_method: 'cash', total: 500 },
      { branch_id: branchId, created_at: '2026-11-01T09:59:00.000Z', payment_method: 'cash', total: 900 },
    ];
    const expenses = [
      { branch_id: branchId, created_at: '2026-11-01T11:30:00.000Z', payment_method: 'efectivo', amount: 15 },
      { branch_id: branchId, created_at: '2026-11-01T11:35:00.000Z', payment_method: 'qr', amount: 70 },
      { branch_id: otherBranchId, created_at: '2026-11-01T11:40:00.000Z', payment_method: 'efectivo', amount: 20 },
    ];

    expect(calculateCashMovements({
      sales, expenses, branchId, periodStart, periodEnd, openingCash: 50,
    })).toEqual({ cashSales: 120, qrSales: 90, cashExpenses: 15, expectedCash: 155 });
  });

  it('incluye ventas y egresos antiguos sin sede en la sucursal principal', () => {
    const branchId = generateUUID();
    const periodStart = new Date('2026-11-01T10:00:00.000Z');
    const periodEnd = new Date('2026-11-01T12:00:00.000Z');
    const result = calculateCashMovements({
      branchId,
      isMainBranch: true,
      periodStart,
      periodEnd,
      openingCash: 20,
      sales: [{ created_at: '2026-11-01T11:00:00.000Z', payment_method: 'cash', total: 30 }],
      expenses: [{ created_at: '2026-11-01T11:15:00.000Z', payment_method: 'efectivo', amount: 5 }],
    });
    expect(result.expectedCash).toBe(45);
  });

  it('guarda el arqueo localmente y encola su sincronización offline', async () => {
    const businessId = generateUUID();
    const userId = generateUUID();
    const branchId = generateUUID();
    const arqueo = await createCashArqueo(businessId, userId, 'Cajera Test', {
      branchId,
      periodStart: '2026-11-01T10:00:00.000Z',
      openingCash: 20,
      cashSales: 30,
      qrSales: 5,
      cashExpenses: 5,
      expectedCash: 45,
      countedCash: 45,
      denominations: { 20: 2, 5: 1 },
      notes: '',
    });

    expect(arqueo.difference).toBe(0);
    expect((await db.cash_arqueos.get(arqueo.id)).sync_status).toBe('local');
    const operations = await getPendingOperations(businessId, 'pending');
    expect(operations).toHaveLength(1);
    expect(operations[0].operation_type).toBe('ADD_CASH_ARQUEO');
    expect(operations[0].payload.closed_by).toBe(userId);
  });

  it('abre una caja para un cajero y evita dos cajas abiertas en la misma sucursal', async () => {
    const businessId = generateUUID();
    const ownerId = generateUUID();
    const branchId = generateUUID();
    const cashierId = generateUUID();
    const session = await openCashSession(businessId, ownerId, 'Dueño Test', {
      branchId,
      cashierId,
      cashierName: 'Cajera Test',
      openingCash: 75,
    });

    expect(session.status).toBe('open');
    expect(session.opening_cash).toBe(75);
    expect(session.cashier_id).toBe(cashierId);
    expect((await db.cash_sessions.get(session.id)).sync_status).toBe('local');
    await expect(openCashSession(businessId, ownerId, 'Dueño Test', {
      branchId,
      cashierId: generateUUID(),
      cashierName: 'Otro Cajero',
      openingCash: 20,
    })).rejects.toThrow('Ya hay una caja abierta');
  });

  it('solo abre la caja dentro del turno asignado al cajero', async () => {
    const businessId = generateUUID();
    const ownerId = generateUUID();
    const branchId = generateUUID();
    const cashierId = generateUUID();
    const shift = { label: 'Mañana', start: '08:00', end: '14:00', days: [1] };

    await expect(openCashSession(businessId, ownerId, 'Dueño Test', {
      branchId,
      cashierId,
      cashierName: 'Mayorly',
      openingCash: 50,
      shift,
      now: new Date(2026, 10, 9, 15, 0),
    })).rejects.toThrow('fuera de su turno');

    const session = await openCashSession(businessId, ownerId, 'Dueño Test', {
      branchId,
      cashierId,
      cashierName: 'Mayorly',
      openingCash: 50,
      shift,
      now: new Date(2026, 10, 9, 10, 0),
    });

    expect(session.shift_label).toBe('Mañana');
    expect(session.shift_start).toBe('08:00');
    expect(session.shift_end).toBe('14:00');
  });

  it('no permite abrir la caja si el cajero tiene un turno incompleto', async () => {
    await expect(openCashSession(generateUUID(), generateUUID(), 'Dueño Test', {
      branchId: generateUUID(),
      cashierId: generateUUID(),
      cashierName: 'Mayorly',
      openingCash: 10,
      shift: { start: '08:00', end: '', days: [1] },
    })).rejects.toThrow('turno válido');
  });

  it('cierra la sesión asignada junto con el arqueo', async () => {
    const businessId = generateUUID();
    const ownerId = generateUUID();
    const branchId = generateUUID();
    const cashierId = generateUUID();
    const session = await openCashSession(businessId, ownerId, 'Dueño Test', {
      branchId,
      cashierId,
      cashierName: 'Cajera Test',
      openingCash: 20,
    });

    const arqueo = await createCashArqueo(businessId, ownerId, 'Dueño Test', {
      branchId,
      cashSessionId: session.id,
      periodStart: session.opened_at,
      openingCash: 20,
      cashSales: 30,
      qrSales: 0,
      cashExpenses: 5,
      expectedCash: 45,
      countedCash: 45,
      notes: '',
    });

    const closedSession = await db.cash_sessions.get(session.id);
    expect(closedSession.status).toBe('closed');
    expect(closedSession.closed_arqueo_id).toBe(arqueo.id);
    expect(arqueo.cashier_id).toBe(cashierId);
    expect(arqueo.cashier_name).toBe('Cajera Test');
    const operations = await getPendingOperations(businessId, 'pending');
    expect(operations.map((operation) => operation.operation_type)).toEqual([
      'OPEN_CASH_SESSION',
      'ADD_CASH_ARQUEO',
      'CLOSE_CASH_SESSION',
    ]);
  });

  it('exige observación cuando hay diferencia', async () => {
    await expect(createCashArqueo(generateUUID(), generateUUID(), 'Dueño', {
      branchId: generateUUID(),
      periodStart: '2026-11-01T10:00:00.000Z',
      openingCash: 0,
      expectedCash: 100,
      countedCash: 90,
      cashSales: 100,
      qrSales: 0,
      cashExpenses: 0,
      notes: '',
    })).rejects.toThrow('Explica la diferencia');
  });
});
