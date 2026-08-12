import React, { useEffect } from 'react';

export function QrModal({ showQr, settings, onClose, onNavigateSettings }) {
  useEffect(() => {
    if (!showQr) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showQr, onClose]);

  if (!showQr) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 mg-backdrop-in"
      onClick={onClose}
    >
      <div
        className="bg-[var(--mg-bg-surface)] rounded-[28px] p-6 w-full max-w-sm text-center shadow-2xl relative mg-modal-in border border-[var(--mg-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          type="button"
          aria-label="Cerrar modal QR"
          className="absolute top-4 right-4 w-9 h-9 bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] rounded-full text-[var(--mg-text-muted)] hover:text-[var(--mg-text-primary)] font-bold text-lg flex items-center justify-center min-h-[44px] min-w-[44px]"
        >
          ×
        </button>

        <h3 className="text-lg font-black text-[var(--mg-text-primary)] mb-4">📲 QR de Cobro</h3>

        {settings?.qrData ? (
          <div className="space-y-4">
            <div className="p-3 bg-white rounded-2xl border-2 border-[var(--mg-accent-border)] inline-block shadow-sm">
              <img
                src={settings.qrData}
                alt="QR de Cobro para escanear"
                className="w-56 h-56 object-contain mx-auto"
              />
            </div>
            <p className="text-xs text-[var(--mg-text-muted)] leading-relaxed font-medium px-2">
              Muestra este código a tus clientes para recibir pagos por Simple / Transferencia QR.
            </p>
          </div>
        ) : (
          <div className="py-6 space-y-4">
            <span className="text-5xl block">⚠️</span>
            <p className="text-xs font-semibold text-[var(--mg-text-secondary)] px-4 leading-relaxed">
              Aún no has configurado tu código QR de cobro. Puedes subirlo en la sección de Ajustes.
            </p>
            <button
              onClick={() => {
                onClose();
                onNavigateSettings();
              }}
              type="button"
              className="bg-[var(--mg-accent)] hover:bg-[var(--mg-accent-hover)] text-white font-extrabold py-3 px-6 rounded-xl text-xs active:scale-95 transition-all shadow-md min-h-[44px]"
            >
              Ir a Ajustes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
