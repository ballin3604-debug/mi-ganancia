import { useState } from 'react';
import { PLANS } from '../config/plans';
import { PAY_QR_IMAGE, PAY_ALIAS } from '../config/billing';
import { uploadReceipt, createPayment } from '../services/payments';
import { useImageUpload } from '../hooks/useImageUpload';
import PhotoCamera from './PhotoCamera';

const CYCLES = [
  { id: 'monthly', label: 'Mensual', months: 1 },
  { id: 'yearly', label: 'Anual · 2 meses gratis', months: 10 },
];

function cycleAmount(plan, cycle) {
  if (cycle === 'yearly') return Number(plan.priceMonthly) * 10;
  return Number(plan.priceMonthly);
}

// Pagar Pro/Premium: elige plan y ciclo, paga al QR, sube el comprobante.
export default function PaymentModal({ businessId, initialPlan = 'pro', onClose, onSent }) {
  const { pickImage } = useImageUpload();
  const [planId, setPlanId] = useState(initialPlan === 'premium' ? 'premium' : 'pro');
  const [cycle, setCycle] = useState('monthly');
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
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 mg-backdrop-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--mg-bg-surface)] w-full max-w-md rounded-t-[28px] sm:rounded-[28px] border border-[var(--mg-border)] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col mg-modal-in"
      >
        <div className="p-4 border-b border-[var(--mg-separator)] flex items-center justify-between bg-[var(--mg-bg-elevated)]">
          <div>
            <h3 className="font-extrabold text-[var(--mg-text-primary)] text-sm">💳 Activar plan</h3>
            <p className="text-[11px] text-[var(--mg-text-muted)]">Paga por QR y sube tu comprobante</p>
          </div>
          <button
            type="button" onClick={onClose}
            className="w-8 h-8 rounded-full bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] flex items-center justify-center font-bold text-base text-[var(--mg-text-muted)]"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-4">
          {/* Plan */}
          <div>
            <p className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider mb-1.5">Plan</p>
            <div className="grid grid-cols-2 gap-2">
              {['pro', 'premium'].map((id) => (
                <button
                  key={id} type="button" onClick={() => setPlanId(id)}
                  className={`py-2.5 rounded-2xl border-2 font-black text-sm transition-all ${planId === id ? 'border-[var(--mg-accent)] bg-[var(--mg-accent-bg)] text-[var(--mg-accent)]' : 'border-[var(--mg-border)] text-[var(--mg-text-muted)]'}`}
                >
                  {id === 'pro' ? '⭐ Pro' : '👑 Premium'}
                  <span className="block text-[11px] font-bold opacity-80">Bs {PLANS[id].priceMonthly}/mes</span>
                </button>
              ))}
            </div>
          </div>

          {/* Ciclo */}
          <div>
            <p className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider mb-1.5">Período</p>
            <div className="grid grid-cols-2 gap-2">
              {CYCLES.map((c) => (
                <button
                  key={c.id} type="button" onClick={() => setCycle(c.id)}
                  className={`py-2.5 rounded-2xl border-2 font-bold text-xs transition-all ${cycle === c.id ? 'border-[var(--mg-accent)] bg-[var(--mg-accent-bg)] text-[var(--mg-accent)]' : 'border-[var(--mg-border)] text-[var(--mg-text-muted)]'}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[var(--mg-accent-bg-soft)] border border-[var(--mg-accent-border)] rounded-2xl p-3.5 text-center">
            <p className="text-[11px] font-bold text-[var(--mg-text-muted)] uppercase tracking-wider">Total a pagar</p>
            <p className="text-3xl font-black text-[var(--mg-accent)]">Bs {amount.toFixed(2)}</p>
            <p className="text-[11px] text-[var(--mg-text-muted)] font-semibold">
              {plan.name} · {cycle === 'yearly' ? '12 meses' : '30 días'}
            </p>
          </div>

          {/* QR de cobro */}
          <div className="border border-[var(--mg-border)] rounded-2xl p-3.5 text-center space-y-2">
            <p className="text-xs font-extrabold text-[var(--mg-text-secondary)] uppercase tracking-wider">1️⃣ Paga a este QR</p>
            {PAY_QR_IMAGE ? (
              <img src={PAY_QR_IMAGE} alt="QR de pago Mi Ganancia" className="w-48 h-48 object-contain mx-auto bg-white rounded-xl border border-[var(--mg-border)]" />
            ) : (
              <div className="bg-[var(--mg-bg-elevated)] rounded-xl py-6 px-4">
                <p className="text-4xl mb-1">📲</p>
                <p className="text-sm font-black text-[var(--mg-text-primary)]">{PAY_ALIAS}</p>
                <p className="text-[11px] text-[var(--mg-text-muted)]">Configura tu QR en src/config/billing.js</p>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider block mb-1">
              2️⃣ N° de referencia (opcional)
            </label>
            <input
              type="text" value={reference} onChange={(e) => setReference(e.target.value)}
              placeholder="Ej: 123456" maxLength={30}
              className="mg-input font-mono text-sm"
            />
          </div>

          <div>
            <p className="text-xs font-extrabold text-[var(--mg-text-muted)] uppercase tracking-wider mb-1.5">
              3️⃣ Foto del comprobante *
            </p>
            {photo ? (
              <div className="relative">
                <img src={photo} alt="Comprobante" className="w-full max-h-56 object-contain rounded-2xl border-2 border-[var(--mg-accent-border)] bg-white" />
                <button
                  type="button" onClick={() => setPhoto('')}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white font-bold"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button" onClick={() => setShowCamera(true)}
                  className="bg-[var(--mg-accent-bg)] border border-[var(--mg-accent-border)] text-[var(--mg-accent)] font-extrabold py-2.5 rounded-xl text-xs active:scale-95"
                >
                  📷 Cámara
                </button>
                <label className="relative bg-[var(--mg-accent)] text-white font-extrabold py-2.5 rounded-xl text-xs text-center active:scale-95 cursor-pointer overflow-hidden">
                  🖼️ Galería
                  <input type="file" accept="image/*" onChange={handleFile} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                </label>
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs font-bold text-[var(--mg-danger)] bg-[var(--mg-danger-bg)] border border-red-200 rounded-xl px-3 py-2">
              ⚠️ {error}
            </p>
          )}

          <button type="submit" disabled={sending} className="mg-btn-primary w-full">
            {sending ? 'Enviando…' : 'Enviar comprobante'}
          </button>
          <p className="text-[11px] text-[var(--mg-text-muted)] text-center">
            Lo revisamos y activamos tu plan el mismo día.
          </p>
        </form>
      </div>

      {showCamera && (
        <div
          className="fixed inset-0 z-[80] bg-black/70 flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => setShowCamera(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--mg-bg-surface)] w-full max-w-md rounded-t-[28px] sm:rounded-[28px] p-4"
          >
            <PhotoCamera onCapture={(d) => { setPhoto(d); setShowCamera(false); }} />
            <button type="button" onClick={() => setShowCamera(false)} className="mg-btn-tertiary w-full mt-3 !py-2.5 text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
