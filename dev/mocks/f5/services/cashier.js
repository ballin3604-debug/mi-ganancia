import { TEAM_MEMBERS } from '../data.js';

export function getBusinessMembers() {
  return Promise.resolve(TEAM_MEMBERS);
}
