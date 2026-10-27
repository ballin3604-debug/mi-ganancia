import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { signOut } from '../services/auth';
import { Check, LogOut, Sparkles, XCircle, Lock } from 'lucide-react';

/* ── Hourglass SVG diseñado con la identidad y proporciones de Mi Ganancia ── */
function MiGananciaHourglass({ size = 48, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Tapa superior institucional */}
      <rect x="9" y="5" width="30" height="3.5" rx="1.75" fill="#0B2D20" />

      {/* Tapa inferior institucional */}
      <rect x="9" y="39.5" width="30" height="3.5" rx="1.75" fill="#0B2D20" />

      {/* Cuerpo de cristal con silueta simétrica */}
      <path
        d="M13 8.5 C13 18, 20.5 22, 23 24 C20.5 26, 13 30, 13 39.5 L35 39.5 C35 30, 27.5 26, 25 24 C27.5 22, 35 18, 35 8.5 Z"
        stroke="#168266"
        strokeWidth="2.2"
        strokeLinejoin="round"
        fill="rgba(22, 130, 102, 0.05)"
      />

      {/* Arena en la cámara superior */}
      <path
        d="M16 13 C16 18, 21.5 21.5, 24 22.5 C26.5 21.5, 32 18, 32 13 Z"
        fill="#168266"
      />

      {/* Hilo de arena cayendo por la cintura del reloj */}
      <line
        x1="24"
        y1="22.5"
        x2="24"
        y2="33"
        stroke="#168266"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="2 2"
      />

      {/* Arena acumulada en la cámara inferior */}
      <path
        d="M16 38 C17.5 33.5, 30.5 33.5, 32 38 Z"
        fill="#168266"
      />

      {/* Reflejo sutil en el cristal */}
      <path
        d="M16.5 11 C15.5 14, 15.5 17, 18 20"
        stroke="white"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.8"
      />
    </svg>
  );
}

