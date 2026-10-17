import { useSyncStatus } from '../../hooks/useSyncStatus';

function SyncBadge() {
  const { online, pendingCount, errorCount } = useSyncStatus();

  let label = 'Sincronizado';
  let styles = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  let dot = 'bg-emerald-500 animate-pulse';

  if (!online) {
    label = 'Sin conexión';
    styles = 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)] border-[var(--mg-border)]';
    dot = 'bg-[var(--mg-text-faint)]';
  } else if (errorCount > 0) {
    label = 'Error al sincronizar';
    styles = 'bg-[var(--mg-danger-bg)] text-[var(--mg-danger)] border-red-200';
    dot = 'bg-[var(--mg-danger)]';
  } else if (pendingCount > 0) {
    label = `Sincronizando (${pendingCount})`;
    styles = 'bg-[var(--mg-accent-bg)] text-[var(--mg-accent)] border-[var(--mg-accent-border)]';
    dot = 'bg-[var(--mg-accent)] animate-pulse';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${styles}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

export function DashboardHeader({ today, user, settings, onShowQr, onNavigate, branches = [], homeBranch = 'all', onBranchChange }) {
  const userFirstName = user?.displayName?.split(' ')[0] || 'Vendedor';
  const showBranch = branches.length > 1;

  return (
    <div className="px-1 space-y-2.5">
      {showBranch && (
        <label className="flex items-center gap-1.5 text-xs">
          <span className="font-bold text-[var(--mg-text-muted)] shrink-0">Sucursal:</span>
          <select
            value={homeBranch}
            onChange={(e) => onBranchChange && onBranchChange(e.target.value)}
            className="bg-transparent font-black text-[var(--mg-text-primary)] focus:outline-none cursor-pointer min-w-0 truncate"
            aria-label="Elegir sucursal"
          >
            <option value="all">Todas (Consolidado)</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>
      )}

      {/* Saludo + fecha en una sola fila compacta */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[var(--mg-accent)] to-sky-500 text-white flex items-center justify-center font-black text-base shrink-0 overflow-hidden">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={userFirstName}
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <span>{userFirstName.charAt(0)}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-lg font-black text-[var(--mg-text-primary)] tracking-tight truncate">
              ¡Hola, {userFirstName}!
            </h1>
            <SyncBadge />
          </div>
          <p className="text-[11px] text-[var(--mg-text-muted)] font-semibold capitalize truncate">
            {today}
          </p>
        </div>
      </div>

      {/* Inicio minimalista: sin botón Nueva Venta (se accede desde la pestaña Ventas).
          Solo se muestra el QR si existe. */}
      {settings?.qrData && (
        <div className="flex items-center gap-2">
          <button
            onClick={onShowQr}
            type="button"
            aria-label="Ver código QR de cobro"
            className="px-3.5 py-2 bg-[var(--mg-bg-elevated)] hover:bg-[var(--mg-bg-section)] text-[var(--mg-text-secondary)] font-bold text-xs rounded-xl border border-[var(--mg-border)] flex items-center gap-2 active:scale-95 transition-all"
            title="Ver QR de cobro"
          >
            <svg className="w-4 h-4 text-[var(--mg-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            <span className="hidden sm:inline">Cobrar QR</span>
            <span className="sm:hidden">QR</span>
          </button>
        </div>
      )}
    </div>
  );
}
