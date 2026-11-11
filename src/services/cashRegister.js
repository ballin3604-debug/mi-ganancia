import { db, generateUUID } from './localDb';
import { buildOutboxOp, refreshOutboxState } from './syncEngine';
import { formatShiftMoment, getShiftStatus, isShiftConfigured, normalizeShift } from '../utils/shifts';

export const CASH_DENOMINATIONS = [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1];

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function dateValue(value) {
  if (!value) return null;
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function inPeriod(value, start, end) {
  const date = dateValue(value);
  return !!date && date >= start && date <= end;
}

function belongsToBranch(row, branchId, isMainBranch) {
  return row.branch_id === branchId || (isMainBranch && !row.branch_id);
}

export function calculateCashMovements({
  sales = [],
  expenses = [],
  branchId,
  isMainBranch = false,
  periodStart,
  periodEnd = new Date(),
  openingCash = 0,
}) {
  const start = dateValue(periodStart);
  const end = dateValue(periodEnd) || new Date();
  if (!start || !branchId) {
    return { cashSales: 0, qrSales: 0, cashExpenses: 0, expectedCash: roundMoney(openingCash) };
  }

  let cashSales = 0;
  let qrSales = 0;
  for (const sale of sales) {
    if (sale.status === 'cancelled' || sale.status === 'voided') continue;
    if (!belongsToBranch(sale, branchId, isMainBranch) || !inPeriod(sale.created_at || sale.createdAt, start, end)) continue;
    const total = Number(sale.total || 0);
    const method = sale.payment_method || sale.paymentMethod;
    if (method === 'cash' || method === 'efectivo') {
      cashSales += total;
    } else if (method === 'mixto') {
      cashSales += Number(sale.monto_efectivo ?? sale.montoEfectivo ?? sale.cash_amount ?? sale.cashAmount ?? total);
      qrSales += Number(sale.monto_qr ?? sale.montoQR ?? sale.qr_amount ?? sale.qrAmount ?? 0);
    } else if (method === 'qr') {
      qrSales += total;
    }
  }

  let cashExpenses = 0;
  for (const expense of expenses) {
    const method = expense.payment_method || expense.paymentMethod || 'efectivo';
    if (method !== 'efectivo' && method !== 'cash') continue;
    if (!belongsToBranch(expense, branchId, isMainBranch)) continue;
    if (!inPeriod(expense.created_at || expense.createdAt, start, end)) continue;
    cashExpenses += Number(expense.amount || 0);
  }

  cashSales = roundMoney(cashSales);
  qrSales = roundMoney(qrSales);
  cashExpenses = roundMoney(cashExpenses);
  return {
    cashSales,
    qrSales,
    cashExpenses,
    expectedCash: roundMoney(Number(openingCash || 0) + cashSales - cashExpenses),
  };
}

const listeners = new Set();
const sessionListeners = new Set();

export async function getCashArqueos(businessId) {
  if (!businessId) return [];
  const rows = await db.cash_arqueos.where('business_id').equals(businessId).toArray();
  return rows.sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at));
}

export function subscribeCashArqueos(businessId, callback) {
  getCashArqueos(businessId).then(callback).catch(console.error);
  const entry = { businessId, callback };
  listeners.add(entry);
  return () => listeners.delete(entry);
}

function notifyCashArqueos(businessId) {
  getCashArqueos(businessId).then((rows) => {
    listeners.forEach((entry) => {
      if (entry.businessId === businessId) entry.callback(rows);
    });
  }).catch(console.error);
}

export async function getCashSessions(businessId) {
  if (!businessId) return [];
  const rows = await db.cash_sessions.where('business_id').equals(businessId).toArray();
  return rows.sort((a, b) => new Date(b.opened_at) - new Date(a.opened_at));
}

export function subscribeCashSessions(businessId, callback) {
  getCashSessions(businessId).then(callback).catch(console.error);
  const entry = { businessId, callback };
  sessionListeners.add(entry);
  return () => sessionListeners.delete(entry);
}

