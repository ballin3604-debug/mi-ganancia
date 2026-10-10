import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePlan } from '../hooks/usePlan';
import { PLANS } from '../config/plans';
import { getMyPayments } from '../services/payments';
import PaymentModal from './PaymentModal';

// Puerta premium: si el plan no incluye la función, muestra upgrade.
// Sin billing (SQL sin correr) todo pasa: modo legacy abierto.
export function PremiumGate({ feature, title, children }) {
  const { can, loading, billingReady } = usePlan();
  if (loading) return null;
  if (!billingReady || can(feature)) return <>{children}</>;
  return <UpgradeScreen feature={feature} title={title} compact />;
}

// Modal paywall reutilizable (escáner, etc.)
export function UpgradeModal({ title, feature, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 mg-backdrop-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--mg-bg-surface)] w-full max-w-2xl rounded-t-[28px] sm:rounded-[28px] border border-[var(--mg-border)] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col mg-modal-in"
      >
        <div className="p-3 border-b border-[var(--mg-separator)] flex justify-end bg-[var(--mg-bg-elevated)]">
          <button
            type="button" onClick={onClose}
            className="w-8 h-8 rounded-full bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] flex items-center justify-center font-bold text-base text-[var(--mg-text-muted)]"
          >
            ✕
          </button>
        </div>
        <div className="p-4 overflow-y-auto">
          <UpgradeScreen feature={feature} title={title} compact />
        </div>
      </div>
    </div>
  );
}

const FEATURE_NAMES = {
  scanner: 'el escáner de códigos',
  advancedReports: 'los reportes avanzados',
  pdfExport: 'exportar a PDF',
  multiUser: 'tener equipo (cajeros)',
  branches: 'sucursales y almacenes',
};

const PLAN_CARDS = [
  {
    id: 'pro',
    badge: 'El más pedido',
    tagline: 'Todo lo operativo de tu tienda en 1 sede.',
    features: ['Productos ilimitados', 'Escáner de códigos', 'Reportes avanzados + PDF', 'Equipo hasta 5 (multi-caja)', 'Compras, gastos y kardex'],
  },
  {
    id: 'premium',
    badge: null,
    tagline: 'Para crecer: más sedes y control de dueño.',
    features: ['Todo lo Pro', 'Hasta 3 sucursales', 'Stock por sede + traspasos', 'Panel del dueño en vivo', 'Hasta 15 usuarios'],
  },
];

