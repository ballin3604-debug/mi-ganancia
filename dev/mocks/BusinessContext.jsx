const demoBusiness = {
  id: 'demo-business',
  name: 'Bodega Doña Rosa',
};

export function BusinessProvider({ children }) {
  return children;
}

export function useBusiness() {
  return {
    business: demoBusiness,
    settings: {},
    refreshSettings: () => {},
    refreshBusiness: async () => {},
  };
}
