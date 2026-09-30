import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AYUDA, claveAyudaParaRuta } from '../utils/texto-ayuda';

// Botón flotante "?" + modal de ayuda contextual.
// Se monta una sola vez en Layout y automáticamente muestra la ayuda
// de la pantalla actual (ventas, inventario, fiados, etc.).
export default function Ayuda() {
  const location = useLocation();
  const [abierto, setAbierto] = useState(false);

  // Cerrar con Escape y bloquear scroll del fondo mientras está abierto
  useEffect(() => {
    if (!abierto) return;
    function onKey(e) {
      if (e.key === 'Escape') setAbierto(false);
    }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [abierto]);

  // Si el usuario cambia de pantalla, cerrar el modal para no mostrar ayuda vieja
  useEffect(() => {
    setAbierto(false);
  }, [location.pathname, location.search]);

  const clave = claveAyudaParaRuta(location.pathname, location.search);
  const info = AYUDA[clave] || AYUDA.inicio;

  return (
    <>
      {/* Botón flotante — encima del tab bar en móvil, esquina en desktop */}
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title={`¿Qué es esto? ${info.titulo}`}
        aria-label="Ayuda: qué es esta pantalla"
        className="fixed z-40 bottom-24 lg:bottom-6 right-4 lg:right-6 w-11 h-11 rounded-full bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] shadow-lg flex items-center justify-center text-lg font-black text-[var(--mg-accent)] active:scale-90 hover:shadow-xl transition-all"
      >
        ?
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 mg-backdrop-in"
          onClick={() => setAbierto(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--mg-bg-surface)] w-full max-w-md rounded-t-[28px] sm:rounded-[28px] border border-[var(--mg-border)] shadow-2xl overflow-hidden max-h-[88vh] flex flex-col mg-modal-in"
          >
            {/* Encabezado */}
            <div className="p-5 pb-4 border-b border-[var(--mg-separator)] bg-[var(--mg-bg-elevated)] flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] flex items-center justify-center text-2xl shrink-0">
                {info.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-extrabold text-[var(--mg-text-primary)] text-[15px] leading-tight">
                  {info.titulo}
                </h3>
                <p className="text-[13px] text-[var(--mg-accent)] font-bold mt-0.5 leading-snug">
                  {info.linea}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar ayuda"
                className="w-8 h-8 rounded-full bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] flex items-center justify-center font-bold text-[var(--mg-text-muted)] shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Contenido */}
            <div className="p-5 overflow-y-auto space-y-4">
              <p className="text-[13.5px] text-[var(--mg-text-secondary)] leading-relaxed">
                {info.explicacion}
              </p>

              {info.pasos?.length > 0 && (
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)] mb-2">
                    Cómo se usa
                  </p>
                  <ol className="space-y-2">
                    {info.pasos.map((paso, i) => (
                      <li key={i} className="flex gap-2.5 items-start text-[13px]">
                        <span className="w-5 h-5 rounded-full bg-[var(--mg-accent-bg)] border border-[var(--mg-accent-border)] text-[var(--mg-accent)] text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span className="text-[var(--mg-text-secondary)] font-medium leading-snug">
                          {paso}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {info.ejemplo && (
                <div className="bg-[var(--mg-accent-bg-soft)] border border-[var(--mg-accent-border)] rounded-2xl p-3.5">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--mg-accent)] mb-1">
                    Ejemplo de tienda
                  </p>
                  <p className="text-[13px] text-[var(--mg-text-secondary)] leading-relaxed italic">
                    “{info.ejemplo}”
                  </p>
                </div>
              )}

              {info.tip && (
                <p className="text-[12.5px] text-[var(--mg-text-muted)] leading-relaxed flex gap-1.5">
                  <span>💡</span>
                  <span>
                    <b>Consejo:</b> {info.tip}
                  </span>
                </p>
              )}
            </div>

            <div className="p-4 border-t border-[var(--mg-separator)]">
              <button onClick={() => setAbierto(false)} className="mg-btn-primary w-full">
                ¡Entendido!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
