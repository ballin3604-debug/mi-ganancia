import { useState } from 'react';

// Tutorial: se muestra una sola vez tras crear el negocio.
// Recorrido centrado con el mapa real de la app, en lenguaje de tienda.
// Cada paso tiene una acción concreta ("Haz hoy") para que el usuario
// no solo lea, sino que sepa qué tocar primero.
const STEPS = [
  {
    color: '#1670C2',
    emoji: '🏠',
    title: 'Tu Inicio: el resumen del día',
    description:
      'Aquí ves cuánto vendiste hoy en efectivo y QR, tu hora pico y qué se está acabando. Es lo primero que miras al abrir.',
    accion: 'Haz hoy: abre Inicio y revisa tu total.',
  },
  {
    color: '#d99a2b',
    emoji: '🛒',
    title: 'Vender: busca, suma y cobra',
    description:
      'Busca el producto, súmalo con + y cobra. En efectivo te calcula el cambio, con QR muestras tu código, y al fiado solo escribes el nombre.',
    accion: 'Haz hoy: registra tu primera venta.',
  },
  {
    color: '#34c759',
    emoji: '🛍️',
    title: 'Compras: que el stock suba solo',
    description:
      'Cuando te llega mercadería, anota cantidad y lo que pagaste. El stock sube solo y tu ganancia sale real.',
    accion: 'Haz hoy: registra una compra de tu proveedor.',
  },
  {
    color: '#7c3aed',
    emoji: '📖',
    title: 'Fiados: quién te debe',
    description:
      'Cada fiado se guarda con nombre, teléfono y fecha límite. Los vencidos salen en rojo primero para que cobres a quien más urge.',
    accion: 'Haz hoy: revisa tus pendientes en CxC.',
  },
  {
    color: '#0c3457',
    emoji: '💸',
    title: 'Egresos: anota lo que sale',
    description:
      'Alquiler, luz, pasaje, bolsas. Si no los anotas, tu ganancia es mentira. Marca si es gasto diario o fijo del mes.',
    accion: 'Haz hoy: anota 1 gasto, aunque sea pequeño.',
  },
  {
    color: '#1670C2',
    emoji: '📈',
    title: 'Ganancia real: lo más importante',
    description:
      'En Reportes → Ganancias verás: vendido menos costo menos gastos = lo que te quedó limpio. Vender mucho no sirve si ganas poco.',
    accion: 'Haz hoy: mira tu ganancia de la semana.',
  },
  {
    color: '#34c759',
    emoji: '✅',
    title: '¡Todo listo!',
    description:
      'Tus datos se guardan solos, funcionan sin internet y se sincronizan. Si te pierdes, toca el botón "?" en cualquier pantalla.',
    accion: 'El "?" te explica cada pantalla con ejemplos.',
  },
];

export default function Tutorial({ onFinish }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function finish() {
    try { localStorage.setItem('mg_tutorial_done', '1'); } catch { /* ignore */ }
    onFinish();
  }

  function next() {
    if (isLast) finish();
    else setStep(step + 1);
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 mg-backdrop-in">
      <div className="bg-[var(--mg-bg-surface)] rounded-3xl shadow-2xl w-full max-w-sm p-6 mg-modal-in">
        <div className="flex items-center justify-between mb-5">
          <span className="text-xs font-bold text-[var(--mg-accent)] uppercase tracking-wider">
            Paso {step + 1} de {STEPS.length}
          </span>
          {!isLast && (
            <button
              onClick={finish}
              className="text-[var(--mg-text-muted)] hover:text-[var(--mg-text-secondary)] text-sm font-semibold"
            >
              Saltar
            </button>
          )}
        </div>

        <div key={step} className="text-center mg-fade-in">
          <div
            className="w-24 h-24 rounded-[28px] flex items-center justify-center mx-auto mb-5 text-5xl"
            style={{
              background: `linear-gradient(135deg, ${current.color} 0%, ${current.color}cc 100%)`,
              boxShadow: `0 16px 36px ${current.color}55`,
            }}
          >
            {current.emoji}
          </div>

          <h3 className="text-xl font-black text-[var(--mg-text-primary)] mb-2">{current.title}</h3>
          <p className="text-[var(--mg-text-secondary)] text-[14.5px] leading-relaxed">{current.description}</p>

          {current.accion && (
            <p className="mt-3 inline-block text-[12.5px] font-bold text-[var(--mg-accent)] bg-[var(--mg-accent-bg)] border border-[var(--mg-accent-border)] rounded-full px-3.5 py-1.5">
              👉 {current.accion}
            </p>
          )}
        </div>

        <div className="flex justify-center gap-1.5 my-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-[var(--mg-accent)]' : i < step ? 'w-1.5 bg-[var(--mg-accent-border)]' : 'w-1.5 bg-gray-200'
              }`}
            />
          ))}
        </div>

        <button onClick={next} className="mg-btn-primary w-full">
          {isLast ? '¡Empezar a usar la app!' : 'Continuar'}
        </button>
      </div>
    </div>
  );
}
