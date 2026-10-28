import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import '../index.css';
import Layout from '../components/Layout';

const params = new URLSearchParams(window.location.search);
const initialPath = params.get('route') || '/';

function DemoPage() {
  const location = useLocation();
  return (
    <div className="p-5 lg:p-8">
      <div className="rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--mg-text-muted)]">
          Showcase dev · datos simulados · sin sesión real
        </p>
        <h1 className="text-[var(--mg-brand-text)] text-2xl font-black mt-1.5">
          Contenido de la página
        </h1>
        <p className="text-[var(--mg-text-secondary)] text-sm mt-2">
          Ruta simulada: <span className="font-mono font-bold text-[var(--mg-text-primary)]">{location.pathname}</span>
        </p>
        <p className="text-[var(--mg-text-muted)] text-xs mt-3 max-w-md">
          Este harness renderiza el Layout real de producción con contexto simulado solo para
          revisar la navegación. No valida autenticación, permisos ni datos.
        </p>
      </div>
      <div className="mt-4 h-40 rounded-2xl border border-dashed border-[var(--mg-border)] bg-[var(--mg-bg-elevated)]" />
    </div>
  );
}

createRoot(document.getElementById('f3-root')).render(
  <MemoryRouter initialEntries={[initialPath]}>
    <Routes>
      <Route element={<Layout />}>
        <Route path="*" element={<DemoPage />} />
      </Route>
    </Routes>
  </MemoryRouter>
);
