import { useEffect, useRef, useState } from 'react';

function Chevron({ direction }) {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.6}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={direction === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'}
      />
    </svg>
  );
}

// Fila de pills con desplazamiento horizontal y flechas en los extremos.
// En celular se desliza con el dedo; en PC las flechas evitan que las
// categorías queden cortadas cuando hay muchas.
export default function PillScroller({
  children,
  activeKey,
  className = '',
  wrapperClassName = '',
  ariaLabel = 'categorías',
}) {
  const scrollerRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function syncScrollState() {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(max > 2 && el.scrollLeft < max - 2);
  }

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    el.addEventListener('scroll', syncScrollState, { passive: true });
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncScrollState) : null;
    observer?.observe(el);
    window.addEventListener('resize', syncScrollState);
    return () => {
      el.removeEventListener('scroll', syncScrollState);
      observer?.disconnect();
      window.removeEventListener('resize', syncScrollState);
    };
  }, []);

  useEffect(() => {
    syncScrollState();
  });

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || activeKey === undefined) return;
    const active = el.querySelector('[aria-pressed="true"]');
    if (!active) return;
    const elRect = el.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const isVisible = activeRect.left >= elRect.left && activeRect.right <= elRect.right;
    if (isVisible) return;
    const target = el.scrollLeft + (activeRect.left - elRect.left) - (el.clientWidth - activeRect.width) / 2;
    const max = el.scrollWidth - el.clientWidth;
    el.scrollTo({ left: Math.max(0, Math.min(target, max)), behavior: 'smooth' });
  }, [activeKey]);

  function scrollPage(direction) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction * Math.max(180, Math.round(el.clientWidth * 0.7)),
      behavior: 'smooth',
    });
  }

  return (
    <div className={`relative min-w-0 shrink-0 ${wrapperClassName}`}>
      <div
        ref={scrollerRef}
        role="group"
        aria-label={ariaLabel}
        className={`overflow-x-auto scrollbar-none ${className}`}
      >
        {children}
      </div>

      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollPage(-1)}
          aria-label={`Ver ${ariaLabel} anteriores`}
          className="absolute left-0 top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] text-[var(--mg-text-secondary)] shadow-[var(--mg-shadow-md)] transition-all hover:border-[var(--mg-border-hover)] hover:text-[var(--mg-text-primary)] active:scale-90"
        >
          <Chevron direction="left" />
        </button>
      )}

      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollPage(1)}
          aria-label={`Ver más ${ariaLabel}`}
          className="absolute right-0 top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] text-[var(--mg-text-secondary)] shadow-[var(--mg-shadow-md)] transition-all hover:border-[var(--mg-border-hover)] hover:text-[var(--mg-text-primary)] active:scale-90"
        >
          <Chevron direction="right" />
        </button>
      )}
    </div>
  );
}
