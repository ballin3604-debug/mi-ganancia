import { useState, useEffect } from 'react';
import { subscribeSyncStatus } from '../services/syncEngine';

export function useSyncStatus() {
  const [status, setStatus] = useState({ online: navigator.onLine, pendingCount: 0, errorCount: 0 });

  useEffect(() => {
    const unsubscribe = subscribeSyncStatus((newStatus) => {
      setStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  return status;
}
