import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { submitRequest } from '../services/admin';
import { createUserAndBusiness } from '../services/auth';
import { joinBusinessWithCode } from '../services/cashier';
import { signOut } from '../services/auth';
import { BUSINESS_CATEGORIES, DEFAULT_CATEGORY_ID } from '../config/businessCategories';

// ── Mode selector shown to regular (non-admin) new users ─────────────────────
function ModeSelector({ onSelect }) {
  return (
    <div className="min-h-screen bg-[var(--mg-bg-elevated)] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-[var(--mg-accent)] rounded-3xl flex items-center justify-center mx-auto mb-4 text-4xl shadow-sm">
            🏪
          </div>
          <h1 className="text-2xl font-bold text-[var(--mg-text-primary)]">¡Bienvenido!</h1>
          <p className="text-[var(--mg-text-muted)] mt-2 text-sm">¿Qué deseas hacer?</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => onSelect('new')}
            className="w-full bg-[var(--mg-accent)] text-white font-bold py-5 rounded-2xl text-base active:scale-95 transition-all shadow-md flex items-center gap-4 px-5"
          >
            <span className="text-3xl">🏪</span>
            <div className="text-left">
              <p className="font-black">Crear mi negocio</p>
              <p className="text-[var(--mg-accent)] text-xs font-normal mt-0.5">Registra un nuevo negocio</p>
            </div>
          </button>

          <button
            onClick={() => onSelect('join')}
            className="w-full bg-gradient-to-r from-[#1670C2] to-[#0c4e8c] text-white font-bold py-5 rounded-2xl text-base active:scale-95 transition-all shadow-md flex items-center gap-4 px-5"
          >
            <span className="text-3xl">🔑</span>
            <div className="text-left">
              <p className="font-black">Unirse con código</p>
              <p className="text-blue-100 text-xs font-normal mt-0.5">Para cajeros y dueños adicionales</p>
            </div>
          </button>
        </div>

        <button type="button" onClick={signOut} className="w-full text-[var(--mg-text-faint)] text-sm py-4 mt-4">
          Cambiar de cuenta
        </button>
      </div>
    </div>
  );
}

