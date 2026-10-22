const demoUser = {
  uid: 'demo-owner',
  id: 'demo-owner',
  displayName: 'Rosa Quispe',
  email: 'rosa@miganancia.bo',
  photoURL: '',
};

export function AuthProvider({ children }) {
  return children;
}

export function useAuth() {
  return {
    user: demoUser,
    businessId: 'demo-business',
    loading: false,
    needsSetup: false,
    userStatus: 'active',
    admin: false,
    role: 'owner',
    sellerName: 'Rosa',
    authError: null,
    memberPermissions: null,
    memberBranches: null,
    hasPermission: () => true,
  };
}
