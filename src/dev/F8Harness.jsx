import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '../index.css';
import Onboarding from '../components/Onboarding';
import Login from '../pages/Login';
import LoadingSpinner from '../components/LoadingSpinner';
import SplashScreen from '../components/SplashScreen';
import { SyncErrorPanel } from '../components/SyncErrorPanel';
import ReceiptView from '../pages/ReceiptView';

const view = new URLSearchParams(window.location.search).get('view') || 'onboarding';

function SyncScreen() {
  return (
    <div className="min-h-screen bg-[var(--mg-bg-base)] p-4">
      <SyncErrorPanel businessId="b-demo-f7" isOpen onClose={() => {}} />
    </div>
  );
}

function View() {
  if (view === 'login') return <Login />;
  if (view === 'loading') return <LoadingSpinner />;
  if (view === 'splash') return <SplashScreen onDone={() => {}} />;
  if (view === 'sync') return <SyncScreen />;
  return <Onboarding onFinish={() => {}} />;
}

createRoot(document.getElementById('f8-root')).render(
  <MemoryRouter initialEntries={[view === 'receipt' ? '/recibo/sale-f8-demo-0001' : '/']}>
    <div className="min-h-screen bg-[var(--mg-bg-base)] pt-7">
      <div className="fixed inset-x-0 top-0 z-[100] flex h-7 items-center justify-center bg-[var(--mg-brand)] text-[10px] font-bold tracking-wide text-[var(--mg-brand-contrast)]">
        DEV · Datos simulados · Rediseño F8 · Solo revisión de diseño
      </div>
      <Routes>
        <Route path="/" element={<View />} />
        <Route path="/recibo/:saleId" element={<ReceiptView />} />
      </Routes>
    </div>
  </MemoryRouter>
);
