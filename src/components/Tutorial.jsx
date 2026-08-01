import { useState } from 'react';

// Recorrido de bienvenida que se muestra una sola vez tras crear el negocio.
// Antes intentaba "resaltar" elementos del menú con data-tutorial, pero en
// celular esos elementos viven dentro del cajón de menú (cerrado durante el
// tutorial), así que no se encontraba nada y todos los pasos salían centrados
// sin resaltar. Ahora es un recorrido centrado, robusto en cualquier pantalla,
// con el mapa real de la app actual.

const STEPS = [
  {
    color: '#1670C2',
    title: 'Tu Inicio',
    description: 'Tu resumen del día: lo que vendiste, tu ganancia del mes y las alertas de stock, todo en una sola pantalla.',
    icon: (
      <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    color: '#d99a2b',
    title: 'Vender rápido',
    description: 'Cobrá en segundos: en efectivo, con QR o al fiado. Y lo mejor: funciona aunque te quedes sin internet.',
    icon: (
      <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    color: '#34c759',
    title: 'Reponer stock (Compras)',
    description: 'Cuando te llega mercadería, registrá la compra al proveedor. La app calcula sola tu costo real y cuánto vas a ganar por unidad.',
    icon: (
      <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    color: '#0c3457',
    title: 'Fiados (CxC)',
    description: 'Se acabó el cuaderno mojado. La app te dice quién te debe, cuánto y desde cuándo. Cobrás sin perder de vista a nadie.',
    icon: (
      <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    color: '#1670C2',
    title: 'Reportes de verdad',
    description: 'Ganancias diarias, costo de lo vendido y tus productos más vendidos. Dejás de adivinar y ves cómo va tu negocio.',
    icon: (
      <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    color: '#34c759',
    title: '¡Todo listo!',
    description: 'Tus datos se guardan solos y se sincronizan entre tus dispositivos. Si alguna vez necesitás ayuda, todo está en Ajustes.',
    icon: (
      <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
];

export default function Tutorial({ onFinish }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function finish() {
    try { localStorage.setItem('mg_tutorial_done', '1'); } catch { /* ignore */ }
    onFinish();
  }

  function next() {
    if (isLast) finish();
    else setStep(step + 1);
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 mg-backdrop-in">
      <div className="bg-[var(--mg-bg-surface)] rounded-3xl shadow-2xl w-full max-w-sm p-6 mg-modal-in">
        {/* Encabezado: paso + saltar */}
        <div className="flex items-center justify-between mb-5">
          <span className="text-xs font-bold text-[var(--mg-accent)] uppercase tracking-wider">
            Paso {step + 1} de {STEPS.length}
          </span>
          {!isLast && (
            <button
              onClick={finish}
              className="text-[var(--mg-text-muted)] hover:text-[var(--mg-text-secondary)] text-sm font-semibold"
            >
              Saltar
            </button>
          )}
        </div>

        {/* Contenido — se reanima en cada paso */}
        <div key={step} className="text-center mg-fade-in">
          <div
            className="w-24 h-24 rounded-[28px] flex items-center justify-center mx-auto mb-6 text-white"
            style={{
              background: `linear-gradient(135deg, ${current.color} 0%, ${current.color}cc 100%)`,
              boxShadow: `0 16px 36px ${current.color}55`,
            }}
          >
            {current.icon}
          </div>

          <h3 className="text-xl font-black text-[var(--mg-text-primary)] mb-2">{current.title}</h3>
          <p className="text-[var(--mg-text-secondary)] text-[15px] leading-relaxed">{current.description}</p>
        </div>

        {/* Progreso (puntos) */}
        <div className="flex justify-center gap-1.5 my-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-[var(--mg-accent)]' : i < step ? 'w-1.5 bg-[var(--mg-accent-border)]' : 'w-1.5 bg-gray-200'
              }`}
            />
          ))}
        </div>

        <button onClick={next} className="mg-btn-primary w-full">
          {isLast ? '¡Empezar a usar la app!' : 'Continuar'}
        </button>
      </div>
    </div>
  );
}
