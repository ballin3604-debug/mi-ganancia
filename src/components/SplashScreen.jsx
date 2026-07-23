import { useEffect, useState } from 'react';

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
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center transition-all duration-500 bg-white ${
        phase === 'exit' ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
      }`}
    >
      <div className="flex flex-col items-center gap-6 z-10">
        {/* Logo iOS-style: cuadrado redondeado con icono */}
        <div className={`transition-all duration-700 ${
          phase === 'enter' ? 'opacity-0 scale-50' : 'opacity-100 scale-100'
        }`}>
          <div
            className="w-28 h-28 rounded-[28px] flex items-center justify-center shadow-2xl"
            style={{
              background: imgError ? 'linear-gradient(135deg, #007aff 0%, #0051d5 100%)' : 'transparent',
              boxShadow: '0 20px 50px rgba(0, 122, 255, 0.35)',
            }}
          >
            {!imgError ? (
              <img
                src="/logo-icon.png"
                alt="Logo Mi Ganancia"
                onError={() => setImgError(true)}
                className="w-full h-full object-contain rounded-[28px]"
              />
            ) : (
              <svg className="w-14 h-14 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            )}
          </div>
        </div>

        {/* Texto */}
        <div className={`text-center transition-all duration-700 delay-200 ${
          phase === 'enter' ? 'opacity-0 translate-y-3' : 'opacity-100 translate-y-0'
        }`}>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Mi Ganancia</h1>
          <p className="text-gray-500 text-sm mt-1.5 tracking-tight">
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
              className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