export default function PendingApproval({ status }) {
  const { user, refreshSession } = useAuth();
  const [checking, setChecking] = useState(false);
  const [imgError, setImgError] = useState(false);

  async function handleCheck() {
    setChecking(true);
    try {
      await refreshSession();
    } finally {
      setChecking(false);
    }
  }

  const isRejected = status === 'rejected';
  const isSuspended = status === 'suspended';

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f6f4] sm:px-5 sm:py-8">
      <section className="mg-slide-up min-h-screen w-full bg-white px-6 pb-[max(32px,env(safe-area-inset-bottom))] pt-[max(28px,env(safe-area-inset-top))] sm:min-h-0 sm:max-w-[480px] sm:rounded-[28px] sm:border sm:border-[#e7ece8] sm:px-10 sm:py-10 sm:shadow-[0_20px_70px_rgba(19,52,39,0.09)]">
        
        {/* Cabecera con logotipo de Mi Ganancia y etiqueta de estado */}
        <header className="mb-6 flex h-9 items-center justify-between">
          {!imgError ? (
            <img
              src="/logo-horizontal.png"
              alt="Mi Ganancia"
              onError={() => setImgError(true)}
              className="h-8 w-auto object-contain object-left"
            />
          ) : (
            <span className="text-lg font-extrabold tracking-tight text-[#103f32]">Mi Ganancia</span>
          )}
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isRejected
                ? 'bg-red-50 text-red-700'
                : isSuspended
                ? 'bg-amber-50 text-amber-800'
                : 'bg-[#eef6f1] text-[#17664f]'
            }`}
          >
            {isRejected ? 'Rechazada' : isSuspended ? 'Suspendida' : 'En espera'}
          </span>
        </header>

        {/* Elemento central: Reloj de arena animado o icono de estado */}
        <div className="my-6 flex justify-center">
          {isRejected ? (
            <div className="flex h-24 w-24 items-center justify-center rounded-[28px] border border-red-200 bg-red-50 text-red-600 shadow-sm">
              <XCircle className="h-12 w-12" />
            </div>
          ) : isSuspended ? (
            <div className="flex h-24 w-24 items-center justify-center rounded-[28px] border border-amber-200 bg-amber-50 text-amber-700 shadow-sm">
              <Lock className="h-11 w-11" />
            </div>
          ) : (
            <div className="relative flex h-24 w-24 items-center justify-center rounded-[28px] border border-[#cbe4d7] bg-gradient-to-b from-[#eef6f1] to-[#e1f0e7] shadow-[0_12px_28px_rgba(22,130,102,0.14)]">
              {/* Halo sutil de pulsación */}
              <span className="pointer-events-none absolute -inset-1.5 rounded-[32px] bg-[#168266]/10 animate-pulse" />
              {/* Reloj de arena con rotación continua y pausa en cada vuelta */}
              <div className="mg-hourglass-animated text-[#168266]">
                <MiGananciaHourglass size={48} />
              </div>
            </div>
          )}
        </div>

        {/* Título y descripción */}
        <div className="text-center">
          {!isRejected && !isSuspended && (
            <div className="mb-2.5 inline-flex items-center gap-2 rounded-full bg-[#eef6f1] px-3 py-1 text-xs font-semibold text-[#17664f]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#13805f] animate-pulse" />
              Revisión de solicitud
            </div>
          )}
          <h1 className="text-[26px] font-bold leading-[1.2] tracking-[-0.045em] text-[#151a17] sm:text-[28px]">
            {isRejected
              ? 'Solicitud no aprobada'
              : isSuspended
              ? 'Cuenta suspendida'
              : 'Solicitud enviada'}
          </h1>
          <p className="mx-auto mt-2.5 max-w-[380px] text-[14px] leading-relaxed text-[#747b76]">
            {isRejected
              ? 'El administrador del negocio no autorizó esta solicitud de acceso. Si crees que se trata de un error, por favor contacta al dueño del negocio.'
              : isSuspended
              ? 'Tu cuenta ha sido pausada temporalmente. Comunícate con el administrador para reactivar tu acceso.'
              : 'Tu solicitud está siendo revisada por el administrador del negocio. En cuanto te dé acceso, podrás empezar a operar de inmediato.'}
          </p>
        </div>

        {/* Indicador de pasos con estilo Mi Ganancia */}
        {!isRejected && !isSuspended && (
          <div className="my-6 rounded-2xl border border-[#e7ece8] bg-[#f8faf8] p-4">
            <div className="relative flex items-center justify-between">
              {/* Línea conectora de progreso */}
              <div className="absolute left-[16%] right-[16%] top-4 h-[2px] bg-[#e2e8e4]">
                <div className="h-full w-1/2 bg-[#168266]" />
              </div>

              {/* Paso 1: Enviada */}
              <div className="relative z-10 flex flex-1 flex-col items-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#168266] text-white shadow-sm">
                  <Check className="h-4 w-4 stroke-[3]" />
                </div>
                <span className="mt-2 text-center text-xs font-semibold text-[#151a17]">
                  Enviada
                </span>
              </div>

              {/* Paso 2: En revisión (activo) */}
              <div className="relative z-10 flex flex-1 flex-col items-center">
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#168266] text-white ring-4 ring-[#168266]/15 shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                </div>
                <span className="mt-2 text-center text-xs font-bold text-[#168266]">
                  En revisión
                </span>
              </div>

              {/* Paso 3: Acceso activo */}
              <div className="relative z-10 flex flex-1 flex-col items-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#d4dad6] bg-white text-xs font-semibold text-[#8a928d]">
                  3
                </div>
                <span className="mt-2 text-center text-xs font-medium text-[#8a928d]">
                  Acceso
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Ficha de cuenta registrada */}
        <div className="my-5 rounded-2xl border border-[#e7ece8] bg-[#f8faf8] p-4 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef6f1] text-[#17664f] font-bold text-sm">
              {(user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8a928d]">
                Cuenta registrada
              </p>
              <p className="truncate text-sm font-semibold text-[#151a17]">
                {user?.displayName || 'Usuario'}
              </p>
              <p className="truncate text-xs text-[#747b76]">
                {user?.email}
              </p>
            </div>
          </div>
        </div>

        {/* Mensaje de apoyo en tiempo real */}
        {!isRejected && !isSuspended && (
          <div className="mb-6 flex items-start gap-2.5 rounded-xl bg-[#eef6f1] p-3 text-left">
            <Sparkles className="h-4 w-4 shrink-0 text-[#168266] mt-0.5" />
            <p className="text-xs leading-relaxed text-[#17664f]">
              Puedes dejar esta pantalla abierta. En cuanto el negocio apruebe tu solicitud, la aplicación entrará automáticamente.
            </p>
          </div>
        )}

        {/* Botones de acción */}
        <div className="space-y-3 pt-1">
          {!isRejected && !isSuspended && (
            <button
              type="button"
              onClick={handleCheck}
              disabled={checking}
              className="flex h-[54px] w-full items-center justify-center gap-2 rounded-[15px] border-0 bg-[#168266] text-[15px] font-bold text-white shadow-[0_12px_24px_rgba(22,130,102,0.22)] transition hover:bg-[#126b54] active:scale-[0.99] disabled:opacity-60"
            >
              {checking ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  Comprobando estado…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Check className="h-4 w-4 stroke-[2.5]" />
                  Ya me aprobaron · Revisar estado
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={signOut}
            className="flex h-[48px] w-full items-center justify-center gap-2 rounded-[15px] border border-[#d4dad6] bg-white text-[14px] font-semibold text-[#4a534d] transition hover:bg-[#f8faf8] active:scale-[0.99]"
          >
            <LogOut className="h-4 w-4 text-[#747b76]" />
            Cerrar sesión
          </button>
        </div>

      </section>
    </main>
  );
}
