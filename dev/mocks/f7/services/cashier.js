import { INVITES, TEAM_MEMBERS } from '../data.js';

export const MAX_MEMBERS = 5;

export const MEMBER_PERMISSIONS = [
  { id: 'cobrar', name: 'Cobrar ventas', description: 'Registrar ventas y cobros', locked: true },
  { id: 'scanner', name: 'Usar escáner', description: 'Escanear códigos de barras', locked: false },
  { id: 'inventario', name: 'Ver inventario', description: 'Consultar stock y precios', locked: false },
  { id: 'compras', name: 'Compras', description: 'Registrar reposiciones', locked: false },
  { id: 'exportar', name: 'Exportar', description: 'Descargar reportes', locked: false },
];

export const DEFAULT_CASHIER_PERMISSIONS = ['cobrar', 'scanner', 'exportar'];

export function memberCan() {
  return true;
}

export async function updateMemberPermissions(memberId, permissions) {
  return permissions;
}

export async function updateMemberName(memberId, name) {
  return name;
}

export async function updateMemberBranches(memberId, branchIds) {
  return branchIds;
}

export async function getBusinessMembers() {
  return TEAM_MEMBERS;
}

export async function getMemberCount() {
  return TEAM_MEMBERS.length;
}

export async function lookupJoinCode() {
  return { businessId: 'b-demo-f7', valid: true };
}

export async function createJoinCode() {
  return 'ROSA-4821';
}

export async function createOwnerCode() {
  return 'DUENO-9137';
}

export async function joinBusinessWithCode() {
  return { ok: true };
}

export async function regenerateJoinCode() {
  return 'ROSA-4821';
}

export async function regenerateOwnerCode() {
  return 'DUENO-9137';
}

export async function createInviteCode(_businessId, _name, email, role = 'cashier') {
  return { code: `INV-${Math.floor(Math.random() * 9000 + 1000)}`, email, role, expiresAt: new Date(Date.now() + 7 * 86400000) };
}

export async function listInvites() {
  return INVITES;
}

export async function revokeInvite() {
  return true;
}

export async function findInviteForEmail() {
  return null;
}

export async function setMemberStatus(memberId, status) {
  return { id: memberId, status };
}

export async function removeMember() {
  return true;
}

export async function updateMemberRole() {
  return true;
}
