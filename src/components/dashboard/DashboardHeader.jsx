import { useEffect, useState } from 'react';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { BranchSelect } from '../BranchSelect';
import { AppIcon } from '../icons';

function SyncBadge() {
  const { online, pendingCount, errorCount } = useSyncStatus();

  let label = 'Sincronizado';
  let styles = 'bg-[var(--mg-success-bg)] text-[var(--mg-success-text)] border-[var(--mg-success-border)]';
  let dot = 'bg-[var(--mg-success)] animate-pulse';

  if (!online) {
    label = 'Sin conexión';
    styles = 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)] border-[var(--mg-border)]';
    dot = 'bg-[var(--mg-text-faint)]';
  } else if (errorCount > 0) {
    label = 'Error al sincronizar';
    styles = 'bg-[var(--mg-danger-bg)] text-[var(--mg-danger)] border-[var(--mg-danger-border)]';
    dot = 'bg-[var(--mg-danger)]';
  } else if (pendingCount > 0) {
    label = `Sincronizando (${pendingCount})`;
    styles = 'bg-[var(--mg-accent-bg)] text-[var(--mg-accent-text)] border-[var(--mg-accent-border)]';
    dot = 'bg-[var(--mg-accent)] animate-pulse';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${styles}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

export function DashboardHeader({ today, businessName, settings, onShowQr, onNavigate, branches = [], homeBranch = 'all', onBranchChange }) {
  const businessLogo = settings?.logoData || '';
  const categoryId = settings?.businessCategory || settings?.business_category || 'otro';
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setLogoError(false);
  }, [businessLogo]);

  const showLogo = !!businessLogo && !logoError;

  return (
    <div className="space-y-3">
      <BranchSelect
        branches={branches}
        value={homeBranch}
        onChange={onBranchChange}
        label="Sucursal"
        allLabel="Todas (Consolidado)"
      />

      <div className="relative overflow-hidden rounded-3xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-4 sm:p-5 shadow-[var(--mg-shadow-sm)]">
        <div className="relative flex items-start gap-3 sm:gap-4">
          <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden border ${
            showLogo
              ? 'bg-white p-1 border-[var(--mg-border)]'
              : 'bg-[var(--mg-brand)] text-white border-[var(--mg-brand-border)]'
          }`}>
            {showLogo ? (
              <img
                src={businessLogo}
                alt={businessName ? `Logo de ${businessName}` : 'Logo del negocio'}
                className="w-full h-full object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <AppIcon name={categoryId} size={22} strokeWidth={2.1} />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--mg-text-muted)] truncate">
              {today}
            </p>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-[var(--mg-brand-text)] tracking-tight truncate">
                {businessName || 'Mi negocio'}
              </h1>
              <SyncBadge />
            </div>
            <p className="mt-1 text-[11px] font-semibold text-[var(--mg-text-secondary)] truncate">
              Así va tu negocio hoy
            </p>
          </div>

          {/* QR de cobro: icono compacto en móvil; texto en pantallas grandes. */}
          {settings?.qrData && (
            <button
              onClick={onShowQr}
              type="button"
              aria-label="Ver código QR de cobro"
              className="shrink-0 inline-flex items-center justify-center gap-2 w-10 h-10 sm:w-auto sm:h-10 sm:px-3 bg-[var(--mg-bg-elevated)] hover:bg-[var(--mg-accent-bg)] text-[var(--mg-text-secondary)] hover:text-[var(--mg-accent-text)] font-bold text-xs rounded-xl border border-[var(--mg-border)] hover:border-[var(--mg-accent-border)] active:scale-95 transition-all"
              title="Ver QR de cobro"
            >
              <svg className="w-4 h-4 text-[var(--mg-accent-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              <span className="hidden sm:inline">Cobrar QR</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
