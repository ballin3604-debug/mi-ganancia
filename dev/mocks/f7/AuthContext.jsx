import { BUSINESS, TEAM_MEMBERS } from './data.js';

const role = new URLSearchParams(window.location.search).get('role') === 'cashier' ? 'cashier' : 'owner';

const demoUser = {
  uid: role === 'cashier' ? 'u-cajero' : 'u-dueno',
  id: role === 'cashier' ? 'u-cajero' : 'u-dueno',
  displayName: role === 'cashier' ? 'Carlos Mamani' : 'Rosa Quispe',
  email: role === 'cashier' ? 'carlos@demo.bo' : 'rosa@demo.bo',
  photoURL: '',
};

export function AuthProvider({ children }) {
  return children;
}

export function useAuth() {
  return {
    user: demoUser,
    businessId: BUSINESS.id,
    loading: false,
    needsSetup: false,
    userStatus: 'active',
    admin: role === 'owner',
    role,
    sellerName: demoUser.displayName,
    authError: null,
    memberPermissions: null,
    memberBranches: null,
    updateOwnRole: () => {},
    hasPermission: () => true,
    members: TEAM_MEMBERS,
  };
}
