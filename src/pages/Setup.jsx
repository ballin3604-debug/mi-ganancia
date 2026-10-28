import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { submitRequest } from '../services/admin';
import { createUserAndBusiness, signOut } from '../services/auth';
import { joinBusinessWithCode, findInviteForEmail } from '../services/cashier';
import { BUSINESS_CATEGORIES, DEFAULT_CATEGORY_ID } from '../config/businessCategories';
import {
  Store,
  Croissant,
  Wine,
  Wrench,
  Pill,
  Shirt,
  PawPrint,
  Building2,
  UtensilsCrossed,
  KeyRound,
  ArrowRight,
  Check,
} from 'lucide-react';

const CATEGORY_ICONS = {
  tienda: Store,
  panaderia: Croissant,
  licorera: Wine,
  ferreteria: Wrench,
  farmacia: Pill,
  ropa: Shirt,
  veterinaria: PawPrint,
  restaurante: UtensilsCrossed,
  otro: Building2,
};

// ── Mode selector shown to regular (non-admin) new users ─────────────────────
function ModeSelector({ onSelect }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f6f4] sm:px-5 sm:py-8">
      <section className="mg-slide-up min-h-screen w-full bg-white px-6 pb-[max(32px,env(safe-area-inset-bottom))] pt-[max(28px,env(safe-area-inset-top))] sm:min-h-0 sm:max-w-[480px] sm:rounded-[28px] sm:border sm:border-[#e7ece8] sm:px-10 sm:py-10 sm:shadow-[0_20px_70px_rgba(19,52,39,0.09)]">
        <header className="mb-8 flex h-9 items-center">
          <img src="/logo-horizontal.png" alt="Mi Ganancia" className="h-8 w-auto object-contain object-left" />
        </header>

        <div className="mb-7">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#eef6f1] px-3 py-1.5 text-xs font-semibold text-[#17664f]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#13805f]" />
            Configuración inicial
          </div>
          <h1 className="text-[28px] font-bold leading-[1.2] tracking-[-0.045em] text-[#151a17] sm:text-[32px]">
            ¡Bienvenido!
          </h1>
          <p className="mt-2 text-[15px] leading-6 text-[#747b76]">
            ¿Qué te gustaría hacer con tu cuenta hoy?
          </p>
        </div>

        <div className="space-y-3.5">
          <button
            type="button"
            onClick={() => onSelect('new')}
            className="group flex w-full items-center gap-4 rounded-2xl border-2 border-[#168266] bg-[#f0f9f5] p-4 text-left shadow-sm transition hover:bg-[#e6f4ee] active:scale-[0.99]"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#168266] text-white shadow-sm transition group-hover:scale-105">
              <Store className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-bold text-[#151a17]">Crear mi negocio</p>
              <p className="mt-0.5 text-xs font-medium text-[#167457]">Registra un nuevo negocio y sé el administrador</p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-[#168266] transition group-hover:translate-x-0.5" />
          </button>

          <button
            type="button"
            onClick={() => onSelect('join')}
            className="group flex w-full items-center gap-4 rounded-2xl border border-[#d4dad6] bg-white p-4 text-left transition hover:border-[#168266] hover:bg-[#fbfdfc] active:scale-[0.99]"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef6f1] text-[#17664f] transition group-hover:bg-[#168266] group-hover:text-white">
              <KeyRound className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-bold text-[#151a17]">Unirse con código</p>
              <p className="mt-0.5 text-xs text-[#747b76]">Para cajeros y personal con código de acceso</p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-[#a3aaa5] transition group-hover:text-[#168266] group-hover:translate-x-0.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={signOut}
          className="mt-8 flex min-h-[44px] w-full items-center justify-center border-0 bg-transparent text-sm font-semibold text-[#858b87] transition hover:text-[#18201b]"
        >
          Cerrar sesión o cambiar de cuenta
        </button>
      </section>
    </main>
  );
}

// ── Join with code form ───────────────────────────────────────────────────────
function JoinWithCode({ user, onBack }) {
  const { completeSetup } = useAuth();
  const [code, setCode] = useState('');
  const initialName = (user?.displayName && !user.displayName.includes('@') ? user.displayName : '').split(' ');
  const [firstName, setFirstName] = useState(initialName[0] || '');
  const [lastName, setLastName] = useState(initialName.slice(1).join(' ') || '');
  const [birthdate, setBirthdate] = useState(user?.user_metadata?.birthdate || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [foundInvite, setFoundInvite] = useState(null);

  useEffect(() => {
    let alive = true;
    findInviteForEmail(user?.email).then((inv) => {
      if (!alive || !inv) return;
      setFoundInvite(inv);
      setCode((prev) => prev || inv.code);
    }).catch(() => {});
    return () => { alive = false; };
  }, [user?.email]);

  const canSubmit = code.trim().length >= 6 && firstName.trim() && lastName.trim() && birthdate && !loading;

  async function handleJoin(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.replace(/\s+/g, ' ');
      const { businessId, role, displayName } = await joinBusinessWithCode(user, code.trim(), fullName, { birthdate });
      completeSetup(businessId, role, displayName);
    } catch (err) {
      setError(err.message || 'Código inválido. Verifica y vuelve a intentar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f6f4] sm:px-5 sm:py-8">
      <section className="mg-slide-up min-h-screen w-full bg-white px-6 pb-[max(32px,env(safe-area-inset-bottom))] pt-[max(28px,env(safe-area-inset-top))] sm:min-h-0 sm:max-w-[480px] sm:rounded-[28px] sm:border sm:border-[#e7ece8] sm:px-10 sm:py-10 sm:shadow-[0_20px_70px_rgba(19,52,39,0.09)]">
        <header className="mb-6 flex h-9 items-center">
          <img src="/logo-horizontal.png" alt="Mi Ganancia" className="h-8 w-auto object-contain object-left" />
        </header>

        <div className="mb-6">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#eef6f1] px-3 py-1.5 text-xs font-semibold text-[#17664f]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#13805f]" />
            Acceso a equipo
          </div>
          <h1 className="text-[28px] font-bold leading-[1.2] tracking-[-0.045em] text-[#151a17] sm:text-[32px]">
            Unirse a un negocio
          </h1>
          <p className="mt-2 text-[14.5px] leading-6 text-[#747b76]">
            Ingresa el código que te compartió el dueño de la tienda.
          </p>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          {foundInvite && (
            <div className="rounded-2xl border border-[#168266]/20 bg-[#eef6f1] px-4 py-3 text-xs">
              <p className="font-bold text-[#105a43]">
                Te invitaron a {foundInvite.businessName || 'una tienda'} como {foundInvite.role === 'owner' ? 'Dueño' : 'Cajero'}
              </p>
              <p className="mt-0.5 text-[#17664f]">Completa tus datos para ingresar directamente.</p>
            </div>
          )}

          <div className="rounded-xl border border-[#e7ece8] bg-[#f9faf9] px-4 py-2.5 text-xs text-[#747b76]">
            Te unes como: <strong className="text-[#18201b]">{user?.email || 'tu cuenta'}</strong>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#252a27]">
                Nombre *
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ej. María"
                className="h-[52px] w-full rounded-[14px] border border-[#d4dad6] bg-white px-3.5 text-[15px] text-[#18201b] outline-none transition placeholder:text-[#a3aaa5] focus:border-[#168266] focus:ring-4 focus:ring-[#168266]/10"
                autoFocus
                maxLength={30}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#252a27]">
                Apellido *
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Ej. Pérez"
                className="h-[52px] w-full rounded-[14px] border border-[#d4dad6] bg-white px-3.5 text-[15px] text-[#18201b] outline-none transition placeholder:text-[#a3aaa5] focus:border-[#168266] focus:ring-4 focus:ring-[#168266]/10"
                maxLength={30}
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#252a27]">
              Fecha de nacimiento *
            </label>
            <input
              type="date"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              className="h-[52px] w-full rounded-[14px] border border-[#d4dad6] bg-white px-3.5 text-[15px] text-[#18201b] outline-none transition focus:border-[#168266] focus:ring-4 focus:ring-[#168266]/10"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#252a27]">
              Código de acceso (6 caracteres) *
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ej. AB3X9K"
              className="h-[58px] w-full rounded-[14px] border border-[#d4dad6] bg-white px-4 text-center font-mono text-[22px] font-black tracking-widest text-[#18201b] uppercase outline-none transition placeholder:text-[#a3aaa5] focus:border-[#168266] focus:ring-4 focus:ring-[#168266]/10"
              maxLength={6}
              required
            />
          </div>

          {error && <p className="text-center text-xs font-semibold text-[var(--mg-danger)]">{error}</p>}

          <button
            type="submit"
            disabled={!canSubmit}
            className="flex h-[56px] w-full items-center justify-center gap-2 rounded-[15px] border-0 bg-[#168266] text-[16px] font-bold text-white shadow-[0_12px_24px_rgba(22,130,102,0.24)] transition hover:bg-[#126b54] active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Verificando código...
              </span>
            ) : (
              'Unirse al negocio'
            )}
          </button>

          <button
            type="button"
            onClick={onBack}
            className="flex min-h-[40px] w-full items-center justify-center border-0 bg-transparent text-sm font-semibold text-[#747b76] hover:text-[#18201b]"
          >
            ← Volver
          </button>
        </form>
      </section>
    </main>
  );
}

// ── Category picker ───────────────────────────────────────────────────────────
function CategoryPicker({ selected, onSelect }) {
  return (
    <div>
      <label className="mb-2.5 block text-sm font-semibold text-[#252a27]">
        ¿Qué tipo de negocio es? *
      </label>
      <div className="grid grid-cols-2 gap-2.5">
        {BUSINESS_CATEGORIES.map((cat) => {
          const isSel = selected === cat.id;
          const IconComponent = CATEGORY_ICONS[cat.id] || Building2;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelect(cat.id)}
              className={`relative flex items-center gap-3 rounded-[15px] p-3 text-left transition-all active:scale-[0.98] ${
                isSel
                  ? 'border-2 border-[#168266] bg-[#f0f9f5] shadow-sm'
                  : 'border border-[#d4dad6] bg-white hover:border-[#168266]/50 hover:bg-[#fbfdfc]'
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                  isSel ? 'bg-[#168266] text-white shadow-sm' : 'bg-[#eef6f1] text-[#168266]'
                }`}
              >
                <IconComponent className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-[13px] font-bold leading-tight ${isSel ? 'text-[#0f5442]' : 'text-[#252a27]'}`}>
                  {cat.name}
                </p>
              </div>
              {isSel && (
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#168266] text-white">
                  <Check className="h-3 w-3 stroke-[3]" />
                </span>
              )}
            </button>
          );
        })}
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

  if (!isAdmin && mode === null) {
    return <ModeSelector onSelect={setMode} />;
  }

  if (mode === 'join') {
    return <JoinWithCode user={user} onBack={() => setMode(null)} />;
  }

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

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f6f4] sm:px-5 sm:py-8">
      <section className="mg-slide-up min-h-screen w-full bg-white px-6 pb-[max(32px,env(safe-area-inset-bottom))] pt-[max(28px,env(safe-area-inset-top))] sm:min-h-0 sm:max-w-[540px] sm:rounded-[28px] sm:border sm:border-[#e7ece8] sm:px-10 sm:py-10 sm:shadow-[0_20px_70px_rgba(19,52,39,0.09)]">
        <header className="mb-6 flex h-9 items-center">
          <img src="/logo-horizontal.png" alt="Mi Ganancia" className="h-8 w-auto object-contain object-left" />
        </header>

        <div className="mb-6">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#eef6f1] px-3 py-1.5 text-xs font-semibold text-[#17664f]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#13805f]" />
            {isAdmin ? 'Configuración de cuenta' : 'Paso 1 de 3 · Solicitud'}
          </div>
          <h1 className="text-[28px] font-bold leading-[1.2] tracking-[-0.045em] text-[#151a17] sm:text-[32px]">
            {isAdmin ? 'Configura tu negocio' : 'Registra tu negocio'}
          </h1>
          <p className="mt-2 text-[14.5px] leading-6 text-[#747b76]">
            Hola, <span className="font-semibold text-[#18201b]">{user?.displayName?.split(' ')[0] || user?.email}</span>.
            {isAdmin ? ' Ingresa el nombre y rubro de tu negocio.' : ' Solicita tu acceso para empezar a vender.'}
          </p>
        </div>

        {/* Steps indicator (non-admin only) */}
        {!isAdmin && (
          <div className="mb-7 rounded-2xl border border-[#e7ece8] bg-[#f9faf9] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#168266] text-xs font-bold text-white shadow-sm">
                  1
                </span>
                <span className="text-xs font-bold text-[#168266]">Solicitud</span>
              </div>
              <div className="h-0.5 flex-1 bg-[#d4dad6]" />
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#eef6f1] text-xs font-bold text-[#858b87]">
                  2
                </span>
                <span className="text-xs font-medium text-[#858b87]">Revisión</span>
              </div>
              <div className="h-0.5 flex-1 bg-[#d4dad6]" />
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#eef6f1] text-xs font-bold text-[#858b87]">
                  3
                </span>
                <span className="text-xs font-medium text-[#858b87]">Acceso</span>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="businessName" className="mb-2 block text-sm font-semibold text-[#252a27]">
              ¿Cómo se llama tu negocio? *
            </label>
            <input
              id="businessName"
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Ej. Tienda Don Juan, Farmacia Central..."
              className="h-[56px] w-full rounded-[15px] border border-[#d4dad6] bg-white px-4 text-[16px] text-[#18201b] outline-none transition placeholder:text-[#a3aaa5] focus:border-[#168266] focus:ring-4 focus:ring-[#168266]/10"
              autoFocus
              maxLength={60}
              required
            />
          </div>

          <CategoryPicker selected={businessCategory} onSelect={setBusinessCategory} />

          {error && <p className="text-center text-xs font-semibold text-[var(--mg-danger)]">{error}</p>}

          <button
            type="submit"
            disabled={!businessName.trim() || loading}
            className="flex h-[56px] w-full items-center justify-center gap-2 rounded-[15px] border-0 bg-[#168266] text-[16px] font-bold text-white shadow-[0_12px_24px_rgba(22,130,102,0.24)] transition hover:bg-[#126b54] active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {isAdmin ? 'Creando negocio...' : 'Enviando solicitud...'}
              </span>
            ) : (
              isAdmin ? 'Crear negocio' : 'Enviar solicitud de acceso'
            )}
          </button>

          {!isAdmin && (
            <p className="text-center text-xs leading-relaxed text-[#858b87]">
              Tu solicitud será revisada por nuestro equipo para habilitar tu cuenta.
            </p>
          )}

          <div className="flex flex-col items-center gap-1 pt-1">
            {!isAdmin && (
              <button
                type="button"
                onClick={() => setMode(null)}
                className="flex min-h-[40px] items-center justify-center border-0 bg-transparent text-sm font-semibold text-[#167457] hover:text-[#105a43]"
              >
                ← Volver a opciones
              </button>
            )}

            <button
              type="button"
              onClick={signOut}
              className="flex min-h-[40px] items-center justify-center border-0 bg-transparent text-xs font-semibold text-[#858b87] hover:text-[#18201b]"
            >
              Cerrar sesión o cambiar de cuenta
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
