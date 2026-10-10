import { useNavigate } from 'react-router-dom';
import { usePlan } from '../hooks/usePlan';

// Cintillo con el plan actual: trial, vencimiento y atajo a upgrade.
export default function PlanBanner({ onVerPlanes }) {
  const { plan, planId, isTrial, trialDaysLeft, isExpired, loading } = usePlan();
  const navigate = useNavigate();

  if (loading) return null;

  const expired = isExpired;

  return (
    <div
      className={`rounded-[20px] p-4 border flex items-center gap-3 ${
        planId === 'free'
          ? 'bg-[var(--mg-bg-surface)] border-[var(--mg-border)]'
          : 'bg-[var(--mg-accent-bg-soft)] border-[var(--mg-accent-border)]'
      }`}
    >
      <span className="text-2xl shrink-0">{planId === 'free' ? '🆓' : planId === 'pro' ? '⭐' : '👑'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-[var(--mg-text-primary)]">
          Plan {plan.name}
          {isTrial ? ` · prueba: quedan ${trialDaysLeft} días` : ''}
          {expired ? ' · período terminado' : ''}
        </p>
        <p className="text-[11px] text-[var(--mg-text-muted)] font-semibold">
          {planId === 'free'
            ? 'Sube a Pro para escáner, reportes y equipo.'
            : planId === 'pro'
              ? 'Premium agrega sucursales y almacenes.'
              : 'Tienes todo desbloqueado.'}
        </p>
      </div>
      {planId !== 'premium' && (
        <button
          type="button"
          onClick={() => (onVerPlanes ? onVerPlanes() : navigate('/configuracion'))}
          className="shrink-0 text-xs font-black px-3.5 py-2 rounded-xl bg-[var(--mg-accent)] text-white active:scale-95"
        >
          Ver planes
        </button>
      )}
    </div>
  );
}
