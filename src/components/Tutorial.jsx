import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { AppIcon } from './icons';
import { useSwipeCarousel } from '../hooks/useSwipeCarousel';

const STEPS = [
  {
    icon: 'tienda',
    color: 'var(--mg-brand)',
    background: 'var(--mg-brand-bg)',
    title: 'Consulta el resumen del día',
    description: 'En Inicio consulta el total vendido hoy.',
  },
  {
    icon: 'carrito',
    color: 'var(--mg-accent)',
    background: 'var(--mg-accent-bg)',
    title: 'Registra una venta',
    description: 'Cobra en efectivo o QR; el cambio se calcula automáticamente.',
  },
  {
    icon: 'paquete',
    color: 'var(--mg-gold-text)',
    background: 'var(--mg-gold-bg)',
    title: 'Actualiza tu inventario',
    description: 'Registra lo que recibes y el stock se actualiza solo.',
  },
  {
    icon: 'gastos',
    color: 'var(--mg-danger)',
    background: 'var(--mg-danger-bg)',
    title: 'Registra tus gastos',
    description: 'Anota cada gasto para saber cuánto dinero te queda.',
  },
  {
    icon: 'reportes',
    color: 'var(--mg-success)',
    background: 'var(--mg-success-bg)',
    title: 'Conoce tu ganancia real',
    description: 'Resta costos y gastos de tus ventas para ver tu ganancia.',
  },
  {
    icon: 'sinConexion',
    color: 'var(--mg-brand)',
    background: 'var(--mg-brand-bg)',
    title: 'Trabaja sin internet',
    description: 'Sigue vendiendo sin señal; tus datos se sincronizan al volver.',
  },
  {
    icon: 'ayuda',
    color: 'var(--mg-accent)',
    background: 'var(--mg-accent-bg)',
    title: 'Encuentra ayuda cuando la necesites',
    description: 'Toca ? en cualquier pantalla para ver explicaciones y ejemplos.',
  },
];

const MISION_STEPS = [
  {
    eyebrow: 'Misión 1 de 3',
    icon: 'nuevoProducto',
    color: 'var(--mg-accent)',
    background: 'var(--mg-accent-bg)',
    title: 'Añade tu primer producto',
    description: 'Sin productos no hay ventas y no hay negocio. Al añadirlo solo te pedimos lo esencial: nombre, precio y stock. Todo lo demás queda guardado en "Más detalles".',
  },
  {
    eyebrow: 'Misión 2 de 3',
    icon: 'paquete',
    color: 'var(--mg-gold-text)',
    background: 'var(--mg-gold-bg)',
    title: '¿Cómo entra tu stock? Tú eliges',
    description: '',
    showPaths: true,
  },
  {
    eyebrow: 'Misión final',
    icon: 'check',
    color: 'var(--mg-success)',
    background: 'var(--mg-success-bg)',
    title: '¡Tu turno!',
    description: 'La app te lleva directo al formulario rápido. Crea tu primer producto y la misión queda cumplida.',
  },
];

function StockPaths() {
  return (
    <div className="mt-5 w-full space-y-2 text-left">
      <div className="flex items-start gap-3 rounded-2xl border-2 border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg)] p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--mg-accent)]">
          <AppIcon name="paquete" size={16} color="#fff" />
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-extrabold text-[var(--mg-text-primary)]">Ya lo tengo</span>
          <span className="block text-[11px] font-semibold leading-snug text-[var(--mg-text-secondary)]">
            Cuento directo las unidades que hay: "tengo 20 unds ahora".
          </span>
        </span>
      </div>
      <div className="flex items-start gap-3 rounded-2xl border-2 border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--mg-gold)]">
          <AppIcon name="carrito" size={16} color="#fff" />
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-extrabold text-[var(--mg-text-primary)]">Lo acabo de comprar</span>
          <span className="block text-[11px] font-semibold leading-snug text-[var(--mg-text-secondary)]">
            Registro la compra: el stock sube solo y ya sé lo que me costó.
          </span>
        </span>
      </div>
      <p className="pt-1 text-center text-[11px] font-semibold text-[var(--mg-text-muted)]">
        Para resurtir, hazlo siempre en Compras: ahí se controla el stock de verdad.
      </p>
    </div>
  );
}

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

