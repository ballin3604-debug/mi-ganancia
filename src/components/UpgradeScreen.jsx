import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePlan } from '../hooks/usePlan';
import { PLANS, PLAN_ORDER } from '../config/plans';
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

const COMPARE_ROWS = [
  { label: 'Productos', free: '100', pro: 'Ilimitados', premium: 'Ilimitados' },
  { label: 'Usuarios', free: '1', pro: '5', premium: '15' },
  { label: 'Escáner de códigos', free: false, pro: true, premium: true },
  { label: 'Reportes avanzados', free: false, pro: true, premium: true },
  { label: 'Exportar PDF', free: false, pro: true, premium: true },
  { label: 'Equipo (cajeros)', free: false, pro: true, premium: true },
  { label: 'Sucursales y almacenes', free: false, pro: false, premium: true },
];

export default function UpgradeScreen({ feature, title, compact = false }) {
  const { businessId } = useAuth();
  const { plan, planId, isTrial, trialDaysLeft, refreshPlan } = usePlan();
  const [payPlan, setPayPlan] = useState(null);
  const [sent, setSent] = useState(false);
  const [myPayments, setMyPayments] = useState([]);

  useEffect(() => {
    if (!businessId) return;
    getMyPayments(businessId).then(setMyPayments).catch(() => setMyPayments([]));
  }, [businessId, sent]);

  return (
    <div className={`mg-fade-in w-full mx-auto max-w-2xl ${compact ? '' : 'p-4 sm:p-6 pb-24'}`}>
      <div className="text-center mb-5">
        <p className="text-4xl mb-2">🚀</p>
        <h2 className="text-xl font-black text-[var(--mg-text-primary)]">
          {title || (feature ? `Desbloquea ${FEATURE_NAMES[feature] || 'esta función'}` : 'Sube de plan')}
        </h2>
        <p className="text-sm text-[var(--mg-text-muted)] mt-1">
          Estás en <strong>{plan.name}</strong>
          {isTrial ? ` (prueba Pro: ${trialDaysLeft} días)` : ''}. Tus datos están a salvo.
        </p>
      </div>

      <div className="bg-[var(--mg-bg-surface)] rounded-[20px] border border-[var(--mg-border)] overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--mg-bg-elevated)]">
              <th className="p-3 text-left text-xs font-black text-[var(--mg-text-secondary)]">Función</th>
              {PLAN_ORDER.map((id) => (
                <th key={id} className="p-3 text-center text-xs font-black">
                  <span className={planId === id ? 'text-[var(--mg-accent)]' : 'text-[var(--mg-text-primary)]'}>
                    {PLANS[id].name}
                  </span>
                  <span className="block text-[10px] font-bold text-[var(--mg-text-muted)]">
                    {PLANS[id].priceMonthly === 0 ? 'Gratis' : `Bs ${PLANS[id].priceMonthly}/mes`}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map((row) => (
              <tr key={row.label} className="border-t border-[var(--mg-separator)]">
                <td className="p-3 text-xs font-bold text-[var(--mg-text-secondary)]">{row.label}</td>
                {PLAN_ORDER.map((id) => {
                  const v = row[id];
                  return (
                    <td key={id} className="p-3 text-center">
                      {typeof v === 'boolean' ? (
                        v ? <span className="text-green-600 font-black">✓</span> : <span className="text-gray-300">—</span>
                      ) : (
                        <span className="text-xs font-bold text-[var(--mg-text-primary)]">{v}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-[var(--mg-accent-bg-soft)] border border-[var(--mg-accent-border)] rounded-2xl p-4 mt-4 text-center space-y-2.5">
        {sent ? (
          <div className="bg-[var(--mg-success-bg)] border border-green-200 rounded-xl px-3 py-2.5">
            <p className="text-xs font-black text-[var(--mg-success-text)]">
              ✅ Comprobante enviado. Lo revisamos y activamos tu plan el mismo día.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm font-bold text-[var(--mg-text-primary)]">
              💳 Paga por QR y activa hoy mismo
            </p>
            <div className="flex gap-2">
              <button
                type="button" onClick={() => setPayPlan('pro')}
                className="flex-1 bg-[var(--mg-accent)] text-white font-black py-2.5 rounded-xl text-xs active:scale-95"
              >
                ⭐ Pro · Bs 49
              </button>
              <button
                type="button" onClick={() => setPayPlan('premium')}
                className="flex-1 bg-[var(--mg-text-primary)] text-white font-black py-2.5 rounded-xl text-xs active:scale-95"
              >
                👑 Premium · Bs 99
              </button>
            </div>
          </>
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
          onClose={() => setPayPlan(null)}
          onSent={() => { setPayPlan(null); setSent(true); refreshPlan(); }}
        />
      )}
    </div>
  );
}
