import { BRANCHES } from './data.js';

const activeBranchId = 'b-centro';
const activeBranch = BRANCHES[0];

export function useBranches() {
  return {
    branches: BRANCHES,
    activeBranchId,
    activeBranch,
    selectBranch: () => {},
  };
}
