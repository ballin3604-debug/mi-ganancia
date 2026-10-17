// Icono de carrito de compras con bolsas y moneda de dólar (verde vibrante).
// Compañero del CashBillIcon (ventas), mismo trazo y paleta, para compras.
export function CartBillIcon({ className = 'w-10 h-8' }) {
  return (
    <svg
      viewBox="0 0 96 76"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      {/* Líneas de velocidad (esquina superior derecha) */}
      <path d="M84 8 L80 18" stroke="#059669" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M91 15 L85 23" stroke="#059669" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M93 27 L85 29" stroke="#059669" strokeWidth="3.5" strokeLinecap="round" />

      {/* Bolsas dentro del carrito */}
      <rect x="35" y="16" width="20" height="21" rx="2.5" fill="#ecfdf5" stroke="#047857" strokeWidth="3.5" />
      <path d="M40 16 C40 8 50 8 50 16" stroke="#047857" strokeWidth="3.5" strokeLinecap="round" />
      <rect x="56" y="21" width="16" height="16" rx="2.5" fill="#a7f3d0" stroke="#047857" strokeWidth="3.5" />
      <path d="M60 21 L60 27 H68 L68 21" stroke="#047857" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

      {/* Manija del carrito */}
      <path
        d="M6 20 H20 C24 20 26 22 27 26 L30 38"
        stroke="#047857"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Borde superior de la canasta */}
      <path d="M24 38 H74" stroke="#047857" strokeWidth="4" strokeLinecap="round" />

      {/* Canasta */}
      <path
        d="M29 38 L37 62 H63 L71 38"
        stroke="#047857"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Ranuras de la canasta */}
      <path d="M43 43 L45 57" stroke="#047857" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M51 43 L51 57" stroke="#047857" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M59 43 L57 57" stroke="#047857" strokeWidth="3.5" strokeLinecap="round" />

      {/* Ruedas */}
      <circle cx="42" cy="68" r="4.5" fill="#6ee7b7" stroke="#047857" strokeWidth="3.5" />
      <circle cx="60" cy="68" r="4.5" fill="#6ee7b7" stroke="#047857" strokeWidth="3.5" />

      {/* Moneda de dólar */}
      <circle cx="77" cy="58" r="13" fill="#34d399" stroke="#047857" strokeWidth="3.5" />
      <text
        x="77"
        y="64"
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontWeight="900"
        fontSize="15"
        fill="#047857"
      >
        $
      </text>
    </svg>
  );
}
