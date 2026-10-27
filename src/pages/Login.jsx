import { useState } from 'react';
import { signInWithPassword, signUp, signInWithGoogle } from '../services/auth';
import { supabase, isSupabaseConfigured, supabaseConfigError } from '../services/supabaseClient';
import { AppIcon } from '../components/icons';

function traducirError(message = '') {
  const msg = message.toLowerCase();
  if (msg.includes('invalid login credentials'))
    return 'Correo o contraseña incorrectos. Verifica e intenta de nuevo.';
  if (msg.includes('email not confirmed'))
    return 'Debes confirmar tu correo antes de entrar. Revisa tu bandeja de entrada.';
  if (msg.includes('user already registered') || msg.includes('already registered'))
    return 'Esa cuenta ya existe. Inicia sesión en lugar de registrarte.';
  if (msg.includes('password should be at least'))
    return 'La contraseña debe tener al menos 6 caracteres.';
  if (msg.includes('invalid email') || msg.includes('unable to validate email'))
    return 'Escribe un correo electrónico válido.';
  if (msg.includes('too many requests') || msg.includes('rate limit'))
    return 'Demasiados intentos. Espera un minuto e intenta de nuevo.';
  if (msg.includes('network') || msg.includes('fetch'))
    return 'Sin conexión. Revisa tu internet e intenta de nuevo.';
  return message || 'Ocurrió un error. Intenta de nuevo.';
}

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [imgError, setImgError] = useState(false);

  const isRegister = mode === 'register';
  const isReset = mode === 'reset';
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;

  function cambiarModo(nuevo) {
    setMode(nuevo);
    setError('');
    setSuccess('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!supabase || !isSupabaseConfigured) {
      setError(supabaseConfigError || 'Falta VITE_SUPABASE_URL. Configura tu archivo .env para poder entrar.');
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Escribe tu correo electrónico.');
      return;
    }
    if (!isReset && !password) {
      setError('Escribe tu contraseña.');
      return;
    }
    if (isRegister && password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (isRegister && !displayName.trim()) {
      setError('Escribe tu nombre para crear tu cuenta.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (isReset) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: window.location.origin,
        });
        if (resetError) throw resetError;
        setSuccess('Te enviamos un enlace para recuperar tu contraseña. Revisa tu correo.');
      } else if (isRegister) {
        await signUp(cleanEmail, password, displayName.trim());
        setSuccess('Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.');
        setMode('login');
        setPassword('');
      } else {
        await signInWithPassword(cleanEmail, password);
        // AuthContext redirige solo al detectar la sesión.
      }
    } catch (err) {
      console.error(err);
      setError(traducirError(err.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    if (!supabase || !isSupabaseConfigured) {
      setError(supabaseConfigError || 'Falta VITE_SUPABASE_URL. Configura tu archivo .env para poder entrar.');
      return;
    }
    setSocialLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error(err);
      setError(traducirError(err.message));
      setSocialLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f6f4] sm:px-5 sm:py-8">
      <section className="mg-slide-up min-h-screen w-full bg-white px-6 pb-[max(32px,env(safe-area-inset-bottom))] pt-[max(28px,env(safe-area-inset-top))] sm:min-h-0 sm:max-w-[500px] sm:rounded-[28px] sm:border sm:border-[#e7ece8] sm:px-10 sm:py-10 sm:shadow-[0_20px_70px_rgba(19,52,39,0.09)]">
        <header className="flex h-9 items-center">
          {!imgError ? (
            <img src="/logo-horizontal.png" alt="Mi Ganancia" onError={() => setImgError(true)} className="h-8 w-auto object-contain object-left" />
          ) : (
            <span className="text-lg font-extrabold tracking-tight text-[#103f32]">Mi Ganancia</span>
          )}
        </header>

        <div className="mb-8 mt-12 sm:mb-9 sm:mt-11">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#eef6f1] px-3 py-1.5 text-xs font-semibold text-[#17664f]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#13805f]" />
            Tu negocio, siempre en buenas manos
          </div>
          <h1 className="max-w-[390px] text-[30px] font-bold leading-[1.17] tracking-[-0.045em] text-[#151a17] sm:text-[34px]">
            {isReset ? 'Recupera tu acceso' : isRegister ? 'Crea tu cuenta y haz crecer tu negocio' : 'Inicia sesión o regístrate'}
          </h1>
          <p className="mt-3 max-w-[390px] text-[15px] leading-6 text-[#747b76]">
            {isReset
              ? 'Te enviaremos un enlace para que puedas volver a entrar.'
              : isRegister
                ? 'Empieza hoy a llevar las cuentas claras y tu negocio en orden.'
                : 'Un espacio sencillo para tener las cuentas claras y tu negocio al día.'}
          </p>
        </div>

        {!isSupabaseConfigured && (
          <div role="alert" className="mb-5 flex items-start gap-2 rounded-xl border border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)] px-3.5 py-2.5">
            <AppIcon name="alerta" size={16} color="var(--mg-danger)" className="mt-0.5" />
            <p className="text-xs font-semibold leading-relaxed text-[var(--mg-danger)]">
              {supabaseConfigError || 'Falta VITE_SUPABASE_URL. Configura tu archivo .env para poder entrar.'}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {isRegister && (
            <div>
              <label htmlFor="nombre" className="mb-2 block text-sm font-semibold text-[#252a27]">Tu nombre</label>
              <input
                id="nombre"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ej. María Pérez"
                autoComplete="name"
                className="h-[58px] w-full rounded-[15px] border border-[#d4dad6] bg-white px-4 text-[16px] text-[#18201b] outline-none transition placeholder:text-[#a3aaa5] focus:border-[#168266] focus:ring-4 focus:ring-[#168266]/10"
              />
            </div>
          )}

          <div>
            <label htmlFor="correo" className="mb-2 block text-sm font-semibold text-[#252a27]">Correo electrónico</label>
            <input
              id="correo"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              autoComplete="email"
              inputMode="email"
              required
              className="h-[58px] w-full rounded-[15px] border border-[#d4dad6] bg-white px-4 text-[16px] text-[#18201b] outline-none transition placeholder:text-[#a3aaa5] focus:border-[#168266] focus:ring-4 focus:ring-[#168266]/10"
            />
            <p className="mt-2 text-[13px] text-[#858b87]">
              {isReset ? 'Te enviaremos un enlace de recuperación.' : 'Usaremos tu correo para cuidar el acceso a tu negocio.'}
            </p>
          </div>

          {!isReset && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="clave" className="text-sm font-semibold text-[#252a27]">Contraseña</label>
                {!isRegister && (
                  <button type="button" onClick={() => cambiarModo('reset')} className="border-0 bg-transparent p-0 text-[13px] font-semibold text-[#167457] hover:text-[#105a43]">
                    ¿La olvidaste?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  id="clave"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isRegister ? 'Mínimo 6 caracteres' : 'Tu contraseña'}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  required
                  minLength={isRegister ? 6 : undefined}
                  className="h-[58px] w-full rounded-[15px] border border-[#d4dad6] bg-white px-4 pr-12 text-[16px] text-[#18201b] outline-none transition placeholder:text-[#a3aaa5] focus:border-[#168266] focus:ring-4 focus:ring-[#168266]/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-transparent text-[#858b87] hover:bg-[#f3f6f4]"
                >
                  <AppIcon name={showPassword ? 'ocultar' : 'ver'} size={18} color="#707873" />
                </button>
              </div>
              {isRegister && <p className="mt-2 text-[13px] text-[#858b87]">Usa 6 o más caracteres para proteger tu cuenta.</p>}
            </div>
          )}

          {offline && (
            <div role="status" className="flex items-start gap-2 rounded-xl border border-[var(--mg-warning-border)] bg-[var(--mg-warning-bg)] px-3.5 py-2.5">
              <AppIcon name="alerta" size={16} color="var(--mg-warning-text)" className="mt-0.5" />
              <p className="text-xs font-semibold leading-relaxed text-[var(--mg-warning-text)]">
                Sin conexión. Si ya iniciaste sesión en este dispositivo, la app debería abrir con tus datos guardados. Para entrar por primera vez necesitas internet.
              </p>
            </div>
          )}

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)] px-3.5 py-2.5">
              <AppIcon name="alerta" size={16} color="var(--mg-danger)" className="mt-0.5" />
              <p className="text-xs font-semibold leading-relaxed text-[var(--mg-danger)]">{error}</p>
            </div>
          )}

          {success && (
            <div role="status" className="flex items-start gap-2 rounded-xl border border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] px-3.5 py-2.5">
              <AppIcon name="ok" size={16} color="var(--mg-success-text)" className="mt-0.5" />
              <p className="text-xs font-semibold leading-relaxed text-[var(--mg-success-text)]">{success}</p>
            </div>
          )}

          <button type="submit" disabled={loading} className="mt-2 flex min-h-[58px] w-full items-center justify-center rounded-full bg-[#113f32] px-5 text-[16px] font-bold text-white transition hover:bg-[#0c352a] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                {isReset ? 'Enviando…' : isRegister ? 'Creando cuenta…' : 'Entrando…'}
              </span>
            ) : (
              <span>{isReset ? 'Enviar enlace' : isRegister ? 'Crear mi cuenta' : 'Continuar'}</span>
            )}
          </button>

          {isReset && (
            <button type="button" onClick={() => cambiarModo('login')} className="flex min-h-[44px] w-full items-center justify-center gap-1.5 border-0 bg-transparent pt-1 text-sm font-semibold text-[#167457]">
              <AppIcon name="volver" size={16} color="#167457" />
              Volver a iniciar sesión
            </button>
          )}
        </form>

        {!isReset && (
          <>
            <div className="my-7 flex items-center gap-4" aria-hidden="true">
              <div className="h-px flex-1 bg-[#e5e9e6]" />
              <span className="h-2.5 w-2.5 rounded-full border-2 border-[#c9d0cb] bg-white" />
              <div className="h-px flex-1 bg-[#e5e9e6]" />
            </div>

            <button type="button" onClick={handleGoogle} disabled={socialLoading || loading} className="flex min-h-[58px] w-full items-center justify-center gap-3 rounded-full border border-[#d4dad6] bg-white px-5 text-[15px] font-semibold text-[#202522] transition hover:bg-[#f8faf8] disabled:cursor-not-allowed disabled:opacity-60">
              {socialLoading ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#d4dad6] border-t-[#17664f]" />
              ) : (
                <>
                  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span>Continuar con Google</span>
                </>
              )}
            </button>

            <p className="mt-6 text-center text-sm text-[#737b76]">
              {isRegister ? '¿Ya tienes una cuenta?' : '¿Primera vez por aquí?'}{' '}
              <button type="button" onClick={() => cambiarModo(isRegister ? 'login' : 'register')} className="border-0 bg-transparent p-0 font-bold text-[#167457] hover:text-[#105a43]">
                {isRegister ? 'Inicia sesión' : 'Crea tu cuenta'}
              </button>
            </p>
          </>
        )}

        <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs text-[#929994]">
          <AppIcon name="seguro" size={14} color="#78827b" />
          Tus datos están protegidos. Solo tú tienes acceso.
        </p>
      </section>
    </main>
  );
}
