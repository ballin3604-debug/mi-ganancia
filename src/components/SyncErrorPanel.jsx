import { useEffect, useState } from 'react';
import { db } from '../services/localDb';
import { retryOperation, discardOperation } from '../services/syncEngine';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { AppIcon } from './icons';

export function SyncErrorPanel({ businessId, isOpen, onClose }) {
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(false);
  const { pendingCount, errorCount } = useSyncStatus();

  const loadOperations = async () => {
    try {
      const list = await db.pending_operations.toArray();
      const scoped = list.filter((op) => !op.business_id || op.business_id === businessId);
      setOperations(scoped.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch (err) {
      console.error('Error loading pending operations:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadOperations();
    }
  }, [isOpen, pendingCount, errorCount]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleRetry = async (id) => {
    setLoading(true);
    try {
      await retryOperation(id, businessId);
      await loadOperations();
    } catch (err) {
      console.error('Error retrying operation:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDiscard = async (id) => {
    if (window.confirm('¿Estás seguro de descartar esta operación? Se perderán los datos locales que no se sincronizaron con el servidor.')) {
      setLoading(true);
      try {
        await discardOperation(id, businessId);
        await loadOperations();
      } catch (err) {
        console.error('Error discarding operation:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  const getPayloadSummary = (op) => {
    if (!op.payload) return '';
    const p = op.payload;
    if (p.client_name) return `Cliente: ${p.client_name}`;
    if (p.name) return `Producto: ${p.name}`;
    if (p.product_name) return `Producto: ${p.product_name}`;
    if (p.description) return `Detalle: ${p.description}`;
    if (p.total) return `Monto Total: Bs ${p.total}`;
    if (p.amount) return `Monto: Bs ${p.amount}`;
    return '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(11,30,41,0.55)] p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-panel-title"
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] animate-in fade-in zoom-in duration-200"
        style={{ boxShadow: 'var(--mg-shadow-lg)' }}
      >
        <div className="flex items-center justify-between border-b border-[var(--mg-border)] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg)]">
              <AppIcon name="sincronizar" size={22} />
            </div>
            <div>
              <h2 id="sync-panel-title" className="text-lg font-black tracking-tight text-[var(--mg-text-primary)] sm:text-xl">Cola de Sincronización</h2>
              <p className="mt-0.5 text-xs font-medium text-[var(--mg-text-muted)]">Operaciones pendientes y con error en este dispositivo.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar cola de sincronización"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--mg-text-muted)] transition-colors hover:bg-[var(--mg-bg-elevated)] hover:text-[var(--mg-text-secondary)]"
          >
            <AppIcon name="cerrar" size={20} color="var(--mg-text-muted)" />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-5 sm:p-6">
          {operations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--mg-success-border)] bg-[var(--mg-success-bg)]">
                <AppIcon name="ok" size={28} color="var(--mg-success)" />
              </div>
              <p className="text-[var(--mg-text-primary)] font-medium">¡Todo al día!</p>
              <p className="text-xs text-[var(--mg-text-muted)] mt-1">No hay operaciones pendientes ni errores en la cola de salida.</p>
            </div>
          ) : (
            operations.map((op) => {
              const summary = getPayloadSummary(op);
              const isErrorStatus = op.status === 'error';
              const hasRetryError = op.retry_count > 0 || op.error_details;

              return (
                <div 
                  key={op.id}
                  className={`p-4 border rounded-xl flex flex-col md:flex-row md:items-start justify-between gap-4 transition-all ${
                    isErrorStatus 
                      ? 'border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)]'
                      : hasRetryError
                        ? 'border-[var(--mg-gold-border)] bg-[var(--mg-warning-bg)]'
                        : 'border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg-soft)]'
                  }`}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 text-xs font-extrabold uppercase bg-[var(--mg-brand-deep)] text-white rounded">
                        {op.operation_type.replace(/_/g, ' ')}
                      </span>

                      {/* Status Tag */}
                      {isErrorStatus ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)] px-2 py-0.5 text-[11px] font-bold text-[var(--mg-danger)]">
                          <AppIcon name="alerta" size={12} color="var(--mg-danger)" /> Error definitivo ({op.retry_count || 0}/5 reintentos)
                        </span>
                      ) : hasRetryError ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] px-2 py-0.5 text-[11px] font-bold text-[var(--mg-gold-text)]">
                          <AppIcon name="reloj" size={12} color="var(--mg-gold-text)" /> Reintentando ({op.retry_count || 0}/5 reintentos)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md border border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg)] px-2 py-0.5 text-[11px] font-bold text-[var(--mg-accent)]">
                          <AppIcon name="reloj" size={12} color="var(--mg-accent)" /> Pendiente de envío
                        </span>
                      )}

                      <span className="text-xs text-[var(--mg-text-muted)]">
                        {new Date(op.created_at).toLocaleString('es-BO', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </span>
                    </div>

                    {summary && (
                      <p className="text-xs font-semibold text-[var(--mg-text-secondary)] truncate">
                        {summary}
                      </p>
                    )}

                    {op.error_details && (
                      <div className="text-xs font-mono text-[var(--mg-danger)] bg-[var(--mg-danger-bg)] p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap border border-[var(--mg-danger-border)]">
                        <strong className="block mb-0.5 text-[var(--mg-danger)] font-bold">Último Error Registrado:</strong>
                        {op.error_details}
                      </div>
                    )}
                  </div>

                  <div className="flex md:flex-col items-stretch gap-2 shrink-0">
                    <button
                      disabled={loading}
                      onClick={() => handleRetry(op.id)}
                      className="min-h-[44px] flex-1 cursor-pointer rounded-lg border border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] px-3.5 py-2 text-xs font-bold text-[var(--mg-success-text)] transition-all hover:bg-[var(--mg-success-border)] hover:shadow-sm disabled:opacity-50 md:flex-none"
                    >
                      Reintentar ahora
                    </button>
                    <button
                      disabled={loading}
                      onClick={() => handleDiscard(op.id)}
                      className="min-h-[44px] flex-1 cursor-pointer rounded-lg border border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)] px-3.5 py-2 text-xs font-bold text-[var(--mg-danger)] transition-all hover:bg-[var(--mg-danger-border)] hover:shadow-sm disabled:opacity-50 md:flex-none"
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] p-5 sm:p-6">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] cursor-pointer rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] px-5 py-2.5 text-sm font-semibold text-[var(--mg-text-secondary)] transition-colors hover:bg-[var(--mg-bg-elevated)] hover:text-[var(--mg-text-primary)]"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
