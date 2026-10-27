import { motion, useReducedMotion } from 'motion/react';

export default function OnboardingSlide({ slide, active, titleId, descriptionId }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={active && !reduceMotion ? { opacity: 0, y: 14 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="flex h-full w-full flex-col items-center justify-center px-2 py-4 text-center sm:px-4"
    >
      <img
        src={slide.image}
        alt=""
        aria-hidden="true"
        draggable={false}
        loading="eager"
        className="pointer-events-none mb-5 h-[32vh] max-h-[320px] w-auto max-w-full object-contain sm:mb-6 sm:h-[36vh]"
      />
      <h1 id={titleId} className="text-[26px] font-extrabold leading-tight tracking-tight text-[#12304F] sm:text-3xl">
        {slide.title}
      </h1>
      <p id={descriptionId} className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed text-[#5B7183] sm:mt-4 sm:max-w-sm sm:text-base">
        {slide.description}
      </p>
    </motion.div>
  );
}
