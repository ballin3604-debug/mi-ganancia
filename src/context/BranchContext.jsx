import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getBranches } from '../services/branches';

const BranchContext = createContext(null);
const LS_KEY = 'mg-active-branch';

function lsGet() {
  try { return localStorage.getItem(LS_KEY); } catch { return null; }
}
function lsSet(v) {
  try {
    if (v) localStorage.setItem(LS_KEY, v);
    else localStorage.removeItem(LS_KEY);
  } catch { /* ignore */ }
}

// Sede operativa actual (sucursal o almacén). Se recuerda por dispositivo.
// Fase 1: organiza las VENTAS por sede (stock global). Fase 2: stock por sede.
export function BranchProvider({ children }) {
  const { businessId } = useAuth();
  const [branches, setBranches] = useState([]);
  const [activeBranchId, setActiveBranchId] = useState(() => lsGet());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const fetchBranches = useCallback(async () => {
    if (!businessId) {
      setBranches([]);
      setLoading(false);
      return [];
    }
    setLoading(true);
    try {
      const list = await getBranches(businessId);
      setBranches(list);
      setLoadError('');
      return list;
    } catch (err) {
      console.error('Branches:', err);
      setBranches([]);
      const missing = err?.code === '42P01' || err?.code === 'PGRST205'
        || /does not exist|could not find/i.test(err?.message || '');
      setLoadError(missing ? 'missing-table' : 'error');
      return [];
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    setActiveBranchId(lsGet());
    fetchBranches();
  }, [businessId, fetchBranches]);

  // Si la sede guardada ya no existe, caer a la principal
  useEffect(() => {
    if (loading || branches.length === 0) return;
    if (!branches.some((b) => b.id === activeBranchId)) {
      const main = branches.find((b) => b.isMain) || branches[0];
      setActiveBranchId(main.id);
      lsSet(main.id);
    }
  }, [branches, loading, activeBranchId]);

  function selectBranch(id) {
    setActiveBranchId(id);
    lsSet(id);
  }

  const activeBranch = branches.find((b) => b.id === activeBranchId)
    || branches.find((b) => b.isMain)
    || branches[0]
    || null;

  return (
    <BranchContext.Provider value={{
      branches, activeBranch, activeBranchId: activeBranch?.id || null,
      selectBranch, refreshBranches: fetchBranches, loading, loadError,
    }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranches() {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranches must be used within BranchProvider');
  return ctx;
}
