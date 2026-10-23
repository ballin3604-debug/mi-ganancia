import { useState } from 'react';
import { AppIcon } from './icons';

const SLIDES = [
  {
    icon: 'carrito',
    tone: 'accent',
    title: 'Vende en segundos',
    description: 'Toca el producto, cóbralo en efectivo o QR. La app te calcula el cambio sola.',
    example: 'Vendes Bs 75, te pagan con Bs 100 → te dice: devuelve Bs 25.',
  },
  {
    icon: 'paquete',
    tone: 'gold',
    title: 'Adiós cuaderno de stock',
    description: 'La app descuenta sola cada venta y te avisa qué se está acabando.',
    example: 'Vendiste 3 leches: el stock bajó solo y te avisa cuando repongas.',
  },
  {
    icon: 'reportes',
    tone: 'success',
    title: 'Sabrás cuánto ganas de verdad',
    description: 'No solo cuánto vendiste. Resta lo que te costó y tus gastos: esa es tu ganancia neta.',
    example: 'Vendiste Bs 1.000, tu ganancia real fue Bs 220. Ahí entiendes tu negocio.',
  },
  {
    icon: 'sinConexion',
    tone: 'brand',
    title: 'Funciona sin internet',
    description: 'Vende en el mercado o con corte de luz. Todo se guarda y se sube solo cuando vuelve la señal.',
    example: 'Vendes sin señal y al volver al WiFi todo aparece en tus reportes.',
  },
];

const TONES = {
  accent: {
    background: 'var(--mg-accent-bg)',
    border: 'var(--mg-accent-border)',
    color: 'var(--mg-accent)',
  },
  gold: {
    background: 'var(--mg-gold-bg)',
    border: 'var(--mg-gold-border)',
    color: 'var(--mg-gold-text)',
  },
  success: {
    background: 'var(--mg-success-bg)',
    border: 'var(--mg-success-border)',
    color: 'var(--mg-success)',
  },
  brand: {
    background: 'var(--mg-brand-bg)',
    border: 'var(--mg-brand-border)',
    color: 'var(--mg-brand)',
  },
};

export default function Onboarding({ onFinish }) {
  const [current, setCurrent] = useState(0);
  const isLast = current === SLIDES.length - 1;
  const slide = SLIDES[current];
  const tone = TONES[slide.tone];

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

  return (
    <div className="fixed inset-0 z-50 flex min-h-[100dvh] flex-col overflow-y-auto bg-[var(--mg-bg-base)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72"
        style={{ background: 'radial-gradient(520px 260px at 50% -80px, var(--mg-accent-bg), transparent 72%)' }}
      />

      <header className="relative flex items-center justify-between px-5 pt-6 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--mg-brand)] text-sm font-black text-white">
            M
          </span>
          <span className="text-sm font-black tracking-tight text-[var(--mg-text-primary)]">Mi Ganancia</span>
        </div>
        {!isLast && (
          <button
            type="button"
            onClick={skip}
            className="min-h-[44px] rounded-xl px-3 text-sm font-bold text-[var(--mg-text-secondary)] transition-colors hover:bg-[var(--mg-bg-elevated)] hover:text-[var(--mg-text-primary)]"
          >
            Saltar
          </button>
        )}
      </header>

      <main className="relative flex flex-1 items-center justify-center px-6 py-8">
        <div className="mg-fade-in w-full max-w-md text-center" key={current}>
          <div
            className="mx-auto mb-7 flex h-28 w-28 items-center justify-center rounded-[32px] border"
            style={{ background: tone.background, borderColor: tone.border }}
          >
            <AppIcon name={slide.icon} size={52} color={tone.color} strokeWidth={1.8} />
          </div>

          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--mg-text-muted)]">
            Paso {current + 1} de {SLIDES.length}
          </p>

          <h1 className="mt-3 text-[28px] font-extrabold leading-tight tracking-tight text-[var(--mg-text-primary)] sm:text-[34px]">
            {slide.title}
          </h1>

          <p className="mx-auto mt-3 max-w-sm text-[15px] font-medium leading-relaxed text-[var(--mg-text-secondary)] sm:text-base">
            {slide.description}
          </p>

          <div className="mt-6 rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-4 text-left shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--mg-text-muted)]">Ejemplo</p>
            <p className="mt-1.5 text-[13px] font-semibold leading-relaxed text-[var(--mg-text-primary)]">
              {slide.example}
            </p>
          </div>
        </div>
      </main>

      <footer className="relative px-6 pb-8 pt-4 sm:pb-10">
        <div className="mx-auto w-full max-w-md">
          <div
            className="mb-4 flex items-center justify-center gap-1.5"
            role="group"
            aria-label={`Progreso: paso ${current + 1} de ${SLIDES.length}`}
          >
            {SLIDES.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === current ? 'w-8 bg-[var(--mg-brand)]' : 'w-1.5 bg-[var(--mg-border-hover)]'
                }`}
              />
            ))}
          </div>
          <button type="button" onClick={next} className="mg-btn-primary min-h-[48px] w-full text-base">
            {isLast ? 'Empezar' : 'Continuar'}
          </button>
        </div>
      </footer>
    </div>
  );
}
