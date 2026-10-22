import { BUSINESS } from './data.js';

const isCashier = new URLSearchParams(window.location.search).get('role') === 'cashier';

const demoUser = {
  uid: isCashier ? 'u-cajero' : 'u-dueno',
  id: isCashier ? 'u-cajero' : 'u-dueno',
  displayName: isCashier ? 'Carlos Mamani' : 'Rosa Quispe',
  email: isCashier ? 'carlos@demo.bo' : 'rosa@demo.bo',
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
    admin: false,
    role: isCashier ? 'cashier' : 'owner',
    sellerName: demoUser.displayName,
    authError: null,
    memberPermissions: null,
    memberBranches: null,
    hasPermission: () => true,
  };
}
