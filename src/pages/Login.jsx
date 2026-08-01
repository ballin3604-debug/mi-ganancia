import { useState } from 'react';
import { signInWithPassword, signUp, signInWithGoogle } from '../services/auth';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(''); // 'google' | 'facebook' | ''
  const [error, setError] = useState('');
  const [imgError, setImgError] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError('');
    try {
      if (isRegister) {
        await signUp(email, password, displayName);
        alert('Cuenta creada exitosamente. Inicia sesión con tus credenciales.');
        setIsRegister(false);
      } else {
        await signInWithPassword(email, password);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error al procesar la solicitud.');
    } finally {
      setLoading(false);
    }
  }

  // El navegador se redirige a Google; si falla antes de redirigir,
  // mostramos el error y liberamos el botón.
  async function handleOAuth(provider) {
    setSocialLoading(provider);
    setError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo iniciar sesión con Google.');
      setSocialLoading('');
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-between px-6 py-8">
      <div className="w-full max-w-sm flex flex-col items-center flex-1 justify-center gap-6 mg-fade-in">
        {/* Logo */}
        <div className="text-center">
          <div
            className="w-20 h-20 rounded-[20px] flex items-center justify-center mx-auto mb-4 shadow-2xl"
            style={{
              background: imgError ? 'linear-gradient(135deg, #1670C2 0%, #0c4e8c 100%)' : 'transparent',
              boxShadow: '0 20px 50px rgba(22, 112, 194, 0.35)',
            }}
          >
            {!imgError ? (
              <img
                src="/logo-icon.png"
                alt="Logo Mi Ganancia"
                onError={() => setImgError(true)}
                className="w-full h-full object-contain rounded-[20px]"
              />
            ) : (
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            )}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Mi Ganancia</h1>
          <p className="text-gray-500 text-sm mt-1">Tu negocio, simple</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          {isRegister && (
            <div>
              <label className="text-xs font-bold text-gray-500 block mb-1">Nombre Completo</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ej: Juan Pérez"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 bg-gray-50"
                required
              />
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1">Correo Electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 bg-gray-50"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 bg-gray-50"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 text-white font-semibold py-3 px-6 rounded-2xl active:scale-[0.97] hover:bg-black transition-all disabled:opacity-60 text-sm shadow-md mt-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin mx-auto" />
            ) : (
              <span>{isRegister ? 'Registrarse' : 'Iniciar Sesión'}</span>
            )}
          </button>
        </form>

        {/* Separador */}
        <div className="w-full flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">o continúa con</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Botón social */}
        <div className="w-full">
          <button
            type="button"
            onClick={() => handleOAuth('google')}
            disabled={!!socialLoading || loading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-2xl active:scale-[0.97] hover:bg-gray-50 transition-all disabled:opacity-60 text-sm shadow-sm"
          >
            {socialLoading === 'google' ? (
              <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Continuar con Google</span>
              </>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsRegister(!isRegister)}
          className="text-sm font-semibold text-blue-600 hover:text-blue-700 active:scale-95 transition-all bg-transparent border-0"
        >
          {isRegister ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
        </button>

        {error && (
          <div className="w-full bg-[var(--mg-danger-bg)] rounded-xl p-3 text-center border border-red-100">
            <p className="text-[var(--mg-danger)] text-xs font-bold">{error}</p>
          </div>
        )}
      </div>

      <div className="w-full max-w-sm text-center">
        <p className="text-gray-400 text-[10px] leading-relaxed">
          Tus datos están aislados y protegidos con Row Level Security (RLS) en Postgres.
        </p>
      </div>
    </div>
  );
}
