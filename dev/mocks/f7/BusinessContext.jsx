import { BUSINESS, SETTINGS } from './data.js';

export function BusinessProvider({ children }) {
  return children;
}

export function useBusiness() {
  return {
    business: BUSINESS,
    settings: SETTINGS,
    loading: false,
    refreshSettings: () => {},
    refreshBusiness: async () => {},
  };
}
