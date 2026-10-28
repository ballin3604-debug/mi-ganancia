import { useAppTheme } from '../../context/ThemeContext';

function ThemePreview({ theme }) {
  const bg = theme.dark ? '#0E0E0E' : '#F4F6FA';
  const surface = theme.dark ? '#161616' : '#FFFFFF';
  const line = theme.dark ? '#2E2E2E' : '#E4EAF1';
  const soft = theme.dark ? '#3A3A3A' : '#D8E0E8';
  const accent = theme.dark ? '#FF9800' : '#10B981';
  const brand = theme.dark ? '#E65100' : '#064E3B';

  return (
    <span className="block h-20 rounded-xl border border-[var(--mg-border)] p-2" style={{ background: bg }}>
      <span className="flex h-full gap-2">
        <span className="flex w-5 shrink-0 flex-col items-center gap-1 rounded-lg p-1" style={{ background: brand }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#FFFFFF' }} />
          <span className="h-1 w-2.5 rounded-full bg-white/50" />
          <span className="h-1 w-2.5 rounded-full bg-white/30" />
          <span className="mt-auto h-1 w-2.5 rounded-full bg-white/30" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex items-center justify-between">
            <span className="h-1.5 w-10 rounded-full" style={{ background: soft }} />
            <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
          </span>
          <span className="grid flex-1 grid-cols-2 gap-1.5">
            <span className="rounded-md border p-1" style={{ background: surface, borderColor: line }}>
              <span className="block h-1 w-6 rounded-full" style={{ background: accent }} />
              <span className="mt-1 block h-1 w-8 rounded-full" style={{ background: line }} />
            </span>
            <span className="rounded-md border p-1" style={{ background: surface, borderColor: line }}>
              <span className="block h-1 w-5 rounded-full" style={{ background: brand }} />
              <span className="mt-1 block h-1 w-7 rounded-full" style={{ background: line }} />
            </span>
          </span>
        </span>
      </span>
    </span>
  );
}

export function ThemePicker() {
  const { themeId, setThemeId, themes } = useAppTheme();

  return (
    <div className="mg-list !rounded-2xl shadow-xs p-3" role="radiogroup" aria-label="Tema del negocio">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {themes.map((theme) => {
          const active = theme.id === themeId;
          return (
            <button
              key={theme.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setThemeId(theme.id)}
              className={`relative rounded-2xl border-2 p-3 text-left transition-all active:scale-[0.99] ${
                active
                  ? 'border-[var(--mg-accent)] bg-[var(--mg-accent-bg)]'
                  : 'border-[var(--mg-border)] bg-[var(--mg-bg-surface)] hover:border-[var(--mg-border-hover)]'
              }`}
            >
              <ThemePreview theme={theme} />
              <span className="mt-2.5 flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block text-[13px] font-extrabold text-[var(--mg-text-primary)] leading-tight">
                    {theme.name}
                  </span>
                  <span className="mt-0.5 block text-[11px] font-medium text-[var(--mg-text-muted)] leading-snug">
                    {theme.description}
                  </span>
                </span>
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-black ${
                  active
                    ? 'border-[var(--mg-accent)] bg-[var(--mg-accent)] text-white'
                    : 'border-[var(--mg-border-hover)] text-transparent'
                }`}>
                  ✓
                </span>
              </span>
              <span className="mt-2 flex items-center gap-1.5">
                {theme.swatches.map((color) => (
                  <span
                    key={color}
                    className="h-3 w-3 rounded-full border border-black/10"
                    style={{ background: color }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2.5 px-1 text-[11px] font-medium text-[var(--mg-text-muted)]">
        El tema se guarda en este dispositivo y se aplica al instante.
      </p>
    </div>
  );
}
