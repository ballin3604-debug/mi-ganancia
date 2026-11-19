import { db, generateUUID } from './localDb';
import { buildOutboxOp, refreshOutboxState } from './syncEngine';

function cleanText(value) {
  return value !== undefined && value !== null ? String(value).trim() : '';
}

function cleanCreditLimit(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function buildCustomerFields(customerData = {}) {
  return {
    name: cleanText(customerData.name),
    nit: cleanText(customerData.nit),
    phone: cleanText(customerData.phone),
    address: cleanText(customerData.address),
    birthday: cleanText(customerData.birthday) || null,
    notes: cleanText(customerData.notes),
    credit_limit: cleanCreditLimit(customerData.credit_limit ?? customerData.creditLimit),
  };
}

export async function getCustomers(businessId) {
  const clis = await db.clientes.where('business_id').equals(businessId).toArray();
  // Sort alphabetically by name
  return clis.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

export async function addCustomer(businessId, customerData) {
  const id = generateUUID();
  const localCustomer = {
    id,
    business_id: businessId,
    ...buildCustomerFields(customerData),
    created_at: new Date().toISOString(),
  };

  const outboxOp = buildOutboxOp('ADD_CUSTOMER', localCustomer, businessId);
  await db.transaction('rw', db.clientes, db.pending_operations, async () => {
    await db.clientes.put(localCustomer);
    await db.pending_operations.add(outboxOp);
  });
  await refreshOutboxState(businessId);

  return localCustomer;
}

export async function updateCustomer(id, customerData) {
  const existing = await db.clientes.get(id);
  if (!existing) throw new Error('Customer record not found');

  const updateData = buildCustomerFields(customerData);

  const outboxOp = buildOutboxOp('UPDATE_CUSTOMER', { id, ...updateData }, existing.business_id);
  await db.transaction('rw', db.clientes, db.pending_operations, async () => {
    await db.clientes.update(id, updateData);
    await db.pending_operations.add(outboxOp);
  });
  await refreshOutboxState(existing.business_id);
}

export async function deleteCustomer(id) {
  const existing = await db.clientes.get(id);
  if (!existing) return;

  const outboxOp = buildOutboxOp('DELETE_CUSTOMER', { id }, existing.business_id);
  await db.transaction('rw', db.clientes, db.pending_operations, async () => {
    await db.clientes.delete(id);
    await db.pending_operations.add(outboxOp);
  });
  await refreshOutboxState(existing.business_id);
}