function notifyCashSessions(businessId) {
  getCashSessions(businessId).then((rows) => {
    sessionListeners.forEach((entry) => {
      if (entry.businessId === businessId) entry.callback(rows);
    });
  }).catch(console.error);
}

export async function openCashSession(businessId, userId, userName, data) {
  if (!businessId || !userId || !data?.branchId || !data?.cashierId) {
    throw new Error('Selecciona la sucursal y el cajero para abrir la caja.');
  }
  const openingCash = Number(data.openingCash);
  if (!Number.isFinite(openingCash) || openingCash < 0) {
    throw new Error('El fondo inicial debe ser un monto válido mayor o igual a cero.');
  }

  const shift = data.shift ? normalizeShift(data.shift) : null;
  if (data.shift) {
    if (!isShiftConfigured(shift)) {
      throw new Error('El cajero no tiene un turno válido asignado. Asigna su horario en Equipo.');
    }
    const validationNow = data.now instanceof Date ? data.now : new Date();
    const shiftStatus = getShiftStatus(shift, validationNow);
    if (!shiftStatus.active) {
      const next = shiftStatus.nextStart
        ? ` Próximo turno: ${formatShiftMoment(shiftStatus.nextStart, validationNow)}.`
        : '';
      throw new Error(`${String(data.cashierName || 'El cajero')} está fuera de su turno (${shift.start} a ${shift.end}).${next}`);
    }
  }

  const openedAt = new Date().toISOString();
  const row = {
    id: generateUUID(),
    business_id: businessId,
    branch_id: data.branchId,
    cashier_id: data.cashierId,
    cashier_name: String(data.cashierName || 'Cajero').slice(0, 100),
    opening_cash: roundMoney(openingCash),
    status: 'open',
    opened_at: openedAt,
    opened_by: userId,
    opened_by_name: String(userName || 'Dueño').slice(0, 100),
    shift_label: shift?.label || null,
    shift_start: shift?.start || null,
    shift_end: shift?.end || null,
    closed_at: null,
    closed_by: null,
    closed_by_name: '',
    closed_arqueo_id: null,
    created_at: openedAt,
    updated_at: openedAt,
    sync_status: 'local',
  };
  const { sync_status, ...payload } = row;
  const operation = buildOutboxOp('OPEN_CASH_SESSION', payload, businessId, {
    userId,
    branchId: data.branchId,
    origin: 'offline',
  });

  await db.transaction('rw', db.cash_sessions, db.pending_operations, async () => {
    const active = await db.cash_sessions
      .where('[business_id+branch_id+status]')
      .equals([businessId, data.branchId, 'open'])
      .first();
    if (active) throw new Error(`Ya hay una caja abierta para ${active.cashier_name || 'otro cajero'} en esta sucursal.`);
    await db.cash_sessions.add(row);
    await db.pending_operations.add(operation);
  });

  notifyCashSessions(businessId);
  try {
    await refreshOutboxState(businessId);
  } catch {
    return row;
  }
  return row;
}

