import BranchManager from '../components/BranchManager';
import PageHeader from '../components/ui/PageHeader';
import UpgradeScreen from '../components/UpgradeScreen';
import { usePlan } from '../hooks/usePlan';

export default function Branches() {
  const { can, loading } = usePlan();

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto pb-28">
        <div className="h-40 rounded-3xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] animate-pulse" />
      </div>
    );
  }

  if (!can('branches')) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4 pb-28">
        <PageHeader
          icon="sucursales"
          eyebrow="Administración"
          title="Sucursales y almacenes"
          subtitle="Sedes y almacenes donde opera tu negocio."
        />
        <UpgradeScreen
          feature="branches"
          title="Sucursales y almacenes son Premium"
          compact
        />
      </div>
    );
  }

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
