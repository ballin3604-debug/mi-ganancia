import { motion, useReducedMotion } from 'motion/react';

export default function OnboardingDots({ count, active, onChange }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex items-center gap-0" role="group" aria-label={`Progreso: paso ${active + 1} de ${count}`}>
      {Array.from({ length: count }, (_, index) => {
        const isActive = index === active;
        return (
          <button
            key={index}
            type="button"
            onClick={() => onChange(index)}
            aria-label={`Ir a pantalla ${index + 1} de ${count}`}
            aria-current={isActive ? 'true' : undefined}
            className="flex h-6 w-6 items-center justify-center"
          >
            <motion.span
              initial={false}
              animate={{ width: isActive ? 22 : 8, opacity: isActive ? 1 : 0.55 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className={`block h-1.5 rounded-full motion-reduce:transition-none ${isActive ? 'bg-[#0F9675]' : 'bg-[#C7D2DA]'}`}
            />
          </button>
        );
      })}
    </div>
  );
}
