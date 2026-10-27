import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import BrandMark from './BrandMark';
import { AppIcon } from './icons';
import { useSwipeCarousel } from '../hooks/useSwipeCarousel';

export const ONBOARDING_COMPLETION_KEY = 'mg_onboarding_done_v2';

const SLIDES = [
  {
    icon: 'carrito',
    tone: 'accent',
    title: 'Vende en segundos',
    description: 'Cobra en efectivo o QR y calcula el cambio al registrar la venta.',
  },
  {
    icon: 'paquete',
    tone: 'gold',
    title: 'Controla tu inventario',
    description: 'Cada venta actualiza el stock y te avisa cuando toca reponer.',
  },
  {
    icon: 'reportes',
    tone: 'success',
    title: 'Conoce tu ganancia real',
    description: 'Compara ventas, costos y gastos para saber cuánto ganaste.',
  },
  {
    icon: 'sinConexion',
    tone: 'brand',
    title: 'Sigue trabajando sin señal',
    description: 'Guarda tus datos sin señal y sincroniza al volver la conexión.',
  },
];

const TONES = {
  accent: {
    background: 'rgba(15, 150, 117, 0.10)',
    border: 'rgba(15, 150, 117, 0.28)',
    color: '#0C4A38',
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

function trapTab(event, container) {
  if (event.key !== 'Tab' || !container) return;

  const buttons = [...container.querySelectorAll('button:not(:disabled)')];
  if (!buttons.length) return;

  const first = buttons[0];
  const last = buttons[buttons.length - 1];
  if (event.shiftKey && (document.activeElement === first || document.activeElement === container)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === container)) {
    event.preventDefault();
    first.focus();
  }
}

export default function Onboarding({ onFinish }) {
  const [current, setCurrent] = useState(0);
  const rootRef = useRef(null);
  const wheelLocked = useRef(false);
  const wheelTimer = useRef(null);
  const wheelHandlerRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const isLast = current === SLIDES.length - 1;
  const { viewportRef, goTo, trackProps } = useSwipeCarousel({
    index: current,
    count: SLIDES.length,
    onChange: setCurrent,
  });

  useEffect(() => {
    rootRef.current?.focus();
    return () => window.clearTimeout(wheelTimer.current);
  }, []);

  function finish() {
    try { localStorage.setItem(ONBOARDING_COMPLETION_KEY, '1'); } catch {}
    onFinish?.();
  }

  function next() {
    if (isLast) finish();
    else goTo(current + 1);
  }

  function skip() {
    finish();
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      skip();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (!isLast) goTo(current + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (current > 0) goTo(current - 1);
    }
    trapTab(event, rootRef.current);
  }

  function handleWheel(event) {
    if (Math.abs(event.deltaX) < 24 || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    event.preventDefault();
    if (wheelLocked.current) return;

    wheelLocked.current = true;
    window.clearTimeout(wheelTimer.current);
    wheelTimer.current = window.setTimeout(() => {
      wheelLocked.current = false;
    }, 500);
    if (event.deltaX > 0 && !isLast) goTo(current + 1);
    if (event.deltaX < 0 && current > 0) goTo(current - 1);
  }

  wheelHandlerRef.current = handleWheel;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const listener = (event) => wheelHandlerRef.current?.(event);
    root.addEventListener('wheel', listener, { passive: false });
    return () => root.removeEventListener('wheel', listener);
  }, []);

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`welcome-slide-title-${current}`}
      aria-describedby={`welcome-slide-description-${current}`}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex min-h-[100dvh] flex-col overflow-y-auto bg-[var(--mg-bg-base)] outline-none"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
        backgroundImage: 'radial-gradient(ellipse at 100% 0%, rgba(15, 150, 117, 0.12), transparent 42%), radial-gradient(ellipse at 0% 100%, rgba(11, 58, 43, 0.07), transparent 38%)',
      }}
    >
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        Paso {current + 1} de {SLIDES.length}
      </span>
      <header className="relative flex shrink-0 items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-2.5" aria-label="Mi Ganancia">
          <BrandMark className="h-7 w-12 shrink-0" />
          <span className="text-sm font-black tracking-tight text-[#0B3A2B]">Mi Ganancia</span>
        </div>
        {!isLast && (
          <button
            type="button"
            onClick={skip}
            className="min-h-11 rounded-xl px-3 text-sm font-medium text-[var(--mg-text-secondary)] hover:text-[var(--mg-text-primary)]"
          >
            Omitir
          </button>
        )}
      </header>

      <main className="flex min-h-[280px] flex-1 items-center justify-center px-6 py-7">
        <div ref={viewportRef} className="w-full max-w-md overflow-hidden">
          <motion.div
            {...trackProps}
            className="flex cursor-grab items-center active:cursor-grabbing"
            role="region"
            aria-roledescription="carrusel"
            aria-label="Bienvenida"
          >
            {SLIDES.map((item, index) => {
              const slideTone = TONES[item.tone];
              const active = index === current;
              return (
                <article
                  key={item.title}
                  className="w-full shrink-0 text-center"
                  aria-hidden={!active}
                  data-active={active ? 'true' : 'false'}
                  role="group"
                  aria-roledescription="pantalla"
                  aria-label={`Pantalla ${index + 1} de ${SLIDES.length}`}
                >
                  <motion.div
                    key={`${item.title}-${active}`}
                    initial={active && !reduceMotion ? { opacity: 0, scale: 0.82, y: 12, rotate: -4 } : false}
                    animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
                    transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 22, delay: 0.04 }}
                    className="relative mx-auto mb-6 flex h-[100px] w-[100px] items-center justify-center rounded-[30px] border bg-white shadow-[0_18px_38px_rgba(11,58,43,0.12)]"
                    style={{ background: `linear-gradient(145deg, #FFFFFF 8%, ${slideTone.background} 100%)`, borderColor: slideTone.border }}
                    aria-hidden="true"
                  >
                    <span className="absolute inset-[6px] rounded-[24px] border border-white/70" />
                    <AppIcon name={item.icon} size={42} color={slideTone.color} strokeWidth={1.8} />
                    <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-[3px] border-white bg-[#0F9675] shadow-sm" />
                  </motion.div>

                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#0C4A38]">
                    Tu negocio, simple <span className="px-1 text-[#0F9675]">·</span> {String(index + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
                  </p>

                  <h1 id={`welcome-slide-title-${index}`} className="mt-3 text-[27px] font-extrabold leading-tight tracking-tight text-[var(--mg-text-primary)] sm:text-[34px]">
                    {item.title}
                  </h1>

                  <p id={`welcome-slide-description-${index}`} className="mx-auto mt-3 max-w-sm text-[15px] font-medium leading-relaxed text-[var(--mg-text-secondary)] sm:text-base">
                    {item.description}
                  </p>
                  <p className="mt-5 text-xs font-semibold tracking-wide text-[#0C4A38]/70">
                    {index < SLIDES.length - 1 ? 'Deslizá para descubrir' : 'Todo lo esencial para hacer crecer tu negocio'}
                  </p>
                </article>
              );
            })}
          </motion.div>
        </div>
      </main>

      <footer className="relative shrink-0 px-6 pt-4 sm:px-8">
        <div className="mx-auto w-full max-w-md">
          <div
            className="mb-4 flex items-center justify-center gap-1.5"
            role="group"
            aria-label={`Progreso: paso ${current + 1} de ${SLIDES.length}`}
          >
            {SLIDES.map((_, index) => (
              <span
                key={index}
                aria-hidden="true"
                className={`h-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none ${index === current ? 'w-8' : 'w-1.5 bg-[var(--mg-border-hover)]'}`}
                style={index === current ? { background: 'linear-gradient(90deg, #0B3A2B, #0F9675)' } : undefined}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {current > 0 ? (
              <button
                type="button"
                onClick={() => goTo(current - 1)}
                aria-label="Pantalla anterior"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[var(--mg-text-secondary)] hover:bg-[var(--mg-bg-elevated)] hover:text-[var(--mg-text-primary)]"
              >
                <AppIcon name="volver" size={20} color="currentColor" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={next}
              className="min-h-12 flex-1 rounded-xl px-4 py-3.5 text-base font-bold text-white transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F9675] focus-visible:ring-offset-2"
              style={{ background: 'linear-gradient(120deg, #0B3A2B, #0F9675)', boxShadow: '0 10px 22px rgba(11, 58, 43, 0.20)' }}
            >
              {isLast ? 'Comenzar' : 'Siguiente'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
