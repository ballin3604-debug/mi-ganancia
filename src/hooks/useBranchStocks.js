import { useEffect, useState } from 'react';
import {
  getBranchStocks,
  subscribeBranchStock,
  ensureBranchStockBackfill,
} from '../services/branchStock';

// Filas de stock por sede del negocio + backfill local una vez.
// Se refresca con mutaciones locales y con cada sync del servidor.
export function useBranchStocks(businessId, mainBranchId) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!businessId) {
      setRows([]);
      return;
    }
    let alive = true;
    ensureBranchStockBackfill(businessId, mainBranchId)
      .then(() => getBranchStocks(businessId))
      .then((r) => { if (alive) setRows(r); })
      .catch(() => {});
    const unsub = subscribeBranchStock(businessId, (r) => {
      if (alive) setRows(r);
    });
    function onCache() {
      getBranchStocks(businessId)
        .then((r) => { if (alive) setRows(r); })
        .catch(() => {});
    }
    window.addEventListener('tuganancia-cache-synced', onCache);
    return () => {
      alive = false;
      unsub();
      window.removeEventListener('tuganancia-cache-synced', onCache);
    };
  }, [businessId, mainBranchId]);

  return rows;
}
