import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AppIcon } from './icons';

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

const slideVariants = {
  enter: (direction) => ({ x: direction > 0 ? 36 : -36, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({ x: direction > 0 ? -36 : 36, opacity: 0 }),
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
  const [direction, setDirection] = useState(1);
  const rootRef = useRef(null);
  const wheelLocked = useRef(false);
  const wheelTimer = useRef(null);
  const reduceMotion = useReducedMotion();
  const isLast = current === SLIDES.length - 1;
  const slide = SLIDES[current];
  const tone = TONES[slide.tone];

  useEffect(() => {
    rootRef.current?.focus();
    return () => window.clearTimeout(wheelTimer.current);
  }, []);

  function moveTo(nextIndex) {
    if (nextIndex < 0 || nextIndex >= SLIDES.length || nextIndex === current) return;
    setDirection(nextIndex > current ? 1 : -1);
    setCurrent(nextIndex);
  }

  function finish() {
    try { localStorage.setItem('mg_onboarding_done', '1'); } catch {}
    onFinish?.();
  }

  function next() {
    if (isLast) finish();
    else moveTo(current + 1);
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
      if (!isLast) moveTo(current + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (current > 0) moveTo(current - 1);
    }
    trapTab(event, rootRef.current);
  }

  function handleDragEnd(_, info) {
    const distance = info.offset.x;
    const isHorizontal = Math.abs(distance) > Math.abs(info.offset.y) * 1.15;
    if (!isHorizontal || (Math.abs(distance) < 48 && Math.abs(info.velocity.x) < 500)) return;
    if (distance < 0 && !isLast) moveTo(current + 1);
    if (distance > 0 && current > 0) moveTo(current - 1);
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
    if (event.deltaX > 0 && !isLast) moveTo(current + 1);
    if (event.deltaX < 0 && current > 0) moveTo(current - 1);
  }

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`welcome-slide-title-${current}`}
      aria-describedby={`welcome-slide-description-${current}`}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      onWheel={handleWheel}
      className="fixed inset-0 z-50 flex min-h-[100dvh] flex-col overflow-y-auto bg-[var(--mg-bg-base)] outline-none"
      style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
    >
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        Paso {current + 1} de {SLIDES.length}
      </span>
      <header className="relative flex shrink-0 items-center justify-between px-5 sm:px-8">
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
            className="min-h-11 rounded-xl px-3 text-sm font-medium text-[var(--mg-text-secondary)] hover:text-[var(--mg-text-primary)]"
          >
            Omitir
          </button>
        )}
      </header>

      <main className="flex min-h-[280px] flex-1 items-center justify-center px-6 py-7">
        <div className="grid w-full max-w-md">
          <AnimatePresence initial={false} custom={direction}>
            <motion.article
              key={current}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: reduceMotion ? 0.01 : 0.26, ease: [0.22, 1, 0.36, 1] }}
              drag="x"
              dragDirectionLock
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              dragMomentum={false}
              onDragEnd={handleDragEnd}
              className="col-start-1 row-start-1 w-full cursor-grab text-center active:cursor-grabbing"
              style={{ touchAction: 'pan-y' }}
              role="group"
              aria-roledescription="pantalla"
              aria-label={`Pantalla ${current + 1} de ${SLIDES.length}`}
            >
              <div
                className="mx-auto mb-6 flex h-[88px] w-[88px] items-center justify-center rounded-[26px] border"
                style={{ background: tone.background, borderColor: tone.border }}
                aria-hidden="true"
              >
                <AppIcon name={slide.icon} size={40} color={tone.color} strokeWidth={1.8} />
              </div>

              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--mg-text-muted)]">
                Paso {current + 1} de {SLIDES.length}
              </p>

              <h1 id={`welcome-slide-title-${current}`} className="mt-3 text-[27px] font-extrabold leading-tight tracking-tight text-[var(--mg-text-primary)] sm:text-[34px]">
                {slide.title}
              </h1>

              <p id={`welcome-slide-description-${current}`} className="mx-auto mt-3 max-w-sm text-[15px] font-medium leading-relaxed text-[var(--mg-text-secondary)] sm:text-base">
                {slide.description}
              </p>
            </motion.article>
          </AnimatePresence>
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
                className={`h-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none ${
                  index === current ? 'w-7 bg-[var(--mg-brand)]' : 'w-1.5 bg-[var(--mg-border-hover)]'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {current > 0 ? (
              <button
                type="button"
                onClick={() => moveTo(current - 1)}
                aria-label="Pantalla anterior"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[var(--mg-text-secondary)] hover:bg-[var(--mg-bg-elevated)] hover:text-[var(--mg-text-primary)]"
              >
                <AppIcon name="volver" size={20} color="currentColor" />
              </button>
            ) : null}
            <button type="button" onClick={next} className="mg-btn-primary min-h-12 flex-1 text-base">
              {isLast ? 'Comenzar' : 'Siguiente'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
