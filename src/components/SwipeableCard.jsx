import { useRef, useState } from 'react';

const SWIPE_THRESHOLD = 60;

export default function SwipeableCard({ onEdit, onDelete, children }) {
  const [offset, setOffset] = useState(0);
  const [swiped, setSwiped] = useState(false);
  const startX = useRef(null);
  const startY = useRef(null);
  const isScrolling = useRef(null);

  function onTouchStart(e) {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isScrolling.current = null;
  }

  function onTouchMove(e) {
    if (startX.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (isScrolling.current === null) {
      isScrolling.current = Math.abs(dy) > Math.abs(dx);
    }
    if (isScrolling.current) return;

    e.preventDefault();
    const raw = swiped ? dx - 120 : dx;
    if (raw < 0) setOffset(Math.max(raw, -120));
    else if (swiped) setOffset(Math.min(raw, 0));
  }

  function onTouchEnd() {
    if (isScrolling.current) return;
    if (offset < -SWIPE_THRESHOLD) {
      setOffset(-120);
      setSwiped(true);
    } else {
      setOffset(0);
      setSwiped(false);
    }
    startX.current = null;
  }

  function close() {
    setOffset(0);
    setSwiped(false);
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Action buttons behind */}
      <div className="absolute inset-y-0 right-0 flex items-stretch w-28">
        <button
          onClick={() => { close(); onEdit(); }}
          className="flex-1 bg-blue-500 flex items-center justify-center text-white font-bold text-xs gap-1 flex-col active:brightness-90"
        >
          <span className="text-xl">✏️</span>
          Editar
        </button>
        <button
          onClick={() => { close(); onDelete(); }}
          className="flex-1 bg-red-500 flex items-center justify-center text-white font-bold text-xs gap-1 flex-col active:brightness-90"
        >
          <span className="text-xl">🗑️</span>
          Borrar
        </button>
      </div>

      {/* Card content - slides left */}
      <div
        className="relative z-10 transition-transform duration-200"
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={swiped ? close : undefined}
      >
        {children}
      </div>
    </div>
  );
}
