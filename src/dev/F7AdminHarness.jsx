import { createRoot } from 'react-dom/client';
import { BrowserRouter, useSearchParams } from 'react-router-dom';
import '../index.css';
import Expenses from '../pages/Expenses';
import Team from '../pages/Team';
import Branches from '../pages/Branches';
import Settings from '../pages/Settings';
import Inventory from '../pages/Inventory';
import AdminPanel from '../pages/AdminPanel';
import PaymentModal from '../components/PaymentModal';

function View() {
  const [params] = useSearchParams();
  const view = params.get('view') || 'expenses';

  if (view === 'team') return <Team />;
  if (view === 'branches') return <Branches />;
  if (view === 'settings') return <Settings />;
  if (view === 'inventory') return <Inventory />;
  if (view === 'admin') return <AdminPanel />;
  if (view === 'upgrade') {
    return (
      <div className="min-h-screen bg-[var(--mg-bg-base)] p-4">
        <PaymentModal businessId="b-demo-f7" initialPlan="pro" initialCycle="monthly" onClose={() => {}} onSent={() => {}} />
      </div>
    );
  }
  return <Expenses />;
}

createRoot(document.getElementById('f7-root')).render(
  <BrowserRouter>
    <div className="min-h-screen bg-[var(--mg-bg-base)] pt-7">
      <div className="fixed inset-x-0 top-0 z-[100] flex h-7 items-center justify-center bg-[var(--mg-brand)] text-[10px] font-bold tracking-wide text-[var(--mg-brand-contrast)]">
        DEV · Datos simulados · Rediseño F7 · Solo revisión de diseño
      </div>
      <View />
    </div>
  </BrowserRouter>
);