// ── Join with code form ───────────────────────────────────────────────────────
function JoinWithCode({ user, onBack }) {
  const { completeSetup } = useAuth();
  const [code, setCode] = useState('');
  const [cashierName, setCashierName] = useState(user?.displayName?.split(' ')[0] || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleJoin(e) {
    e.preventDefault();
    if (!code.trim() || !cashierName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { businessId, role, displayName } = await joinBusinessWithCode(user, code.trim(), cashierName.trim());
      completeSetup(businessId, role, displayName);
    } catch (err) {
      setError(err.message || 'Código inválido. Verifica y vuelve a intentar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--mg-bg-elevated)] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-[var(--mg-info-bg)] rounded-3xl flex items-center justify-center mx-auto mb-4 text-4xl shadow-sm">
            🔑
          </div>
          <h1 className="text-2xl font-bold text-[var(--mg-text-primary)]">Unirse al negocio</h1>
          <p className="text-[var(--mg-text-muted)] mt-2 text-sm">
            Ingresa el código que te dio el dueño del negocio
          </p>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-[var(--mg-text-muted)] block mb-1">
              Tu nombre (como aparecerá en las ventas)
            </label>
            <input
              type="text"
              value={cashierName}
              onChange={(e) => setCashierName(e.target.value)}
              placeholder="Ej: María, Juan, Carlos..."
              className="w-full border-2 border-[var(--mg-border)] rounded-2xl px-4 py-3 text-[var(--mg-text-primary)] text-base focus:outline-none focus:border-blue-500 transition-colors"
              autoFocus
              maxLength={40}
              required
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-[var(--mg-text-muted)] block mb-1">
              Código de acceso (6 caracteres)
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ej: AB3X9K"
              className="w-full border-2 border-[var(--mg-border)] rounded-2xl px-4 py-4 text-[var(--mg-text-primary)] text-2xl font-black text-center tracking-widest focus:outline-none focus:border-blue-500 transition-colors uppercase"
              maxLength={6}
              required
            />
          </div>

          {error && <p className="text-[var(--mg-danger)] text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={code.trim().length < 6 || !cashierName.trim() || loading}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold py-4 rounded-2xl text-lg active:scale-95 transition-all disabled:opacity-50 shadow-md"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Verificando código...
              </span>
            ) : 'Unirse al negocio'}
          </button>

          <button type="button" onClick={onBack} className="w-full text-[var(--mg-text-faint)] text-sm py-2">
            ← Volver
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Category picker ───────────────────────────────────────────────────────────
function CategoryPicker({ selected, onSelect }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-[var(--mg-text-muted)] block">
        ¿Qué tipo de negocio es? *
      </label>
      <div className="grid grid-cols-2 gap-2">
        {BUSINESS_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.id)}
            className={`flex items-center gap-2 px-3 py-3 rounded-2xl border-2 text-left transition-all active:scale-95 ${
              selected === cat.id
                ? 'border-[var(--mg-accent-border)] bg-[var(--mg-accent)]'
                : 'border-[var(--mg-border)] bg-[var(--mg-bg-surface)] hover:border-gray-300'
            }`}
          >
            <span className="text-2xl shrink-0">{cat.emoji}</span>
            <div className="min-w-0">
              <p className={`text-xs font-bold leading-tight ${selected === cat.id ? 'text-[var(--mg-accent)]' : 'text-[var(--mg-text-secondary)]'}`}>
                {cat.name}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main Setup component ──────────────────────────────────────────────────────
export default function Setup({ isAdmin = false }) {
  const { user, setRequestSent, completeSetup } = useAuth();
  const [mode, setMode] = useState(isAdmin ? 'new' : null);
  const [businessName, setBusinessName] = useState('');
  const [businessCategory, setBusinessCategory] = useState(DEFAULT_CATEGORY_ID);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Show mode selector for regular users first
  if (!isAdmin && mode === null) {
    return <ModeSelector onSelect={setMode} />;
  }

  // Join with code flow
  if (mode === 'join') {
    return <JoinWithCode user={user} onBack={() => setMode(null)} />;
  }

  // "Create business" flow (admin or regular user requesting access)
  async function handleSubmit(e) {
    e.preventDefault();
    if (!businessName.trim()) return;
    setLoading(true);
    setError('');
    try {
      if (isAdmin) {
        const businessId = await createUserAndBusiness(user, businessName.trim(), businessCategory);
        completeSetup(businessId);
      } else {
        await submitRequest(user, businessName.trim(), businessCategory);
        setRequestSent();
      }
    } catch (err) {
      console.error(err);
      setError('Error al procesar. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  const selectedCat = BUSINESS_CATEGORIES.find((c) => c.id === businessCategory);

  return (
    <div className="min-h-screen bg-[var(--mg-bg-elevated)] flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-[var(--mg-accent)] rounded-3xl flex items-center justify-center mx-auto mb-4 text-4xl shadow-sm">
            {isAdmin ? '👑' : selectedCat?.emoji || '🏪'}
          </div>
          <h1 className="text-2xl font-bold text-[var(--mg-text-primary)]">
            {isAdmin ? 'Configura tu negocio' : 'Registra tu negocio'}
          </h1>
          <p className="text-[var(--mg-text-muted)] mt-2 text-sm">
            Hola, <span className="font-semibold text-[var(--mg-text-secondary)]">{user?.displayName?.split(' ')[0]}</span>.
            {isAdmin ? ' Crea tu negocio principal.' : ' Solicita acceso a Mi Ganancia.'}
          </p>
        </div>

        {/* Steps indicator (non-admin only) */}
        {!isAdmin && (
          <>
            <div className="flex items-center gap-2 mb-2">
              {['Solicitar', 'Revisión', 'Acceso'].map((step, i) => (
                <div key={step} className="flex items-center flex-1">
                  <div className={`flex items-center gap-1.5 flex-1 ${i > 0 ? 'justify-center' : ''}`}>
                    {i > 0 && <div className="flex-1 h-px bg-[var(--mg-border)]" />}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                      i === 0 ? 'bg-[var(--mg-accent)] text-white' : 'bg-[var(--mg-border)] text-[var(--mg-text-faint)]'
                    }`}>
                      {i + 1}
                    </div>
                    {i < 2 && <div className="flex-1 h-px bg-[var(--mg-border)]" />}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-[var(--mg-text-faint)] mb-6">
              <span className="text-[var(--mg-accent)] font-semibold">Solicitar</span>
              <span>Revisión</span>
              <span>Acceso</span>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-sm font-semibold text-[var(--mg-text-muted)] block mb-1">
              ¿Cómo se llama tu negocio? *
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Ej: Tienda Don Juan, Farmacia Central..."
              className="w-full border-2 border-[var(--mg-border)] rounded-2xl px-4 py-4 text-[var(--mg-text-primary)] text-base focus:outline-none focus:border-[var(--mg-accent-border)] transition-colors"
              autoFocus
              maxLength={60}
              required
            />
          </div>

          <CategoryPicker selected={businessCategory} onSelect={setBusinessCategory} />

          {error && <p className="text-[var(--mg-danger)] text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={!businessName.trim() || loading}
            className="w-full bg-[var(--mg-accent)] text-white font-bold py-4 rounded-2xl text-lg active:scale-95 transition-all disabled:opacity-50 shadow-md"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {isAdmin ? 'Creando negocio...' : 'Enviando solicitud...'}
              </span>
            ) : isAdmin ? 'Crear negocio' : 'Enviar solicitud de acceso'}
          </button>

          {!isAdmin && (
            <p className="text-[var(--mg-text-faint)] text-xs text-center leading-relaxed">
              Tu solicitud será revisada. Tendrás acceso una vez aprobada.
            </p>
          )}

          {!isAdmin && (
            <button type="button" onClick={() => setMode(null)} className="w-full text-[var(--mg-text-faint)] text-sm py-1">
              ← Volver
            </button>
          )}

          <button type="button" onClick={signOut} className="w-full text-gray-300 text-sm py-2">
            Cambiar de cuenta
          </button>
        </form>
      </div>
    </div>
  );
}
