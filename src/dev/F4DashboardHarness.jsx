import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '../index.css';
import Dashboard from '../pages/Dashboard';

createRoot(document.getElementById('f4-root')).render(
  <BrowserRouter>
    <div className="min-h-screen bg-[var(--mg-bg-base)] pt-7">
      <div className="fixed inset-x-0 top-0 z-[100] h-7 flex items-center justify-center bg-[var(--mg-brand)] text-white text-[10px] font-bold tracking-wide">
        DEV · Datos simulados · Solo revisión de diseño
      </div>
      <Dashboard />
    </div>
  </BrowserRouter>
);
