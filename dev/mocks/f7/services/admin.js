const REQUESTS = [
  { id: 'r1', status: 'pending', displayName: 'Juan Pérez', email: 'juan@demo.bo', businessName: 'Tienda Juan', createdAt: new Date() },
  { id: 'r2', status: 'approved', businessName: 'Minimarket Norte', email: 'norte@demo.bo', adminNote: 'Aprobado sin observaciones', reviewedAt: new Date() },
];

const BUSINESSES = [
  { id: 'b-demo-f7', name: 'Tienda Doña Rosa', ownerEmail: 'rosa@demo.bo', ownerName: 'Rosa Quispe', status: 'active', createdAt: new Date() },
  { id: 'b-norte', name: 'Minimarket Norte', ownerEmail: 'norte@demo.bo', ownerName: 'Luis Vargas', status: 'suspended', createdAt: new Date() },
];

export const ADMIN_UID = 'admin-demo';
export function isAdmin() {
  return true;
}

export async function getBusinessPlans() {
  return { 'b-demo-f7': 'pro', 'b-norte': 'free' };
}

export async function setBusinessPlan() {
  return true;
}

export async function submitRequest() {
  return true;
}

export async function getAllRequests() {
  return REQUESTS;
}

export async function getAllBusinesses() {
  return BUSINESSES;
}

export async function approveRequest() {
  return true;
}

export async function rejectRequest() {
  return true;
}

export async function suspendBusiness() {
  return true;
}

export async function reactivateBusiness() {
  return true;
}

export async function deleteBusiness() {
  return true;
}
