import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '../index.css';
import MatrixReport from '../pages/MatrixReport';

createRoot(document.getElementById('f6-root')).render(
  <BrowserRouter>
    <div className="min-h-screen bg-[var(--mg-bg-base)] pt-7">
      <div className="fixed inset-x-0 top-0 z-[100] flex h-7 items-center justify-center bg-[var(--mg-brand)] text-[10px] font-bold tracking-wide text-[var(--mg-brand-contrast)]">
        DEV · Datos simulados · Reportes F6 · Solo revisión de diseño
      </div>
      <MatrixReport />
    </div>
  </BrowserRouter>
);
