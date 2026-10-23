import { BRANCHES } from '../data.js';

export async function getBranches() {
  return BRANCHES;
}

export async function addBranch(_businessId, data) {
  return { id: `b-${Date.now()}`, ...data };
}

export async function updateBranch(id, patch) {
  return { id, ...patch };
}

export async function setMainBranch() {
  return true;
}

export async function deleteBranch() {
  return true;
}
