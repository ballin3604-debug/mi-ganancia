import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '../index.css';
import Sales from '../pages/Sales';

createRoot(document.getElementById('f5-root')).render(
  <BrowserRouter>
    <div className="flex h-screen flex-col bg-[var(--mg-bg-base)] pt-7">
      <div className="fixed inset-x-0 top-0 z-[100] flex h-7 items-center justify-center bg-[var(--mg-brand)] text-[10px] font-bold tracking-wide text-[var(--mg-brand-contrast)]">
        DEV · Datos simulados · Solo revisión de diseño
      </div>
      <div className="min-h-0 flex-1">
        <Sales />
      </div>
    </div>
  </BrowserRouter>
);
