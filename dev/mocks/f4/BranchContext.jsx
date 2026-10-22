import { BRANCHES } from './data.js';

const branches = BRANCHES;
const activeBranch = BRANCHES[0];
const value = {
  branches,
  activeBranch,
  selectBranch: () => {},
};

export function useBranches() {
  return value;
}
