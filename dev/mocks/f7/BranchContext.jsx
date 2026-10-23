import { BRANCHES } from './data.js';

export function useBranches() {
  return {
    branches: BRANCHES,
    activeBranchId: 'b-centro',
    activeBranch: BRANCHES[0],
    loading: false,
    loadError: null,
    selectBranch: () => {},
    refreshBranches: async () => {},
  };
}
