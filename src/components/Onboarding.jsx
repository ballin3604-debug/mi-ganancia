import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useSwipeCarousel } from '../hooks/useSwipeCarousel';
import OnboardingSlide from './OnboardingSlide';
import OnboardingDots from './OnboardingDots';

export const ONBOARDING_COMPLETION_KEY = 'mg_onboarding_done_v3';

const SLIDES = [
  {
    image: '/onboarding/slide-1.png',
    title: '¡Bienvenido a Mi Ganancia!',
    description: 'Toma el control de tu negocio. Administra tus ventas, productos e inventario de forma fácil y rápida desde cualquier lugar.',
  },
  {
    image: '/onboarding/slide-2.png',
    title: '¡Vende rápido y sin enredos!',
    description: 'Registra tus ventas diarias al instante, escanea códigos de barras con la cámara de tu celular, y mantén tu inventario siempre actualizado en tiempo real.',
  },
  {
    image: '/onboarding/slide-3.png',
    title: '¡Haz crecer tu negocio!',
    description: 'Revisa tus ganancias, reportes diarios y estadísticas en tiempo real. Toma decisiones inteligentes con datos claros sobre tus ventas.',
  },
];

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

  useEffect(() => {
    const html = document.documentElement;
    const previousOverscrollBehavior = html.style.overscrollBehaviorY;
    html.style.overscrollBehaviorY = 'none';
    return () => {
      html.style.overscrollBehaviorY = previousOverscrollBehavior;
    };
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

  function selectSlide(index) {
    if (index !== current) goTo(index);
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
      aria-labelledby={`onboarding-title-${current}`}
      aria-describedby={`onboarding-description-${current}`}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex min-h-[100dvh] flex-col overflow-y-auto overscroll-y-none bg-white outline-none"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
        overscrollBehaviorY: 'none',
      }}
    >
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        Paso {current + 1} de {SLIDES.length}
      </span>
      <header className="relative flex shrink-0 items-center justify-center px-5 pb-2 pt-1 sm:px-8">
        <img
          src="/onboarding/logo.png"
          alt="Mi Ganancia"
          draggable={false}
          className="h-9 w-auto select-none object-contain sm:h-11"
        />
        <button
          type="button"
          onClick={skip}
          className="absolute right-4 min-h-11 rounded-xl px-3 text-sm font-semibold text-[#475569] transition-colors hover:text-[#1E293B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F9675] focus-visible:ring-offset-2 sm:right-8"
        >
          Saltar
        </button>
      </header>

      <main className="flex min-h-[280px] flex-1 items-stretch justify-center overflow-hidden px-3 py-1 sm:px-6 sm:py-3">
        <div ref={viewportRef} className="flex w-full max-w-md flex-1 overflow-hidden">
          <motion.div
            {...trackProps}
            className="flex h-full min-h-[280px] w-full cursor-grab items-stretch active:cursor-grabbing"
            role="region"
            aria-roledescription="carrusel"
            aria-label="Bienvenida"
          >
            {SLIDES.map((item, index) => {
              const active = index === current;
              return (
                <article
                  key={item.title}
                  className="flex h-full min-h-[280px] w-full shrink-0"
                  aria-hidden={!active}
                  data-active={active ? 'true' : 'false'}
                  role="group"
                  aria-roledescription="pantalla"
                  aria-label={`Pantalla ${index + 1} de ${SLIDES.length}`}
                >
                  <OnboardingSlide
                    key={`${item.title}-${active ? 'on' : 'off'}`}
                    slide={item}
                    active={active}
                    titleId={`onboarding-title-${index}`}
                    descriptionId={`onboarding-description-${index}`}
                  />
                </article>
              );
            })}
          </motion.div>
        </div>
      </main>

      <footer className="shrink-0 px-8 pb-2 sm:px-12">
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5">
          <OnboardingDots count={SLIDES.length} active={current} onChange={selectSlide} />
          <button
            type="button"
            onClick={next}
            className="h-14 w-full rounded-2xl bg-[#0F9675] px-4 text-base font-bold text-white shadow-[0_12px_28px_rgba(15,150,117,0.35)] transition-transform duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F9675] focus-visible:ring-offset-2"
          >
            {isLast ? 'Comenzar' : 'Siguiente'}
          </button>
        </div>
      </footer>
    </div>
  );
}
