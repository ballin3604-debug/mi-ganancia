// Icono de billetes con pila de monedas (verde vibrante).
// Portado de la maqueta Inicio8 a los estilos de la app.
export function CashBillIcon({ className = 'w-10 h-8' }) {
  return (
    <svg
      viewBox="0 0 96 76"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      <path
        d="M 23 14 C 42 16 61 10 80 14 C 84 15 85 18 85 22 L 85 34"
        stroke="#10b981"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 16 23 C 36 23 54 18 73 22 C 77 23 78 25 78 30 L 78 44 C 74 44 70 44 67 44 C 55 44 55 58 55 61 L 20 61 C 17 61 16 59 16 56 Z"
        fill="#ecfdf5"
      />
      <path
        d="M 16 56 L 16 26 C 16 24 18 23 21 23 C 39 23 57 18 73 22 C 77 23 78 25 78 30 L 78 43"
        stroke="#059669"
        strokeWidth="3.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 16 56 C 16 59 18 61 21 61 L 56 61"
        stroke="#059669"
        strokeWidth="3.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 52 28 C 58 27 64 27 70 29"
        stroke="#10b981"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M 23 30 C 27 30 27 35 23 35 L 23 48 C 27 48 27 53 23 53"
        stroke="#059669"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x="45"
        y="45"
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontWeight="900"
        fontSize="21"
        fill="#047857"
      >
        $
      </text>
      <rect x="51" y="49" width="4.5" height="3.5" rx="1.5" fill="#047857" />
      <path
        d="M 58 60 C 58 67 86 67 86 60"
        stroke="#047857"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="#a7f3d0"
      />
      <path
        d="M 58 54 C 58 61 86 61 86 54"
        stroke="#047857"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="#6ee7b7"
      />
      <ellipse cx="72" cy="47" rx="14" ry="9" fill="#34d399" stroke="#047857" strokeWidth="3.8" />
      <text
        x="72"
        y="53.5"
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontWeight="900"
        fontSize="16"
        fill="#047857"
      >
        $
      </text>
    </svg>
  );
}
