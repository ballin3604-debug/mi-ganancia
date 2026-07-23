import { useState } from 'react';
import { signInWithPassword, signUp } from '../services/auth';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
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
