import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { isSupabaseConfigured, supabaseConfigError } from './services/supabaseClient';
import Layout from './components/Layout';
import Login from './pages/Login';
import Setup from './pages/Setup';
import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import Compras from './pages/Compras';
import Inventory from './pages/Inventory';
import Expenses from './pages/Expenses';
import Settings from './pages/Settings';
import AdminPanel from './pages/AdminPanel';
import MatrixReport from './pages/MatrixReport';
import ReceiptView from './pages/ReceiptView';
import PendingApproval from './pages/PendingApproval';
import Branches from './pages/Branches';
import Team from './pages/Team';
import LoadingSpinner from './components/LoadingSpinner';
import SplashScreen from './components/SplashScreen';
import Onboarding from './components/Onboarding';
import WelcomeScreen from './components/WelcomeScreen';
import Tutorial from './components/Tutorial';

const splashShown = { done: false };

// ── Helpers para localStorage ────────────────────────────────────────────
function lsGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, value); } catch { }
}

// ── PWA update banner ────────────────────────────────────────────────────
function UpdateBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.ready.then((reg) => {
      if (reg.waiting) { setShow(true); return; }
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        if (!newSW) return;
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            setShow(true);
          }
        });
      });
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) { refreshing = true; window.location.reload(); }
    });
  }, []);

  if (!show) return null;

  function handleUpdate() {
    navigator.serviceWorker.ready.then((reg) => {
      if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
    });
  }

  return (
    <div className="fixed top-0 inset-x-0 z-50 flex justify-center px-4 pt-2">
      <div className="bg-[var(--mg-accent)] text-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg max-w-md w-full">
        <span className="text-xl shrink-0">🔄</span>
        <p className="flex-1 text-sm font-semibold">Nueva versión disponible</p>
        <button
          onClick={handleUpdate}
          className="bg-white text-[var(--mg-accent)] font-bold text-xs px-3 py-1.5 rounded-lg active:scale-95"
        >
          Actualizar
        </button>
      </div>
    </div>
  );
}

export default function App() {
  // Sin .env: mostrar error controlado en vez de pantalla blanca.
  // Esto salta ANTES de cualquier llamada a Supabase.
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-[var(--mg-bg-base)]">
        <div className="w-full max-w-[480px] bg-[var(--mg-bg-surface)] border border-red-200 rounded-[20px] p-6 sm:p-8 text-center" style={{ boxShadow: 'var(--mg-shadow-lg)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-red-50 border border-red-200">
            <span className="text-2xl">⛔</span>
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-[var(--mg-text-primary)]">
            Falta configuración
          </h1>
          <p className="text-sm font-semibold text-red-700 mt-2 leading-relaxed">
            {supabaseConfigError || 'Falta VITE_SUPABASE_URL. Configura tu archivo .env para continuar.'}
          </p>
          <p className="text-xs text-[var(--mg-text-muted)] mt-3 leading-relaxed">
            Copia <code className="font-mono bg-gray-100 px-1 rounded">.env.example</code> como{' '}
            <code className="font-mono bg-gray-100 px-1 rounded">.env</code>, completa{' '}
            <code className="font-mono bg-gray-100 px-1 rounded">VITE_SUPABASE_URL</code> y{' '}
            <code className="font-mono bg-gray-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> con los
            valores de Supabase (Project Settings → API) y reinicia la app.
          </p>
        </div>
      </div>
    );
  }

  const { user, loading, needsSetup, userStatus, admin, businessId } = useAuth();
  const [showSplash, setShowSplash] = useState(!splashShown.done);

  // ── Estado de los nuevos flujos ────────────────────────────────────────
  // Onboarding: primera vez que se abre la app (sin login todavía)
  const [showOnboarding, setShowOnboarding] = useState(() => !lsGet('mg_onboarding_done'));
  // Welcome: solo se muestra una vez después de loguearse por primera vez
  const [showWelcome, setShowWelcome] = useState(false);
  // Tutorial: después del setup inicial, una sola vez
  const [showTutorial, setShowTutorial] = useState(false);

  function handleSplashDone() {
    splashShown.done = true;
    setShowSplash(false);
  }

  // Detectar primer login del usuario para mostrar Welcome
  useEffect(() => {
    if (user && needsSetup && !lsGet('mg_welcome_done')) {
      setShowWelcome(true);
    }
  }, [user, needsSetup]);

  // Detectar setup recién completado para mostrar Tutorial
  useEffect(() => {
    if (user && !needsSetup && businessId && !lsGet('mg_tutorial_done')) {
      // Solo lo mostramos si ya pasó por el welcome (es decir, primera vez completa)
      if (lsGet('mg_welcome_done')) {
        setShowTutorial(true);
      }
    }
  }, [user, needsSetup, businessId]);

  function handleWelcomeContinue() {
    lsSet('mg_welcome_done', '1');
    setShowWelcome(false);
  }

  function handleTutorialFinish() {
    lsSet('mg_tutorial_done', '1');
    setShowTutorial(false);
  }

  // ── ORQUESTACIÓN DE PANTALLAS ──────────────────────────────────────────

  // 1. Splash (siempre primero, una sola vez por sesión)
  if (showSplash) return <SplashScreen onDone={handleSplashDone} />;

  // 2. Onboarding (primera vez en la vida del navegador)
  if (showOnboarding && !user) {
    return <Onboarding onFinish={() => setShowOnboarding(false)} />;
  }

  // 3. Loading auth
  if (loading) return <LoadingSpinner />;

  // 4. No logueado → Login
  if (!user) return <Login />;

  // 5. Welcome (después del primer login, antes del setup)
  if (showWelcome) {
    return <WelcomeScreen userName={user.displayName} onContinue={handleWelcomeContinue} />;
  }

  // 6. Setup de admin sin negocio
  if (admin && needsSetup) return <Setup isAdmin />;

  // 7. Admin con negocio
  if (admin && businessId) {
    return (
      <>
        <UpdateBanner />
        <Routes>
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="ventas" element={<Sales />} />
            <Route path="compras" element={<Compras />} />
            <Route path="inventario" element={<Inventory />} />
            <Route path="egresos" element={<Expenses />} />
            <Route path="reportes" element={<MatrixReport />} />
            <Route path="configuracion" element={<Settings />} />
            <Route path="sucursales" element={<Branches />} />
            <Route path="equipo" element={<Team />} />
            <Route path="recibo/:saleId" element={<ReceiptView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        {showTutorial && <Tutorial onFinish={handleTutorialFinish} />}
      </>
    );
  }

  // 8. Setup usuario regular
  if (needsSetup) return <Setup />;

  // 9. Estados intermedios
  if (userStatus === 'pending' || userStatus === 'rejected' || userStatus === 'suspended') {
    return <PendingApproval status={userStatus} />;
  }

  // 10. Usuario activo regular
  return (
    <>
      <UpdateBanner />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="ventas" element={<Sales />} />
          <Route path="compras" element={<Compras />} />
          <Route path="inventario" element={<Inventory />} />
          <Route path="egresos" element={<Expenses />} />
          <Route path="reportes" element={<MatrixReport />} />
          <Route path="configuracion" element={<Settings />} />
          <Route path="sucursales" element={<Branches />} />
          <Route path="equipo" element={<Team />} />
          <Route path="recibo/:saleId" element={<ReceiptView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      {showTutorial && <Tutorial onFinish={handleTutorialFinish} />}
    </>
  );
}
