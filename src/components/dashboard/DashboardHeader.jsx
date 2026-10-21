import { useSyncStatus } from '../../hooks/useSyncStatus';
import { BranchSelect } from '../BranchSelect';

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

  return (
    <div className="px-1 space-y-2">
      <BranchSelect
        branches={branches}
        value={homeBranch}
        onChange={onBranchChange}
        label="Sucursal"
        allLabel="Todas (Consolidado)"
      />

      {/* Saludo + fecha + QR en una sola fila compacta */}
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

        {/* QR de cobro: icono compacto a la derecha; el texto aparece en pantallas grandes. */}
        {settings?.qrData && (
          <button
            onClick={onShowQr}
            type="button"
            aria-label="Ver código QR de cobro"
            className="shrink-0 px-2.5 py-2 bg-[var(--mg-bg-elevated)] hover:bg-[var(--mg-bg-section)] text-[var(--mg-text-secondary)] font-bold text-xs rounded-xl border border-[var(--mg-border)] flex items-center gap-2 active:scale-95 transition-all"
            title="Ver QR de cobro"
          >
            <svg className="w-4 h-4 text-[var(--mg-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            <span className="hidden sm:inline">Cobrar QR</span>
          </button>
        )}
      </div>
    </div>
  );
}
