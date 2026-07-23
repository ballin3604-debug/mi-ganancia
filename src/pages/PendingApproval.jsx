import { useAuth } from '../context/AuthContext';
import { signOut } from '../services/auth';

export default function PendingApproval({ status }) {
  const { user } = useAuth();

  const isRejected = status === 'rejected';
  const isSuspended = status === 'suspended';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center space-y-6">

        <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mx-auto shadow-lg text-5xl ${
          isRejected || isSuspended ? 'bg-[var(--mg-danger-bg)]' : 'bg-amber-100'
        }`}>
          {isRejected ? '❌' : isSuspended ? '🔒' : '⏳'}
        </div>

        <div>
          <h1 className="text-2xl font-black text-[var(--mg-text-primary)]">
            {isRejected ? 'Solicitud rechazada'
              : isSuspended ? 'Cuenta suspendida'
              : 'Solicitud enviada'}
          </h1>
          <p className="text-[var(--mg-text-muted)] mt-2 text-sm leading-relaxed">
            {isRejected
              ? 'Tu solicitud de acceso fue rechazada. Contacta al administrador para más información.'
              : isSuspended
              ? 'Tu cuenta ha sido suspendida. Contacta al administrador.'
              : 'Tu solicitud está siendo revisada. Recibirás acceso una vez que el administrador la apruebe.'}
          </p>
        </div>

        {!isRejected && !isSuspended && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
            <div className="flex gap-3 items-start">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex flex-col items-center gap-1 flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    i === 0 ? 'bg-[var(--mg-accent)] text-white' : i === 1 ? 'bg-amber-400 text-white animate-pulse' : 'bg-[var(--mg-border)] text-[var(--mg-text-faint)]'
                  }`}>
                    {i === 0 ? '✓' : i + 1}
                  </div>
                  <p className="text-xs text-[var(--mg-text-muted)] text-center leading-tight">
                    {i === 0 ? 'Solicitud enviada' : i === 1 ? 'En revisión' : 'Acceso activo'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-[var(--mg-bg-surface)] rounded-2xl p-4 border border-[var(--mg-border)] text-left">
          <p className="text-xs text-[var(--mg-text-faint)] mb-1">Cuenta registrada</p>
          <p className="font-semibold text-[var(--mg-text-secondary)] text-sm">{user?.displayName}</p>
          <p className="text-[var(--mg-text-faint)] text-xs">{user?.email}</p>
        </div>

        <button
          onClick={signOut}
          className="w-full bg-[var(--mg-border)] text-[var(--mg-text-secondary)] font-bold py-3.5 rounded-2xl text-sm active:scale-95"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
