import { useEffect, useRef, useState } from 'react';
import BrandMark from './BrandMark';

const MIN_VISIBLE_MS = 1350;
const READY_HOLD_MS = 200;
const EXIT_MS = 360;
const MAX_WAIT_MS = 6500;

const STATUS_TEXTS = [
  'Cargando tus datos…',
  'Preparando tus reportes…',
  'Tu negocio al día…',
];

export default function SplashScreen({ ready = false, onDone = () => {} }) {
  const [finish, setFinish] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const fillRef = useRef(null);
  const startRef = useRef(0);
  const progressStoppedRef = useRef(false);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    startRef.current = performance.now();
    const maxTimer = window.setTimeout(() => setFinish(true), MAX_WAIT_MS);
    return () => window.clearTimeout(maxTimer);
  }, []);

  useEffect(() => {
    if (ready) setFinish(true);
  }, [ready]);

  useEffect(() => {
    const fill = fillRef.current;
    if (!fill) return;

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      fill.style.transform = 'scaleX(1)';
      return;
    }

    let raf;
    const started = performance.now();
    const step = (now) => {
      if (progressStoppedRef.current) return;
      const t = Math.min(1, (now - started) / 2800);
      const eased = 1 - Math.pow(1 - t, 3);
      fill.style.transform = `scaleX(${0.06 + 0.86 * eased})`;
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!finish) return;
    progressStoppedRef.current = true;

    const fill = fillRef.current;
    if (fill) {
      fill.style.transition = 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1)';
      fill.style.transform = 'scaleX(1)';
    }

    const elapsed = performance.now() - startRef.current;
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed) + READY_HOLD_MS;
    const exitTimer = window.setTimeout(() => setLeaving(true), wait);
    return () => window.clearTimeout(exitTimer);
  }, [finish]);

  useEffect(() => {
    if (!leaving) return;
    const doneTimer = window.setTimeout(() => onDoneRef.current?.(), EXIT_MS);
    return () => window.clearTimeout(doneTimer);
  }, [leaving]);

  return (
    <div
      className={`mg-splash${leaving ? ' is-leaving' : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Cargando Mi Ganancia</span>

      <div className="mg-splash__content" aria-hidden="true">
        <BrandMark className="mg-splash__mark" animated />
        <p className="mg-splash__wordmark">Mi Ganancia</p>

        <div className="mg-splash__status">
          {STATUS_TEXTS.map((text, index) => (
            <span
              key={text}
              className="mg-splash__status-line"
              style={{ animationDelay: `${index * 1.7}s` }}
            >
              {text}
            </span>
          ))}
        </div>

        <div className="mg-splash__progress">
          <div ref={fillRef} className="mg-splash__progress-fill" />
        </div>
      </div>
    </div>
  );
}
