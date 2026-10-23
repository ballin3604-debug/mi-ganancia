import { useEffect, useState } from 'react';
import { AppIcon } from './icons';

export default function SplashScreen({ onDone }) {
  const [imgError, setImgError] = useState(false);
  const [phase, setPhase] = useState('enter');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('show'), 100);
    const t2 = setTimeout(() => setPhase('exit'), 2200);
    const t3 = setTimeout(() => onDone(), 2700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--mg-bg-base)] transition-all duration-500 ${
        phase === 'exit' ? 'scale-105 opacity-0' : 'scale-100 opacity-100'
      }`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(560px 300px at 50% 42%, var(--mg-accent-bg), transparent 72%)' }}
      />
      <span className="sr-only">Cargando Mi Ganancia</span>
      <div className="flex flex-col items-center gap-6 z-10">
        {/* Logo iOS-style: cuadrado redondeado con icono */}
        <div className={`transition-all duration-700 ${
          phase === 'enter' ? 'opacity-0 scale-50' : 'opacity-100 scale-100'
        }`}>
          <div
            className="w-28 h-28 rounded-[28px] flex items-center justify-center shadow-2xl"
            style={{
              background: imgError ? 'linear-gradient(135deg, var(--mg-brand) 0%, var(--mg-accent) 100%)' : 'transparent',
              boxShadow: '0 20px 50px var(--mg-brand-border)',
            }}
          >
            {!imgError ? (
              <img
                src="/logo-icon.png?v=2"
                alt="Logo Mi Ganancia"
                onError={() => setImgError(true)}
                className="w-full h-full object-contain rounded-[28px]"
              />
            ) : (
              <AppIcon name="recibo" size={48} color="#fff" strokeWidth={2} />
            )}
          </div>
        </div>

        {/* Texto */}
        <div className={`text-center transition-all duration-700 delay-200 ${
          phase === 'enter' ? 'opacity-0 translate-y-3' : 'opacity-100 translate-y-0'
        }`}>
          <h1 className="text-3xl font-bold text-[var(--mg-text-primary)] tracking-tight">Mi Ganancia</h1>
          <p className="text-[var(--mg-text-secondary)] text-sm mt-1.5 tracking-tight">
            Tu negocio, simple
          </p>
        </div>
      </div>

      {/* Loading discreto abajo */}
      <div className={`absolute bottom-12 transition-all duration-700 delay-500 ${
        phase === 'enter' ? 'opacity-0' : 'opacity-100'
      }`}>
        <div className="flex gap-1.5 items-center">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--mg-accent)]"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
