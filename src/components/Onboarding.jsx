import { useState } from 'react';

const SLIDES = [
  {
    icon: (
      <svg className="w-20 h-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    title: 'Vende en segundos',
    description: 'Toca un producto, agrégalo al carrito y cobra. Tan simple como contar billetes.',
    color: '#007aff',
  },
  {
    icon: (
      <svg className="w-20 h-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    title: 'Controla tu inventario',
    description: 'Sabe cuánto te queda de cada producto. Te avisa cuando algo está por acabarse.',
    color: '#34c759',
  },
  {
    icon: (
      <svg className="w-20 h-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Mira cuánto ganas',
    description: 'Reportes diarios, semanales y mensuales. Ve crecer tu negocio día a día.',
    color: '#ff9500',
  },
];

export default function Onboarding({ onFinish }) {
  const [current, setCurrent] = useState(0);
  const isLast = current === SLIDES.length - 1;

  function next() {
    if (isLast) {
      // Marcar onboarding como visto
      try { localStorage.setItem('mg_onboarding_done', '1'); } catch {}
      onFinish();
    } else {
      setCurrent(current + 1);
    }
  }

  function skip() {
    try { localStorage.setItem('mg_onboarding_done', '1'); } catch {}
    onFinish();
  }

  const slide = SLIDES[current];

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header con botón saltar */}
      <div className="flex justify-end p-5 pt-12">
        {!isLast && (
          <button
            onClick={skip}
            className="text-[var(--mg-accent)] text-base font-semibold active:opacity-60"
          >
            Saltar
          </button>
        )}
      </div>

      {/* Contenido del slide */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center mg-fade-in" key={current}>
        {/* Icono grande con fondo de color */}
        <div
          className="w-40 h-40 rounded-[40px] flex items-center justify-center mb-10 shadow-2xl"
          style={{
            background: `linear-gradient(135deg, ${slide.color} 0%, ${slide.color}dd 100%)`,
            boxShadow: `0 20px 50px ${slide.color}40`,
            color: 'white',
          }}
        >
          {slide.icon}
        </div>

        {/* Título */}
        <h2 className="text-3xl font-bold text-gray-900 tracking-tight mb-4">
          {slide.title}
        </h2>

        {/* Descripción */}
        <p className="text-gray-500 text-lg leading-relaxed max-w-sm">
          {slide.description}
        </p>
      </div>

      {/* Indicadores de página (puntitos) */}
      <div className="flex justify-center gap-2 mb-8">
        {SLIDES.map((_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === current ? 'w-8 bg-[var(--mg-accent)]' : 'w-2 bg-gray-300'
            }`}
          />
        ))}
      </div>

      {/* Botón continuar */}
      <div className="px-6 pb-12 pt-2">
        <button
          onClick={next}
          className="mg-btn-primary w-full text-base"
        >
          {isLast ? 'Empezar' : 'Continuar'}
        </button>
      </div>
    </div>
  );
}
