import React, { useEffect, useState } from 'react';
import { db } from '../services/localDb';
import { retryOperation, discardOperation } from '../services/syncEngine';
import { useSyncStatus } from '../hooks/useSyncStatus';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl overflow-hidden bg-white border border-gray-100 shadow-2xl rounded-2xl animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Cola de Sincronización</h2>
              <p className="text-xs text-gray-500 mt-0.5">Operaciones pendientes y con error en este dispositivo.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
          {operations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="p-4 bg-green-50 text-green-500 rounded-full mb-3">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-gray-900 font-medium">¡Todo al día!</p>
              <p className="text-xs text-gray-500 mt-1">No hay operaciones pendientes ni errores en la cola de salida.</p>
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
                      ? 'border-red-200 bg-red-50/30' 
                      : hasRetryError 
                        ? 'border-amber-200 bg-amber-50/30' 
                        : 'border-blue-100 bg-blue-50/20'
                  }`}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 text-xs font-extrabold uppercase bg-gray-900 text-white rounded">
                        {op.operation_type.replace(/_/g, ' ')}
                      </span>

                      {/* Status Tag */}
                      {isErrorStatus ? (
                        <span className="px-2 py-0.5 text-[11px] font-bold bg-red-100 text-red-700 rounded-md border border-red-200">
                          ⚠️ Error Definitivo ({op.retry_count || 0}/5 reintentos)
                        </span>
                      ) : hasRetryError ? (
                        <span className="px-2 py-0.5 text-[11px] font-bold bg-amber-100 text-amber-800 rounded-md border border-amber-200">
                          ⏳ Reintentando ({op.retry_count || 0}/5 reintentos)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[11px] font-bold bg-blue-100 text-blue-700 rounded-md border border-blue-200">
                          ⏳ Pendiente de envío
                        </span>
                      )}

                      <span className="text-xs text-gray-500">
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
                      <p className="text-xs font-semibold text-gray-700 truncate">
                        {summary}
                      </p>
                    )}

                    {op.error_details && (
                      <div className="text-xs font-mono text-red-800 bg-red-50 p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap border border-red-200">
                        <strong className="block mb-0.5 text-red-900 font-bold">Último Error Registrado:</strong>
                        {op.error_details}
                      </div>
                    )}
                  </div>

                  <div className="flex md:flex-col items-stretch gap-2 shrink-0">
                    <button
                      disabled={loading}
                      onClick={() => handleRetry(op.id)}
                      className="flex-1 md:flex-none px-3.5 py-2 text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg hover:shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                    >
                      Reintentar ahora
                    </button>
                    <button
                      disabled={loading}
                      onClick={() => handleDiscard(op.id)}
                      className="flex-1 md:flex-none px-3.5 py-2 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg hover:shadow-sm transition-all disabled:opacity-50 cursor-pointer"
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
        <div className="flex items-center justify-end gap-3 p-6 bg-gray-50 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:text-gray-900 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
