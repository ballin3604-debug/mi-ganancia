import { useState, useEffect, useCallback } from 'react';
import { getAllPayments, getReceiptUrl, reviewPayment } from '../../services/payments';

function formatDate(ts) {
  const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
  if (!d || isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-BO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Pestaña Pagos del Panel Admin: ver comprobantes y aprobar/rechazar.
// Aprobar extiende la suscripción automáticamente (Edge Function).
export default function PaymentsTab() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [receiptUrls, setReceiptUrls] = useState({});
  const [processing, setProcessing] = useState('');
  const [note, setNote] = useState('');
  const [reviewing, setReviewing] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      setPayments(await getAllPayments());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function openReceipt(p) {
    if (receiptUrls[p.id]) return;
    try {
      const url = await getReceiptUrl(p.receiptUrl);
      setReceiptUrls((prev) => ({ ...prev, [p.id]: url }));
    } catch (err) {
      alert('No se pudo abrir el comprobante.');
    }
  }

  async function handleReview(p, action) {
    setProcessing(p.id);
    try {
      const res = await reviewPayment(p.id, action, note);
      setReviewing(null);
      setNote('');
      await fetchAll();
      if (res?.fallback && action === 'approve') {
        alert('Pago aprobado, pero extiende la suscripción manualmente (función no desplegada).');
      }
    } catch (err) {
      alert(`No se pudo procesar.\n\n${err?.message || err}`);
    } finally {
      setProcessing('');
    }
  }

  const pending = payments.filter((p) => p.status === 'pending');
  const shown = filter === 'pending' ? pending : payments.filter((p) => p.status !== 'pending');

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {[
          { key: 'pending', label: `Pendientes (${pending.length})` },
          { key: 'all', label: `Todos (${payments.length})` },
        ].map((f) => (
          <button
            key={f.key} type="button" onClick={() => setFilter(f.key)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${filter === f.key ? 'bg-[var(--mg-text-primary)] text-white' : 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="text-center py-12 text-[var(--mg-text-faint)]">
          <p className="text-4xl mb-3">💳</p>
          <p className="font-semibold">{filter === 'pending' ? 'Sin pagos por revisar' : 'Sin pagos aún'}</p>
        </div>
      ) : shown.map((p) => (
        <div key={p.id} className="bg-[var(--mg-bg-surface)] rounded-2xl p-4 border-2 border-[var(--mg-border)] shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-black text-[var(--mg-text-primary)]">
                {p.planId === 'premium' ? '👑 Premium' : '⭐ Pro'} · Bs {Number(p.amount).toFixed(0)}
              </p>
              <p className="text-[11px] text-[var(--mg-text-faint)] font-mono truncate">Negocio: {p.businessId.slice(0, 13)}…</p>
              <p className="text-[11px] text-[var(--mg-text-faint)]">
                {p.billingCycle === 'yearly' ? 'Anual' : 'Mensual'} · {formatDate(p.createdAt)}
                {p.reference ? ` · Ref: ${p.reference}` : ''}
              </p>
            </div>
            <span className={`text-[10px] font-black px-2 py-1 rounded-full shrink-0 ${
              p.status === 'approved' ? 'bg-green-100 text-green-700'
              : p.status === 'rejected' ? 'bg-red-100 text-red-700'
              : 'bg-amber-100 text-amber-700'
            }`}>
              {p.status === 'approved' ? 'Aprobado' : p.status === 'rejected' ? 'Rechazado' : 'Pendiente'}
            </span>
          </div>

          {p.receiptUrl && (
            <div>
              {!receiptUrls[p.id] ? (
                <button
                  type="button" onClick={() => openReceipt(p)}
                  className="w-full bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] rounded-xl py-2.5 text-xs font-bold text-[var(--mg-text-secondary)] active:scale-95"
                >
                  🧾 Ver comprobante
                </button>
              ) : (
                <img src={receiptUrls[p.id]} alt="Comprobante de pago" className="w-full max-h-72 object-contain rounded-xl border border-[var(--mg-border)] bg-white" />
              )}
            </div>
          )}

          {p.status === 'pending' && (
            reviewing === p.id ? (
              <div className="space-y-2 bg-[var(--mg-bg-elevated)] rounded-xl p-3">
                <input
                  type="text" value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="Nota (opcional)"
                  className="w-full border border-[var(--mg-border)] rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button" onClick={() => { setReviewing(null); setNote(''); }}
                    className="flex-1 bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] font-bold py-2.5 rounded-xl text-xs"
                  >
                    Atrás
                  </button>
                  <button
                    type="button" onClick={() => handleReview(p, 'reject')} disabled={processing === p.id}
                    className="flex-1 bg-[var(--mg-danger-bg)] text-[var(--mg-danger)] font-bold py-2.5 rounded-xl text-xs disabled:opacity-50"
                  >
                    ✕ Rechazar
                  </button>
                  <button
                    type="button" onClick={() => handleReview(p, 'approve')} disabled={processing === p.id}
                    className="flex-[2] bg-[var(--mg-accent)] text-white font-bold py-2.5 rounded-xl text-xs disabled:opacity-50"
                  >
                    {processing === p.id ? '…' : '✓ Aprobar y activar'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button" onClick={() => setReviewing(p.id)}
                className="w-full bg-[var(--mg-accent)] text-white font-bold py-2.5 rounded-xl text-sm active:scale-95"
              >
                Revisar pago
              </button>
            )
          )}
        </div>
      ))}
    </div>
  );
}
