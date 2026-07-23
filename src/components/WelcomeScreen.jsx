import { useEffect, useState } from 'react';

export default function WelcomeScreen({ userName, onContinue }) {
  const [phase, setPhase] = useState('enter');

  useEffect(() => {
    const t = setTimeout(() => setPhase('show'), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-between p-6 pt-16">
      {/* Confetti animado simple */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full opacity-60"
            style={{
              left: `${Math.random() * 100}%`,
              top: `-20px`,
              background: ['#007aff', '#34c759', '#ff9500', '#ff3b30', '#5ac8fa'][i % 5],
              animation: `fall ${3 + Math.random() * 2}s ease-in ${Math.random() * 1.5}s forwards`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes fall {
          to { transform: translateY(100vh) rotate(360deg); opacity: 0; }
        }
      `}</style>

      <div className={`flex-1 flex flex-col items-center justify-center text-center transition-all duration-1000 ${
        phase === 'enter' ? 'opacity-0 scale-90' : 'opacity-100 scale-100'
      }`}>
        {/* Icono check grande */}
        <div
          className="w-32 h-32 rounded-full flex items-center justify-center mb-8 shadow-2xl mg-slide-up"
          style={{
            background: 'linear-gradient(135deg, #34c759 0%, #248a3d 100%)',
            boxShadow: '0 20px 50px rgba(52, 199, 89, 0.4)',
          }}
        >
          <svg className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-3">
          ¡Bienvenido{userName ? `, ${userName.split(' ')[0]}` : ''}!
        </h1>
        <p className="text-gray-500 text-lg leading-relaxed max-w-sm">
          Tu cuenta está lista. Vamos a configurar tu negocio en menos de un minuto.
        </p>

        {/* Lista de qué viene */}
        <div className="mt-10 w-full max-w-sm space-y-3 text-left">
          {[
            { icon: '🏪', text: 'Datos de tu negocio' },
            { icon: '📦', text: 'Tus primeros productos' },
            { icon: '💰', text: 'Listo para vender' },
          ].map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-3 bg-gray-50 rounded-2xl p-4 mg-fade-in"
              style={{ animationDelay: `${300 + i * 150}ms`, animationFillMode: 'backwards' }}
            >
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shrink-0 shadow-sm">
                {item.icon}
              </div>
              <span className="text-gray-900 font-medium">{item.text}</span>
              <span className="ml-auto text-gray-300">›</span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onContinue}
        className="mg-btn-primary w-full max-w-md text-base mt-6 mg-fade-in"
        style={{ animationDelay: '900ms', animationFillMode: 'backwards' }}
      >
        Configurar mi negocio
      </button>
    </div>
  );
}
