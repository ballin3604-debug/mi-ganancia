import { useId } from 'react';

const MOUNTAIN_LEFT = 'M294 169 L575 583 L10 583 Z M302 388 L322 388 L202 583 L167 583 Z';
const MOUNTAIN_CENTER = 'M541 65 L662 241 L516 453 L396 313 Z M541 85 L452 208 L465 200 L490 232 L515 192 L542 251 L570 203 L600 240 L627 217 Z';
const MOUNTAIN_SMALL = 'M720 426 L833 583 L605 583 Z';
const MOUNTAIN_RIGHT = 'M797 318 L978 583 L860 583 L743 397 Z';
const ARROW_SHAFT = 'M459 583 L573 583 L875 155 L761 155 Z';
const ARROW_HEAD = 'M941 6 L713 78 L761 155 L921 223 Z';

export default function BrandMark({ className = '', animated = false }) {
  const uid = useId().replace(/:/g, '');
  const gradientId = `mg-mark-gradient-${uid}`;

  return (
    <svg
      viewBox="0 0 1000 600"
      className={`mg-brand-mark${animated ? ' is-animated' : ''} ${className}`.trim()}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="600" x2="1000" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0B3A2B" />
          <stop offset="0.55" stopColor="#0C4A38" />
          <stop offset="1" stopColor="#0F9675" />
        </linearGradient>
      </defs>
      <g fill={`url(#${gradientId})`}>
        <path d={MOUNTAIN_LEFT} fillRule="evenodd" />
        <path d={MOUNTAIN_CENTER} fillRule="evenodd" />
        <path d={MOUNTAIN_SMALL} />
        <path d={MOUNTAIN_RIGHT} />
        <g className="mg-brand-mark__arrow">
          <path d={ARROW_SHAFT} />
          <path d={ARROW_HEAD} />
        </g>
      </g>
      {animated && (
        <path
          className="mg-brand-mark__spark"
          d="M522 566 L912 90"
          pathLength="1"
        />
      )}
    </svg>
  );
}
