import { db, generateUUID } from './localDb';
import { buildOutboxOp, refreshOutboxState } from './syncEngine';
import { notifySaleChanges } from './sales';

function mapDebt(d) {
  if (!d) return d;
  return {
    ...d,
    clientName: d.client_name,
    clientNit: d.client_nit,
    clientPhone: d.client_phone,
    dueDate: d.due_date,
    saleId: d.sale_id,
    paymentMethodReceived: d.payment_method_received,
    createdAt: d.created_at ? { toDate: () => new Date(d.created_at) } : null,
    paidAt: d.paid_at ? { toDate: () => new Date(d.paid_at) } : null,
  };
}

export async function getDebts(businessId) {
  const data = await db.debts.where('business_id').equals(businessId).toArray();
  // Sort desc
  return data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(mapDebt);
}

export async function addDebt(businessId, { clientName, amount, description, clientPhone = '', dueDate = '', clientNit = '', saleId = null }) {
  const id = generateUUID();
  const now = new Date().toISOString();

  const localDebt = {
    id,
    business_id: businessId,
    client_name: clientName.trim(),
    client_nit: (clientNit || '').trim(),
    client_phone: (clientPhone || '').trim(),
    due_date: dueDate || null,
    amount: Number(amount),
    description: (description || '').trim(),
    status: 'pending',
    sale_id: saleId,
    created_at: now,
    paid_at: null,
  };

  const outboxOp = buildOutboxOp('ADD_DEBT', localDebt, businessId);
  await db.transaction('rw', db.debts, db.pending_operations, async () => {
    await db.debts.put(localDebt);
    await db.pending_operations.add(outboxOp);
  });
  await refreshOutboxState(businessId);

  return mapDebt(localDebt);
}

export async function payDebt(debtId, saleId, paymentMethod) {
  const now = new Date().toISOString();
  const existing = await db.debts.get(debtId);
  if (!existing) throw new Error('Debt record not found');

  const updateData = {
    status: 'paid',
    paid_at: now,
    payment_method_received: paymentMethod,
  };
  // Nota: la venta original NO se toca — su payment_method debe seguir
  // reflejando cómo se vendió (fiado), no cómo se cobró después. El método
  // y fecha de cobro real ya quedan en el propio registro de la deuda
  // (payment_method_received / paid_at), que es lo que usa Debts.jsx.
  const payload = {
    debtId,
    saleId,
    payment_method_received: paymentMethod,
    paid_at: now,
  };
  const outboxOp = buildOutboxOp('PAY_DEBT', payload, existing.business_id);

  await db.transaction('rw', db.debts, db.pending_operations, async () => {
    await db.debts.update(debtId, updateData);
    await db.pending_operations.add(outboxOp);
  });

  if (saleId) {
    notifySaleChanges(existing.business_id);
  }
  await refreshOutboxState(existing.business_id);
}

export async function deleteDebt(debtId) {
  const existing = await db.debts.get(debtId);
  if (!existing) return;

  const outboxOp = buildOutboxOp('DELETE_DEBT', { id: debtId }, existing.business_id);
  await db.transaction('rw', db.debts, db.pending_operations, async () => {
    await db.debts.delete(debtId);
    await db.pending_operations.add(outboxOp);
  });
  await refreshOutboxState(existing.business_id);
}
