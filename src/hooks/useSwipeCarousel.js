import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { animate, useMotionValue, useReducedMotion } from 'motion/react';

const EASE = [0.22, 1, 0.36, 1];
const SWIPE_DURATION = 0.3;

export function useSwipeCarousel({ index, count, onChange }) {
  const viewportRef = useRef(null);
  const x = useMotionValue(0);
  const widthRef = useRef(0);
  const indexRef = useRef(index);
  const animationRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);

  indexRef.current = index;
  onChangeRef.current = onChange;

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    const measure = () => {
      const nextWidth = viewport.clientWidth;
      widthRef.current = nextWidth;
      setWidth(nextWidth);
      x.set(-indexRef.current * nextWidth);
    };

    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [x]);

  useEffect(() => () => animationRef.current?.stop(), []);

  function animateTo(targetIndex) {
    const viewportWidth = widthRef.current;
    if (!viewportWidth) return;

    animationRef.current?.stop();
    animationRef.current = animate(x, -targetIndex * viewportWidth, {
      duration: reduceMotion ? 0.001 : SWIPE_DURATION,
      ease: EASE,
    });
  }

  function goTo(targetIndex) {
    const target = Math.max(0, Math.min(count - 1, targetIndex));
    if (target === indexRef.current) {
      animateTo(target);
      return;
    }

    indexRef.current = target;
    onChangeRef.current(target);
    animateTo(target);
  }

  function handleDragStart() {
    animationRef.current?.stop();
  }

  function handleDragEnd(_, info) {
    const viewportWidth = widthRef.current;
    if (!viewportWidth) return;

    const threshold = Math.min(72, viewportWidth * 0.18);
    let target = indexRef.current;

    if (info.offset.x < -threshold || info.velocity.x < -450) target += 1;
    else if (info.offset.x > threshold || info.velocity.x > 450) target -= 1;

    target = Math.max(0, Math.min(count - 1, target));

    if (target !== indexRef.current) {
      indexRef.current = target;
      onChangeRef.current(target);
    }

    animateTo(target);
  }

  return {
    viewportRef,
    goTo,
    trackProps: {
      drag: 'x',
      dragDirectionLock: true,
      dragConstraints: { left: -(count - 1) * width, right: 0 },
      dragElastic: 0.08,
      dragMomentum: false,
      onDragStart: handleDragStart,
      onDragEnd: handleDragEnd,
      style: { x, touchAction: 'pan-y', willChange: 'transform' },
    },
  };
}
