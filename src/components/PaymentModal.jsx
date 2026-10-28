import { useState } from 'react';
import { PLANS } from '../config/plans';
import { PAY_QR_IMAGE, PAY_ALIAS } from '../config/billing';
import { uploadReceipt, createPayment } from '../services/payments';
import { useImageUpload } from '../hooks/useImageUpload';
import PhotoCamera from './PhotoCamera';
import { AppIcon } from './icons';

const CYCLES = [
  { id: 'monthly', label: 'Mensual', months: 1 },
  { id: 'yearly', label: 'Anual · 2 meses gratis', months: 10 },
];

function cycleAmount(plan, cycle) {
  if (cycle === 'yearly') return Number(plan.priceMonthly) * 10;
  return Number(plan.priceMonthly);
}

function StepNumber({ value }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--mg-accent-bg)] text-[11px] font-black text-[var(--mg-accent-text)]">
      {value}
    </span>
  );
}

export default function PaymentModal({ businessId, initialPlan = 'pro', initialCycle = 'monthly', onClose, onSent }) {
  const { pickImage } = useImageUpload();
  const [planId, setPlanId] = useState(initialPlan === 'premium' ? 'premium' : 'pro');
  const [cycle, setCycle] = useState(initialCycle === 'yearly' ? 'yearly' : 'monthly');
  const [reference, setReference] = useState('');
  const [photo, setPhoto] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const plan = PLANS[planId];
  const amount = cycleAmount(plan, cycle);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    try { e.target.value = ''; } catch { /* ignore */ }
    if (!file) return;
    try {
      const data = await pickImage(file, 800);
      if (data) setPhoto(data);
    } catch {
      setError('No se pudo leer la foto. Prueba con otra.');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!photo) {
      setError('Sube la foto del comprobante para que podamos verificar tu pago.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const path = await uploadReceipt(businessId, photo);
      await createPayment(businessId, {
        planId, billingCycle: cycle, amount, method: 'qr',
        reference, receiptPath: path,
      });
      onSent();
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo enviar. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4 mg-backdrop-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mg-modal-in flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] shadow-2xl sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-title"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--mg-separator)] bg-[var(--mg-bg-elevated)] px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg)]">
              <AppIcon name="plan" size={20} />
            </span>
            <div className="min-w-0">
              <h3 id="payment-title" className="truncate text-sm font-extrabold text-[var(--mg-text-primary)]">Activar plan</h3>
              <p className="text-[11px] font-medium text-[var(--mg-text-muted)]">Paga por QR y sube tu comprobante</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar activación de plan"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] text-[var(--mg-text-muted)] transition-colors hover:text-[var(--mg-text-primary)]"
          >
            <AppIcon name="cerrar" size={17} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto p-4 sm:p-5">
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[var(--mg-text-muted)]">Plan</p>
            <div className="grid grid-cols-2 gap-2">
              {['pro', 'premium'].map((id) => {
                const activePlan = planId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPlanId(id)}
                    aria-pressed={activePlan}
                    className={`rounded-2xl border p-3 text-left transition-all ${
                      activePlan
                        ? 'border-[var(--mg-accent)] bg-[var(--mg-accent-bg)] shadow-[var(--mg-shadow-sm)]'
                        : 'border-[var(--mg-border)] bg-[var(--mg-bg-surface)] hover:border-[var(--mg-border-hover)]'
                    }`}
                  >
                    <span className={`flex items-center gap-2 text-sm font-black ${activePlan ? 'text-[var(--mg-accent-text)]' : 'text-[var(--mg-text-primary)]'}`}>
                      <AppIcon name={id === 'pro' ? 'plan' : 'ranking'} size={16} />
                      {id === 'pro' ? 'Pro' : 'Premium'}
                    </span>
                    <span className={`mt-1 block text-[11px] font-semibold ${activePlan ? 'text-[var(--mg-accent-text)]' : 'text-[var(--mg-text-muted)]'}`}>
                      Bs {PLANS[id].priceMonthly}/mes
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[var(--mg-text-muted)]">Período</p>
            <div className="grid grid-cols-2 gap-2">
              {CYCLES.map((option) => {
                const activeCycle = cycle === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setCycle(option.id)}
                    aria-pressed={activeCycle}
                    className={`rounded-2xl border px-3 py-2.5 text-xs font-bold transition-all ${
                      activeCycle
                        ? 'border-[var(--mg-accent)] bg-[var(--mg-accent-bg)] text-[var(--mg-accent-text)]'
                        : 'border-[var(--mg-border)] text-[var(--mg-text-muted)] hover:border-[var(--mg-border-hover)]'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg-soft)] p-4 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--mg-text-muted)]">Total a pagar</p>
            <p className="mt-1 text-3xl font-black tabular-nums text-[var(--mg-accent-text)]">Bs {amount.toFixed(2)}</p>
            <p className="mt-1 text-[11px] font-semibold text-[var(--mg-text-secondary)]">
              {plan.name} · {cycle === 'yearly' ? '12 meses' : '30 días'}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-4">
            <div className="mb-3 flex items-center gap-2">
              <StepNumber value="1" />
              <p className="text-xs font-extrabold text-[var(--mg-text-primary)]">Paga a este QR</p>
            </div>
            {PAY_QR_IMAGE ? (
              <img
                src={PAY_QR_IMAGE}
                alt="QR de pago Mi Ganancia"
                className="mx-auto h-48 w-48 rounded-xl border border-[var(--mg-border)] bg-white object-contain p-2"
              />
            ) : (
              <div className="rounded-xl bg-[var(--mg-bg-elevated)] px-4 py-6 text-center">
                <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg)]">
                  <AppIcon name="qr" size={24} />
                </span>
                <p className="text-sm font-black text-[var(--mg-text-primary)]">{PAY_ALIAS}</p>
                <p className="mt-1 text-[11px] font-medium text-[var(--mg-text-muted)]">Configura tu QR en src/config/billing.js</p>
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <StepNumber value="2" />
              <label htmlFor="payment-reference" className="text-xs font-extrabold text-[var(--mg-text-primary)]">
                N° de referencia <span className="font-medium text-[var(--mg-text-muted)]">(opcional)</span>
              </label>
            </div>
            <input
              id="payment-reference"
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ej: 123456"
              maxLength={30}
              className="mg-input font-mono text-sm"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <StepNumber value="3" />
              <p className="text-xs font-extrabold text-[var(--mg-text-primary)]">
                Foto del comprobante <span className="text-[var(--mg-danger)]">*</span>
              </p>
            </div>
            {photo ? (
              <div className="relative">
                <img src={photo} alt="Comprobante" className="max-h-56 w-full rounded-2xl border border-[var(--mg-accent-border)] bg-white object-contain" />
                <button
                  type="button"
                  onClick={() => setPhoto('')}
                  aria-label="Quitar comprobante"
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/75"
                >
                  <AppIcon name="cerrar" size={15} color="#fff" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowCamera(true)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg)] py-2.5 text-xs font-extrabold text-[var(--mg-accent-text)] transition-transform active:scale-95"
                >
                  <AppIcon name="camara" size={14} /> Cámara
                </button>
                <label className="relative flex cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-xl bg-[var(--mg-accent)] py-2.5 text-xs font-extrabold text-white transition-transform active:scale-95">
                  <AppIcon name="galeria" size={14} color="#fff" /> Galería
                  <input type="file" accept="image/*" onChange={handleFile} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                </label>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)] px-3 py-2.5">
              <AppIcon name="cancelar" size={16} className="mt-0.5" />
              <p className="text-xs font-bold text-[var(--mg-danger)]">{error}</p>
            </div>
          )}

          <div className="space-y-2.5">
            <button type="submit" disabled={sending} className="mg-btn-primary w-full">
              {sending ? 'Enviando…' : 'Enviar comprobante'}
            </button>
            <p className="flex items-center justify-center gap-1.5 text-center text-[11px] font-medium text-[var(--mg-text-muted)]">
              <AppIcon name="reloj" size={13} />
              Lo revisamos y activamos tu plan el mismo día.
            </p>
          </div>
        </form>
      </div>

      {showCamera && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
          onClick={() => setShowCamera(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-4 sm:rounded-3xl"
            role="dialog"
            aria-modal="true"
            aria-label="Tomar foto del comprobante"
          >
            <PhotoCamera onCapture={(d) => { setPhoto(d); setShowCamera(false); }} />
            <button type="button" onClick={() => setShowCamera(false)} className="mg-btn-tertiary mt-3 w-full !py-2.5 text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
