export default function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-[var(--mg-bg-elevated)] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[var(--mg-accent-border)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[var(--mg-text-faint)] text-sm">Cargando...</p>
      </div>
    </div>
  );
}
