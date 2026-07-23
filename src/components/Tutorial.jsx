import { useEffect, useState } from 'react';

const STEPS = [
  {
    title: 'Tu inicio',
    description: 'Aquí ves todo lo importante: ventas del día, alertas y resumen del mes.',
    targetSelector: '[data-tutorial="dashboard"]',
    placement: 'bottom',
  },
  {
    title: 'Hacer ventas',
    description: 'Toca aquí para registrar una nueva venta. Es lo que más vas a usar.',
    targetSelector: '[data-tutorial="sales"]',
    placement: 'top',
  },
  {
    title: 'Tu inventario',
    description: 'Agrega tus productos con foto, precio y stock. La app cuenta por ti.',
    targetSelector: '[data-tutorial="inventory"]',
    placement: 'top',
  },
  {
    title: 'Egresos del negocio',
    description: 'Anota cuánto gastas en compras y servicios para saber tu ganancia real.',
    targetSelector: '[data-tutorial="expenses"]',
    placement: 'top',
  },
  {
    title: '¡Listo!',
    description: 'Ya conoces lo básico. Si necesitas ayuda, todo está en Ajustes.',
    targetSelector: null,
    placement: 'center',
  },
];

export default function Tutorial({ onFinish }) {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isCenter = current.placement === 'center';

  useEffect(() => {
    // 1. Al cambiar de paso, hacemos scroll hacia el elemento una sola vez
    if (current.targetSelector) {
      const el = document.querySelector(current.targetSelector);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // 2. Calculamos sus coordenadas exactas en la pantalla
    function updateRect() {
      if (!current.targetSelector) {
        setTargetRect(null);
        return;
      }
      const el = document.querySelector(current.targetSelector);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      }
    }

    // Pequeño delay para que el DOM se acomode inicialmente
    const t = setTimeout(updateRect, 100);
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [step, current.targetSelector]);

  function next() {
    if (isLast) {
      try { localStorage.setItem('mg_tutorial_done', '1'); } catch { }
      onFinish();
    } else {
      setStep(step + 1);
    }
  }

  function skip() {
    try { localStorage.setItem('mg_tutorial_done', '1'); } catch { }
    onFinish();
  }

  // Calcular posición de la tarjeta del tooltip
  function getTooltipStyle() {
    if (isCenter || !targetRect) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }
    const padding = 16;
    if (current.placement === 'bottom') {
      return {
        top: `${targetRect.top + targetRect.height + padding}px`,
        left: '50%',
        transform: 'translateX(-50%)',
      };
    }
    // top placement
    return {
      bottom: `${window.innerHeight - targetRect.top + padding}px`,
      left: '50%',
      transform: 'translateX(-50%)',
    };
  }

  return (
    <div className="fixed inset-0 z-[60]" style={{ pointerEvents: 'auto' }}>
      {/* Overlay oscuro con "agujero" sobre el target */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ width: '100vw', height: '100vh' }}
      >
        <defs>
          <mask id="tutorial-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && !isCenter && (
              <rect
                x={targetRect.left - 6}
                y={targetRect.top - 6}
                width={targetRect.width + 12}
                height={targetRect.height + 12}
                rx="16"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.65)" mask="url(#tutorial-mask)" />
      </svg>

      {/* Anillo brillante alrededor del target */}
      {targetRect && !isCenter && (
        <div
          className="absolute pointer-events-none rounded-2xl"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
            boxShadow: '0 0 0 3px rgba(0, 122, 255, 0.6), 0 0 30px rgba(0, 122, 255, 0.4)',
            animation: 'tutorialPulse 2s ease-in-out infinite',
          }}
        />
      )}

      <style>{`
        @keyframes tutorialPulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.6), 0 0 30px rgba(0, 122, 255, 0.4); }
          50% { box-shadow: 0 0 0 5px rgba(0, 122, 255, 0.8), 0 0 40px rgba(0, 122, 255, 0.6); }
        }
      `}</style>

      {/* Tarjeta del tooltip */}
      <div
        className="absolute bg-white rounded-3xl shadow-2xl p-6 w-[calc(100%-2rem)] max-w-sm mg-fade-in"
        style={getTooltipStyle()}
      >
        {/* Pasos arriba */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-[var(--mg-accent)] uppercase tracking-wider">
            Paso {step + 1} de {STEPS.length}
          </span>
          <button
            onClick={skip}
            className="text-gray-400 hover:text-gray-600 text-sm font-medium"
          >
            Saltar tutorial
          </button>
        </div>

        <h3 className="text-xl font-bold text-gray-900 mb-2">{current.title}</h3>
        <p className="text-gray-600 text-base leading-relaxed">{current.description}</p>

        {/* Progreso visual */}
        <div className="flex gap-1.5 my-5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= step ? 'bg-[var(--mg-accent)]' : 'bg-gray-200'
                }`}
            />
          ))}
        </div>

        <button
          onClick={next}
          className="mg-btn-primary w-full"
        >
          {isLast ? '¡Empezar a usar la app!' : 'Continuar'}
        </button>
      </div>
    </div>
  );
}
