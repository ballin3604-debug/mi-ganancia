export default function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-[var(--mg-bg-elevated)] flex items-center justify-center mg-fade-in">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[var(--mg-accent-border)] border-t-[var(--mg-accent)] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[var(--mg-text-faint)] text-sm mg-pulse-dot">Cargando...</p>
      </div>
    </div>
  );
}
