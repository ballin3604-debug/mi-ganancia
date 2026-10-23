export default function LoadingSpinner() {
  return (
    <div role="status" aria-live="polite" className="mg-fade-in flex min-h-screen items-center justify-center bg-[var(--mg-bg-base)]">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center">
          <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-[var(--mg-accent-border)] border-t-[var(--mg-accent)]" />
        </div>
        <p className="mg-pulse-dot text-sm font-semibold text-[var(--mg-text-secondary)]">Cargando…</p>
      </div>
    </div>
  );
}
