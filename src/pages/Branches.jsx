import BranchManager from '../components/BranchManager';
import PageHeader from '../components/ui/PageHeader';

export default function Branches() {
  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4 pb-28">
      <PageHeader
        icon="sucursales"
        eyebrow="Administración"
        title="Sucursales y almacenes"
        subtitle="Sedes y almacenes donde opera tu negocio."
      />
      <BranchManager />
    </div>
  );
}