export async function createCashArqueo(businessId, userId, userName, data) {
  if (!businessId || !userId || !data?.branchId) {
    throw new Error('Falta el negocio, usuario o sucursal para guardar el arqueo.');
  }
  const openingCash = Number(data.openingCash);
  const countedCash = Number(data.countedCash);
  const expectedCash = Number(data.expectedCash);
  if (![openingCash, countedCash, expectedCash].every(Number.isFinite) || openingCash < 0 || countedCash < 0) {
    throw new Error('Revisa los montos del arqueo.');
  }
  const difference = roundMoney(countedCash - expectedCash);
  const notes = String(data.notes || '').trim();
  if (Math.abs(difference) > 0.009 && notes.length < 3) {
    throw new Error('Explica la diferencia de caja en las observaciones antes de guardar.');
  }

  const closedAt = new Date().toISOString();
  const row = {
    id: generateUUID(),
    business_id: businessId,
    branch_id: data.branchId,
    cash_session_id: data.cashSessionId || null,
    cashier_id: data.cashierId || null,
    cashier_name: String(data.cashierName || '').slice(0, 100),
    period_start: new Date(data.periodStart).toISOString(),
    closed_at: closedAt,
    opening_cash: roundMoney(openingCash),
    cash_sales: roundMoney(data.cashSales),
    qr_sales: roundMoney(data.qrSales),
    cash_expenses: roundMoney(data.cashExpenses),
    expected_cash: roundMoney(expectedCash),
    counted_cash: roundMoney(countedCash),
    difference,
    denominations: data.denominations || {},
    notes,
    shift_label: null,
    shift_start: null,
    shift_end: null,
    closed_by: userId,
    closed_by_name: String(userName || 'Usuario').slice(0, 100),
    created_at: closedAt,
    sync_status: 'local',
  };
  const { sync_status, ...payload } = row;
  const operation = buildOutboxOp('ADD_CASH_ARQUEO', payload, businessId, {
    userId,
    branchId: data.branchId,
    origin: 'offline',
  });

  let closeSessionOperation = null;
  await db.transaction('rw', db.cash_arqueos, db.cash_sessions, db.pending_operations, async () => {
    let session = null;
    if (data.cashSessionId) {
      session = await db.cash_sessions.get(data.cashSessionId);
      if (!session || session.business_id !== businessId || session.branch_id !== data.branchId || session.status !== 'open') {
        throw new Error('La sesión de caja ya no está abierta. Actualiza la pantalla e inténtalo de nuevo.');
      }
      if (Math.abs(roundMoney(session.opening_cash) - openingCash) > 0.009) {
        throw new Error('El fondo inicial no coincide con la apertura de caja. Actualiza la pantalla e inténtalo de nuevo.');
      }
      row.cashier_id = session.cashier_id;
      row.cashier_name = session.cashier_name || '';
      row.period_start = new Date(session.opened_at).toISOString();
      row.shift_label = session.shift_label || null;
      row.shift_start = session.shift_start || null;
      row.shift_end = session.shift_end || null;
      payload.cashier_id = row.cashier_id;
      payload.cashier_name = row.cashier_name;
      payload.period_start = row.period_start;
      payload.shift_label = row.shift_label;
      payload.shift_start = row.shift_start;
      payload.shift_end = row.shift_end;
    }
    await db.cash_arqueos.add(row);
    await db.pending_operations.add(operation);
    if (session) {
      const sessionClosedAt = new Date().toISOString();
      const closePayload = {
        id: session.id,
        business_id: businessId,
        status: 'closed',
        closed_at: sessionClosedAt,
        closed_by: userId || null,
        closed_by_name: String(userName || 'Usuario').slice(0, 100),
        closed_arqueo_id: row.id,
        updated_at: sessionClosedAt,
      };
      await db.cash_sessions.update(session.id, { ...closePayload, sync_status: 'local' });
      closeSessionOperation = buildOutboxOp('CLOSE_CASH_SESSION', closePayload, businessId, {
        userId,
        branchId: data.branchId,
        origin: 'offline',
      });
      closeSessionOperation.created_at = new Date(Math.max(Date.now(), new Date(operation.created_at).getTime() + 1)).toISOString();
      await db.pending_operations.add(closeSessionOperation);
    }
  });
  notifyCashArqueos(businessId);
  if (data.cashSessionId) notifyCashSessions(businessId);
  try {
    await refreshOutboxState(businessId);
  } catch {
    return row;
  }
  return row;
}

if (typeof window !== 'undefined') {
  window.addEventListener('tuganancia-cache-synced', (event) => {
    const businessId = event.detail?.businessId;
    if (businessId) {
      notifyCashArqueos(businessId);
      notifyCashSessions(businessId);
    }
  });
}
