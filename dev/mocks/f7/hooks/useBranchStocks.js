export function useBranchStocks() {
  return { stocks: [], loading: false, stockMap: {}, hasRows: false, refresh: async () => {} };
}