export default function UpgradeScreen({ feature, title, compact = false }) {
  const { businessId } = useAuth();
  const { plan, planId, isTrial, trialDaysLeft, refreshPlan } = usePlan();
  const [cycle, setCycle] = useState('monthly'); // 'monthly' | 'yearly'
  const [payPlan, setPayPlan] = useState(null);
  const [sent, setSent] = useState(false);
  const [myPayments, setMyPayments] = useState([]);

  useEffect(() => {
    if (!businessId) return;
    getMyPayments(businessId).then(setMyPayments).catch(() => setMyPayments([]));
  }, [businessId, sent]);

  const priceOf = (id) => cycle === 'yearly' ? PLANS[id].priceYearly : PLANS[id].priceMonthly;

  return (
    <div className={`mg-fade-in w-full mx-auto max-w-2xl ${compact ? '' : 'p-4 sm:p-6 pb-24'}`}>
      <div className="text-center mb-5">
        <h2 className="text-xl font-black text-[var(--mg-text-primary)]">
          {title || (feature ? `Desbloquea ${FEATURE_NAMES[feature] || 'esta función'}` : 'Mi plan')}
        </h2>
        <p className="text-sm text-[var(--mg-text-muted)] mt-1">
          Estás en <strong>{plan.name}</strong>
          {isTrial ? ` (prueba Pro: ${trialDaysLeft} días)` : ''}. Tus datos están a salvo.
        </p>
        <div className="inline-flex items-center gap-1 bg-[var(--mg-bg-elevated)] p-1 rounded-2xl border border-[var(--mg-border)] mt-3 relative">
          {['monthly', 'yearly'].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCycle(c)}
              className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${
                cycle === c ? 'bg-[var(--mg-accent)] text-white shadow-sm' : 'text-[var(--mg-text-muted)]'
              }`}
            >
              {c === 'monthly' ? 'Mensual' : 'Anual'}
            </button>
          ))}
          <span className="absolute -top-2.5 -right-2 text-[10px] font-black bg-amber-500 text-white px-2 py-0.5 rounded-full shadow">
            -17%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PLAN_CARDS.map((card) => {
          const mine = planId === card.id;
          return (
            <div
              key={card.id}
              className={`rounded-[22px] border-2 p-5 pt-6 flex flex-col relative ${
                card.id === 'pro'
                  ? 'border-[var(--mg-accent)] bg-[var(--mg-bg-surface)] shadow-md'
                  : 'border-[var(--mg-border)] bg-[var(--mg-bg-surface)]'
              }`}
            >
              {card.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-black uppercase tracking-wider text-white bg-amber-500 px-3 py-1 rounded-full shadow whitespace-nowrap">
                  ★ {card.badge}
                </span>
              )}
              <p className="text-center text-sm font-black tracking-widest text-[var(--mg-text-primary)]">
                {PLANS[card.id].name.toUpperCase()}
              </p>
              <p className="text-center text-[11px] text-[var(--mg-text-muted)] mt-0.5 min-h-8">
                {card.tagline}
              </p>
              <p className="text-center mt-2">
                <span className="text-3xl font-black text-[var(--mg-text-primary)]">
                  Bs {priceOf(card.id)}
                </span>
                <span className="block text-[11px] font-bold text-[var(--mg-text-muted)]">
                  /{cycle === 'yearly' ? 'año (2 meses gratis)' : 'mes'}
                </span>
              </p>
              <ul className="mt-3 mb-4 space-y-1.5 flex-1">
                {card.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs font-semibold text-[var(--mg-text-secondary)]">
                    <span className="text-green-600 font-black">✓</span> {f}
                  </li>
                ))}
              </ul>
              {mine ? (
                <p className="text-center text-xs font-black text-[var(--mg-accent)] bg-[var(--mg-accent-bg)] border border-[var(--mg-accent-border)] rounded-xl py-2.5">
                  Tu plan actual
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => setPayPlan(card.id)}
                  className={`font-black py-2.5 rounded-xl text-xs active:scale-95 transition-all ${
                    card.id === 'pro'
                      ? 'bg-[var(--mg-accent)] text-white'
                      : 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-primary)] border border-[var(--mg-border)]'
                  }`}
                >
                  Seleccionar
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-[var(--mg-accent-bg-soft)] border border-[var(--mg-accent-border)] rounded-2xl p-4 mt-4 text-center space-y-2.5">
        {sent ? (
          <div className="bg-[var(--mg-success-bg)] border border-green-200 rounded-xl px-3 py-2.5">
            <p className="text-xs font-black text-[var(--mg-success-text)]">
              ✅ Comprobante enviado. Lo revisamos y activamos tu plan el mismo día.
            </p>
          </div>
        ) : (
          <p className="text-xs text-[var(--mg-text-muted)] font-medium">
            Pagas por QR y subes tu comprobante. Sin permanencia: vuelve a Gratis cuando quieras.
          </p>
        )}

        {myPayments.length > 0 && (
          <div className="text-left pt-1">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)] mb-1.5">
              Mis pagos
            </p>
            <div className="space-y-1.5">
              {myPayments.slice(0, 3).map((p) => (
                <div key={p.id} className="flex items-center justify-between bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] rounded-xl px-3 py-2">
                  <span className="text-xs font-bold text-[var(--mg-text-secondary)]">
                    {p.planId === 'premium' ? '👑 Premium' : '⭐ Pro'} · Bs {Number(p.amount).toFixed(0)}
                  </span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    p.status === 'approved' ? 'bg-green-100 text-green-700'
                    : p.status === 'rejected' ? 'bg-red-100 text-red-700'
                    : 'bg-amber-100 text-amber-700'
                  }`}>
                    {p.status === 'approved' ? 'Aprobado' : p.status === 'rejected' ? 'Rechazado' : 'En revisión'}
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => refreshPlan()}
              className="w-full text-center text-[11px] font-bold text-[var(--mg-accent)] mt-2"
            >
              🔄 Ya me aprobaron · revisar mi plan
            </button>
          </div>
        )}
      </div>

      {payPlan && (
        <PaymentModal
          businessId={businessId}
          initialPlan={payPlan}
          initialCycle={cycle}
          onClose={() => setPayPlan(null)}
          onSent={() => { setPayPlan(null); setSent(true); refreshPlan(); }}
        />
      )}
    </div>
  );
}
