// Indicador visual del estado de sincronización de una operación local.
// sync_status proviene de IndexedDB: 'local' = aún no confirmada por el
// servidor, 'confirmed' = ya sincronizada.
export function SyncStatusBadge({ status, className = '' }) {
  if (status === 'local') {
    return (
      <span
        title="Guardado localmente. Se sincronizará cuando haya conexión."
        className={`inline-flex items-center gap-1 rounded-full border border-[var(--mg-warning-border)] bg-[var(--mg-warning-bg)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--mg-warning-text)] ${className}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--mg-warning)] animate-pulse" />
        Local
      </span>
    );
  }

  if (status === 'confirmed') {
    return (
      <span
        title="Confirmado por el servidor."
        className={`inline-flex items-center gap-1 rounded-full border border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--mg-success-text)] ${className}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--mg-success)]" />
        Confirmado
      </span>
    );
  }

  return null;
}
