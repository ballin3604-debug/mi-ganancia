import { useState } from 'react';
import { LogoutModal } from '../LogoutModal';

export function BackupSection({
  backupLoading,
  backupMsg,
  onBackup,
  admin,
  onNavigate,
  user,
  business,
}) {
  const [showLogout, setShowLogout] = useState(false);

  return (
    <div className="space-y-4">
      {/* Respaldo / Exportación */}
      <div className="bg-[var(--mg-bg-surface)] rounded-[24px] p-5 border border-[var(--mg-border)] space-y-3.5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[var(--mg-gold-bg)] border border-[var(--mg-gold-border)] text-[var(--mg-gold-text)] flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <div>
            <h3 className="font-extrabold text-[var(--mg-text-primary)] text-sm">Respaldo y copia de seguridad</h3>
            <p className="text-[var(--mg-text-muted)] text-xs">Descargá una copia completa de tu tienda</p>
          </div>
        </div>

        <p className="text-xs text-[var(--mg-text-secondary)] leading-relaxed bg-[var(--mg-bg-elevated)] p-3 rounded-2xl border border-[var(--mg-border)]">
          Baja a tu celular o computadora un archivo con todos los datos de tu negocio: productos,
          ventas, compras, fiados, egresos y clientes. Guardalo en un lugar seguro (WhatsApp, correo,
          Drive). Te recomendamos hacerlo cada semana.
        </p>

        <button
          type="button"
          onClick={onBackup}
          disabled={backupLoading}
          className="w-full bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-hover)] text-white font-extrabold py-3.5 rounded-xl text-xs active:scale-95 transition-all shadow-sm flex items-center justify-center gap-2 border border-[var(--mg-accent-border)] min-h-[44px] disabled:opacity-50"
        >
          {backupLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Preparando respaldo…
            </>
          ) : (
            <>📥 Exportar todos los datos (.JSON)</>
          )}
        </button>

        {backupMsg && (
          <div className={`p-3 rounded-xl text-xs font-bold leading-snug border ${
            backupMsg.startsWith('✓')
              ? 'bg-[var(--mg-success-bg)] text-[var(--mg-success-text)] border-green-200'
              : 'bg-[var(--mg-warning-bg)] text-[var(--mg-warning)] border-amber-200'
          }`}>
            {backupMsg}
          </div>
        )}
      </div>

      {/* Panel de Admin (solo rol admin) */}
      {admin && (
        <button
          type="button"
          onClick={() => onNavigate && onNavigate('/admin')}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold py-3.5 rounded-2xl text-xs active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 min-h-[44px]"
        >
          👑 Ir al Panel de Administración
        </button>
      )}

      {/* Cerrar sesión — con confirmación */}
      <div className="pt-2 flex justify-center">
        <button
          type="button"
          onClick={() => setShowLogout(true)}
          className="text-xs font-extrabold text-[var(--mg-danger)] hover:bg-[var(--mg-danger-bg)] px-4 py-2.5 rounded-xl transition-all border border-transparent hover:border-red-200 min-h-[44px]"
        >
          🚪 Cerrar sesión de negocio
        </button>
      </div>

      <LogoutModal
        isOpen={showLogout}
        onClose={() => setShowLogout(false)}
        user={user}
        business={business}
      />
    </div>
  );
}
