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
    <div className="bg-[var(--mg-bg-surface)] rounded-[24px] px-5 pt-4 pb-2.5 border border-[var(--mg-border)] shadow-xs space-y-3 transition-all">
      {/* Fila superior: saludo · sucursal al centro · mes a la derecha */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[var(--mg-accent)] to-sky-500 text-white flex items-center justify-center font-black text-lg shrink-0 shadow-md border border-white/20 overflow-hidden">
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
          <h1 className="text-lg sm:text-xl font-black text-[var(--mg-text-primary)] tracking-tight truncate">
            ¡Hola, {userFirstName}!
          </h1>
          <SyncBadge />
        </div>

        {showBranch && (
          <div className="flex sm:justify-center order-first sm:order-none">
            <label className="flex items-center gap-2 bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] rounded-xl pl-3 pr-1.5 py-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">Sucursal:</span>
              <select
                value={homeBranch}
                onChange={(e) => onBranchChange && onBranchChange(e.target.value)}
                className="bg-transparent text-xs font-black text-[var(--mg-text-primary)] focus:outline-none cursor-pointer max-w-[200px]"
                aria-label="Elegir sucursal"
              >
                <option value="all">Todas las Sucursales (Consolidado)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="flex sm:justify-end">
          <span className="inline-flex items-center gap-1.5 text-emerald-600 font-black text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> En Tiempo Real
          </span>
        </div>
      </div>

      {/* Fila de acciones */}
      <div className="flex items-center gap-2.5 justify-end">
        {settings?.qrData && (
          <button
            onClick={onShowQr}
            type="button"
            aria-label="Ver código QR de cobro"
            className="px-3.5 py-2.5 bg-[var(--mg-bg-elevated)] hover:bg-[var(--mg-bg-section)] text-[var(--mg-text-secondary)] font-bold text-xs rounded-xl border border-[var(--mg-border)] flex items-center gap-2 active:scale-95 transition-all min-h-[44px]"
            title="Ver QR de cobro"
          >
            <svg className="w-4 h-4 text-[var(--mg-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            <span className="hidden sm:inline">Cobrar QR</span>
          </button>
        )}

        <button
          onClick={() => onNavigate && onNavigate('/ventas')}
          type="button"
          className="flex-1 md:flex-initial bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-hover)] text-white font-extrabold px-5 py-2.5 rounded-xl text-xs active:scale-95 transition-all shadow-sm flex items-center justify-center gap-2 border border-[var(--mg-accent-border)] min-h-[44px]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span>Nueva Venta</span>
        </button>
      </div>
      <p className="text-[11px] text-[var(--mg-text-muted)] font-semibold capitalize pt-0.5">
        {today}
      </p>
    </div>
  );
}
