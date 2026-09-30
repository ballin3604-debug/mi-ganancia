import { useState } from 'react';
import { signInWithPassword, signUp, signInWithGoogle } from '../services/auth';
import { supabase } from '../services/supabaseClient';

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

  function cambiarModo(nuevo) {
    setMode(nuevo);
    setError('');
    setSuccess('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
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
    <div className="min-h-screen bg-[var(--mg-bg-base)] flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Fondo decorativo sutil */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(600px 300px at 50% -80px, rgba(22,112,194,0.12), transparent 70%), radial-gradient(400px 260px at 90% 110%, rgba(217,154,43,0.08), transparent 70%)',
        }}
      />

      <div className="w-full max-w-[420px] relative mg-slide-up">
        {/* Logo + título */}
        <div className="text-center mb-5">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 overflow-hidden"
            style={{
              background: imgError ? 'linear-gradient(135deg, var(--mg-accent) 0%, var(--mg-accent-deep) 100%)' : '#fff',
              boxShadow: 'var(--mg-shadow-lg)',
              border: '1px solid var(--mg-border)',
            }}
          >
            {!imgError ? (
              <img
                src="/logo-icon.png"
                alt="Logo Mi Ganancia"
                onError={() => setImgError(true)}
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-2xl font-extrabold text-white">M</span>
            )}
          </div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-[var(--mg-text-primary)]">
            Mi Ganancia
          </h1>
          <p className="text-sm text-[var(--mg-text-muted)] mt-0.5">
            {isReset ? 'Recupera tu acceso' : isRegister ? 'Crea tu cuenta gratis' : 'Tu negocio, simple'}
          </p>
        </div>

        {/* Tarjeta */}
        <div className="bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] rounded-[20px] p-6 sm:p-7" style={{ boxShadow: 'var(--mg-shadow-lg)' }}>
          {/* Segmented control */}
          {!isReset && (
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] mb-5">
              {[
                { id: 'login', label: 'Entrar' },
                { id: 'register', label: 'Crear cuenta' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => cambiarModo(t.id)}
                  className={`py-2 rounded-lg text-sm font-bold transition-all ${
                    mode === t.id
                      ? 'bg-[var(--mg-bg-surface)] text-[var(--mg-text-primary)] shadow-sm border border-[var(--mg-border)]'
                      : 'text-[var(--mg-text-muted)] border border-transparent'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
            {isRegister && (
              <div>
                <label htmlFor="nombre" className="text-xs font-bold text-[var(--mg-text-secondary)] block mb-1.5">
                  Nombre completo
                </label>
                <input
                  id="nombre"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  autoComplete="name"
                  className="mg-input"
                />
              </div>
            )}

            <div>
              <label htmlFor="correo" className="text-xs font-bold text-[var(--mg-text-secondary)] block mb-1.5">
                Correo electrónico
              </label>
              <input
                id="correo"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                autoComplete="email"
                inputMode="email"
                required
                className="mg-input"
              />
            </div>

            {!isReset && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="clave" className="text-xs font-bold text-[var(--mg-text-secondary)]">
                    Contraseña
                  </label>
                  {!isRegister && (
                    <button
                      type="button"
                      onClick={() => cambiarModo('reset')}
                      className="text-xs font-semibold text-[var(--mg-accent)] bg-transparent border-0 p-0"
                    >
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
                    placeholder={isRegister ? 'Mínimo 6 caracteres' : '••••••••'}
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    required
                    minLength={isRegister ? 6 : undefined}
                    className="mg-input pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-[var(--mg-text-muted)] bg-transparent border-0"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {isRegister && (
                  <p className="text-[11px] text-[var(--mg-text-muted)] mt-1.5">
                    Usa 6 o más caracteres para proteger tu negocio.
                  </p>
                )}
              </div>
            )}

            {error && (
              <div className="bg-[var(--mg-danger-bg)] border border-red-200 rounded-xl px-3.5 py-2.5 flex gap-2 items-start">
                <span className="text-sm leading-none mt-0.5">⚠️</span>
                <p className="text-xs font-semibold text-[var(--mg-danger)] leading-relaxed">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-[var(--mg-success-bg)] border border-green-200 rounded-xl px-3.5 py-2.5 flex gap-2 items-start">
                <span className="text-sm leading-none mt-0.5">✅</span>
                <p className="text-xs font-semibold text-[var(--mg-success-text)] leading-relaxed">{success}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="mg-btn-primary w-full !mt-5">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  {isReset ? 'Enviando…' : isRegister ? 'Creando cuenta…' : 'Entrando…'}
                </span>
              ) : (
                <span>{isReset ? 'Enviar enlace de recuperación' : isRegister ? 'Crear mi cuenta' : 'Iniciar sesión'}</span>
              )}
            </button>

            {isReset && (
              <button
                type="button"
                onClick={() => cambiarModo('login')}
                className="w-full text-center text-sm font-semibold text-[var(--mg-accent)] bg-transparent border-0 pt-1"
              >
                ← Volver a iniciar sesión
              </button>
            )}
          </form>

          {!isReset && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-[var(--mg-separator)]" />
                <span className="text-[11px] font-semibold text-[var(--mg-text-muted)] uppercase tracking-wider">
                  o continúa con
                </span>
                <div className="flex-1 h-px bg-[var(--mg-separator)]" />
              </div>

              <button
                type="button"
                onClick={handleGoogle}
                disabled={socialLoading || loading}
                className="mg-btn-tertiary w-full flex items-center justify-center gap-2.5 !py-3"
              >
                {socialLoading ? (
                  <span className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    <span className="text-sm">Continuar con Google</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>

        <p className="text-center text-[11px] text-[var(--mg-text-muted)] mt-4 flex items-center justify-center gap-1.5">
          <span>🔒</span> Tus datos están protegidos y solo tú puedes verlos.
        </p>
      </div>
    </div>
  );
}