export default function Tutorial({ onFinish, onStartMission, mission = false }) {
  if (mission) return <MissionTutorial onFinish={onFinish} onStartMission={onStartMission} />;
  return <TutorialCarousel onFinish={onFinish} />;
}

function MissionTutorial({ onFinish, onStartMission }) {
  const [step, setStep] = useState(0);
  const trapTabRef = useRef(null);
  const stepData = MISION_STEPS[step];
  const isLast = step === MISION_STEPS.length - 1;

  function handleMain() {
    if (isLast) onStartMission?.();
    else setStep(step + 1);
  }

  useEffect(() => {
    trapTabRef.current?.focus();
  }, []);

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onFinish?.();
    } else if (event.key === 'ArrowRight' && !isLast) {
      event.preventDefault();
      setStep(step + 1);
    } else if (event.key === 'ArrowLeft' && step > 0) {
      event.preventDefault();
      setStep(step - 1);
    }
    trapTab(event, trapTabRef.current);
  }

  return (
    <div
      ref={trapTabRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`mision-step-title-${step}`}
      aria-describedby={`mision-step-description-${step}`}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/45 px-4 outline-none"
      style={{ paddingTop: 'max(12px, env(safe-area-inset-top))', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
    >
      <div className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-y-auto rounded-[28px] bg-[var(--mg-bg-surface)] p-5 shadow-[var(--mg-shadow-lg)] sm:p-7">
        <header className="flex shrink-0 items-center justify-between">
          <span
            aria-live="polite"
            aria-atomic="true"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]"
            style={{ background: stepData.background, color: stepData.color }}
          >
            <AppIcon name="ranking" size={12} color="currentColor" />
            {stepData.eyebrow}
          </span>
          <button
            type="button"
            onClick={onFinish}
            className="min-h-11 rounded-xl px-3 text-sm font-medium text-[var(--mg-text-secondary)] hover:text-[var(--mg-text-primary)]"
          >
            Omitir
          </button>
        </header>

        <main className="flex min-h-[280px] flex-1 items-center justify-center py-5">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full text-center"
          >
            <div
              className="mx-auto mb-5 flex h-[76px] w-[76px] items-center justify-center rounded-[24px]"
              style={{ background: stepData.background }}
              aria-hidden="true"
            >
              <AppIcon name={stepData.icon} size={36} color={stepData.color} strokeWidth={1.8} />
            </div>
            <h2 id={`mision-step-title-${step}`} className="text-[23px] font-extrabold leading-tight tracking-tight text-[var(--mg-text-primary)] sm:text-[26px]">
              {stepData.title}
            </h2>
            {stepData.description && (
              <p id={`mision-step-description-${step}`} className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-[var(--mg-text-secondary)]">
                {stepData.description}
              </p>
            )}
            {stepData.showPaths && <StockPaths />}
          </motion.div>
        </main>

        <footer className="shrink-0">
          <div
            className="mb-4 flex items-center justify-center gap-1.5"
            role="group"
            aria-label={`Progreso: paso ${step + 1} de ${MISION_STEPS.length}`}
          >
            {MISION_STEPS.map((_, index) => (
              <span
                key={index}
                aria-hidden="true"
                className={`h-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none ${
                  index === step ? 'w-7 bg-[var(--mg-gold)]' : 'w-1.5 bg-[var(--mg-border-hover)]'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                aria-label="Pantalla anterior"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[var(--mg-text-secondary)] hover:bg-[var(--mg-bg-elevated)] hover:text-[var(--mg-text-primary)]"
              >
                <AppIcon name="volver" size={20} color="currentColor" />
              </button>
            ) : null}
            <button type="button" onClick={handleMain} className="mg-btn-primary min-h-12 flex-1 text-base">
              {isLast ? '🎯 Empezar misión' : 'Siguiente'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function TutorialCarousel({ onFinish }) {
  const [step, setStep] = useState(0);
  const rootRef = useRef(null);
  const wheelLocked = useRef(false);
  const wheelTimer = useRef(null);
  const wheelHandlerRef = useRef(null);
  const isLast = step === STEPS.length - 1;
  const { viewportRef, goTo, trackProps } = useSwipeCarousel({
    index: step,
    count: STEPS.length,
    onChange: setStep,
  });

  useEffect(() => {
    rootRef.current?.focus();
    return () => window.clearTimeout(wheelTimer.current);
  }, []);

  function finish() {
    try { localStorage.setItem('mg_tutorial_done', '1'); } catch {}
    onFinish?.();
  }

  function next() {
    if (isLast) finish();
    else goTo(step + 1);
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      finish();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (!isLast) goTo(step + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (step > 0) goTo(step - 1);
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
    if (event.deltaX > 0 && !isLast) goTo(step + 1);
    if (event.deltaX < 0 && step > 0) goTo(step - 1);
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
      aria-labelledby={`tutorial-step-title-${step}`}
      aria-describedby={`tutorial-step-description-${step}`}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/45 px-4 outline-none"
      style={{ paddingTop: 'max(12px, env(safe-area-inset-top))', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
    >
      <div className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-y-auto rounded-[28px] bg-[var(--mg-bg-surface)] p-5 shadow-[var(--mg-shadow-lg)] sm:p-7">
        <header className="flex shrink-0 items-center justify-between">
          <span aria-live="polite" aria-atomic="true" className="text-xs font-bold uppercase tracking-wider text-[var(--mg-text-muted)]">
            Paso {step + 1} de {STEPS.length}
          </span>
          {!isLast && (
            <button
              type="button"
              onClick={finish}
              className="min-h-11 rounded-xl px-3 text-sm font-medium text-[var(--mg-text-secondary)] hover:text-[var(--mg-text-primary)]"
            >
              Omitir
            </button>
          )}
        </header>

        <main className="flex min-h-[260px] flex-1 items-center justify-center py-5">
          <div ref={viewportRef} className="w-full overflow-hidden">
            <motion.div
              {...trackProps}
              className="flex cursor-grab items-center active:cursor-grabbing"
              role="region"
              aria-roledescription="carrusel"
              aria-label="Tutorial"
            >
              {STEPS.map((item, index) => (
                <article
                  key={item.title}
                  className="w-full shrink-0 text-center"
                  aria-hidden={index !== step}
                  data-active={index === step ? 'true' : 'false'}
                  role="group"
                  aria-roledescription="pantalla"
                  aria-label={`Pantalla ${index + 1} de ${STEPS.length}`}
                >
                  <div
                    className="mx-auto mb-5 flex h-[76px] w-[76px] items-center justify-center rounded-[24px]"
                    style={{ background: item.background }}
                    aria-hidden="true"
                  >
                    <AppIcon name={item.icon} size={36} color={item.color} strokeWidth={1.8} />
                  </div>

                  <h2 id={`tutorial-step-title-${index}`} className="text-[23px] font-extrabold leading-tight tracking-tight text-[var(--mg-text-primary)] sm:text-[26px]">
                    {item.title}
                  </h2>
                  <p id={`tutorial-step-description-${index}`} className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-[var(--mg-text-secondary)]">
                    {item.description}
                  </p>
                </article>
              ))}
            </motion.div>
          </div>
        </main>

        <footer className="shrink-0">
          <div
            className="mb-4 flex items-center justify-center gap-1.5"
            role="group"
            aria-label={`Progreso: paso ${step + 1} de ${STEPS.length}`}
          >
            {STEPS.map((_, index) => (
              <span
                key={index}
                aria-hidden="true"
                className={`h-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none ${
                  index === step ? 'w-7 bg-[var(--mg-accent)]' : 'w-1.5 bg-[var(--mg-border-hover)]'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => goTo(step - 1)}
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
        </footer>
      </div>
    </div>
  );
}
