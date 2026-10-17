import BranchManager from '../components/BranchManager';

export default function Branches() {
  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4 pb-28">
      <div>
        <p className="text-[11px] font-bold text-[var(--mg-text-muted)]">
          <span className="text-[var(--mg-text-primary)]">Sucursales</span>
        </p>
        <h1 className="text-2xl font-black text-[var(--mg-text-primary)] tracking-tight mt-0.5">
          Sucursales y almacenes
        </h1>
        <p className="text-xs text-[var(--mg-text-muted)] mt-0.5">
          Sedes y almacenes donde opera tu negocio
        </p>
      </div>
      <BranchManager />
    </div>
  );
}
