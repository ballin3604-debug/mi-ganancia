import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { usePlan } from '../hooks/usePlan';
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
  const { businessId, role, memberBranches } = useAuth();
  const { can } = usePlan();
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

  // El cajero solo ve sus sedes asignadas (lista del dueño).
  // Sin lista = todas (comportamiento de siempre). El dueño ve todo.
  const assignedBranches = (role === 'cashier' && Array.isArray(memberBranches) && memberBranches.length > 0)
    ? branches.filter((b) => memberBranches.includes(b.id))
    : branches;

  // Sucursales y almacenes son Premium. En Pro se opera solo con la sede
  // principal, aunque el negocio tenga sedes viejas creadas antes del cambio.
  const visibleBranches = can('branches')
    ? assignedBranches
    : (() => {
      const main = branches.find((b) => b.isMain) || branches[0];
      return main ? [main] : [];
    })();

  // Si la sede guardada ya no existe (o ya no está asignada), caer a la principal
  useEffect(() => {
    if (loading || visibleBranches.length === 0) return;
    if (!visibleBranches.some((b) => b.id === activeBranchId)) {
      const main = visibleBranches.find((b) => b.isMain) || visibleBranches[0];
      setActiveBranchId(main.id);
      lsSet(main.id);
    }
  }, [visibleBranches, loading, activeBranchId]);

  function selectBranch(id) {
    if (role === 'cashier' && Array.isArray(memberBranches) && memberBranches.length > 0 && !memberBranches.includes(id)) return;
    setActiveBranchId(id);
    lsSet(id);
  }

  const activeBranch = visibleBranches.find((b) => b.id === activeBranchId)
    || visibleBranches.find((b) => b.isMain)
    || visibleBranches[0]
    || (role === 'cashier' && Array.isArray(memberBranches) && memberBranches.length > 0
      ? { id: memberBranches[0] }
      : null);

  return (
    <BranchContext.Provider value={{
      branches: visibleBranches, activeBranch, activeBranchId: activeBranch?.id || null,
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
