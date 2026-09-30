import { useState } from 'react';

// Onboarding: primera vez que alguien abre la app (antes de crear cuenta).
// Lenguaje de tienda, cero tecnicismos. Si cambias un texto aquí,
// mantén 1 título corto + 1 frase + 1 ejemplo.
const SLIDES = [
  {
    emoji: '🛒',
    title: 'Vende en segundos',
    description: 'Toca el producto, cóbralo en efectivo, QR o fiado. La app te calcula el cambio sola.',
    example: 'Vendes Bs 75, te pagan con Bs 100 → te dice: devuelve Bs 25.',
    color: '#1670C2',
  },
  {
    emoji: '📖',
    title: 'Adiós cuaderno de fiados',
    description: 'La app anota quién te debe, cuánto y desde cuándo. Los vencidos salen en rojo.',
    example: 'Don Juan te debe Bs 120 desde el lunes. Lo cobras en 1 clic.',
    color: '#d99a2b',
  },
  {
    emoji: '📈',
    title: 'Sabrás cuánto ganas de verdad',
    description: 'No solo cuánto vendiste. Resta lo que te costó y tus gastos: esa es tu ganancia neta.',
    example: 'Vendiste Bs 1.000, tu ganancia real fue Bs 220. Ahí entiendes tu negocio.',
    color: '#34c759',
  },
  {
    emoji: '📶',
    title: 'Funciona sin internet',
    description: 'Vende en el mercado o con corte de luz. Todo se guarda y se sube solo cuando vuelve la señal.',
    example: 'Vendes sin señal y al volver al WiFi todo aparece en tus reportes.',
    color: '#0c3457',
  },
];

export default function Onboarding({ onFinish }) {
  const [current, setCurrent] = useState(0);
  const isLast = current === SLIDES.length - 1;

  function next() {
    if (isLast) {
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

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center mg-fade-in" key={current}>
        <div
          className="w-36 h-36 rounded-[36px] flex items-center justify-center mb-8 text-7xl"
          style={{
            background: `linear-gradient(135deg, ${slide.color} 0%, ${slide.color}dd 100%)`,
            boxShadow: `0 20px 50px ${slide.color}40`,
          }}
        >
          {slide.emoji}
        </div>

        <h2 className="text-[26px] font-extrabold text-gray-900 tracking-tight mb-3">
          {slide.title}
        </h2>

        <p className="text-gray-600 text-[16px] leading-relaxed max-w-sm">
          {slide.description}
        </p>

        <p className="text-gray-400 text-[13px] leading-relaxed max-w-sm mt-3 italic bg-gray-50 rounded-2xl px-4 py-2.5">
          Ej: {slide.example}
        </p>
      </div>

      <div className="flex justify-center items-center gap-2 mb-4">
        {SLIDES.map((_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === current ? 'w-8 bg-[var(--mg-accent)]' : 'w-2 bg-gray-300'
            }`}
          />
        ))}
      </div>
      <p className="text-center text-xs text-gray-400 font-semibold mb-4">
        {current + 1} de {SLIDES.length}
      </p>

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
