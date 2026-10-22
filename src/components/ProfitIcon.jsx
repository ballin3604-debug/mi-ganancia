import { palette } from '../design/tokens.js';

const E = palette.emerald;

// Icono de pila de monedas con moneda de dólar, barras y flecha de
// crecimiento (verde esmeralda). Compañero del CashBillIcon (ventas) y del
// CartBillIcon (compras), mismo trazo y paleta, para Ganancias.
export function ProfitIcon({ className = 'w-10 h-8' }) {
  return (
    <svg
      viewBox="0 0 96 76"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      {/* Pila de monedas */}
      <rect x="8" y="34" width="26" height="30" fill={E[100]} />
      <path d="M8 42 H34" stroke={E[700]} strokeWidth="3" />
      <path d="M8 50 H34" stroke={E[700]} strokeWidth="3" />
      <path d="M8 58 H34" stroke={E[700]} strokeWidth="3" />
      <path d="M8 34 L8 64" stroke={E[700]} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M34 34 L34 64" stroke={E[700]} strokeWidth="3.5" strokeLinecap="round" />
      <ellipse cx="21" cy="34" rx="13" ry="5.5" fill={E[100]} stroke={E[700]} strokeWidth="3.5" />
      <ellipse cx="21" cy="64" rx="13" ry="5.5" fill={E[200]} stroke={E[700]} strokeWidth="3.5" />

      {/* Moneda de dólar al frente */}
      <circle cx="42" cy="56" r="13" fill={E[300]} stroke={E[700]} strokeWidth="3.5" />
      <text
        x="42"
        y="62"
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontWeight="900"
        fontSize="15"
        fill={E[700]}
      >
        $
      </text>

      {/* Barras ascendentes */}
      <rect x="58" y="46" width="8" height="18" rx="2" fill={E[100]} stroke={E[700]} strokeWidth="3.5" />
      <rect x="69" y="34" width="8" height="30" rx="2" fill={E[100]} stroke={E[700]} strokeWidth="3.5" />
      <rect x="80" y="22" width="8" height="42" rx="2" fill={E[100]} stroke={E[700]} strokeWidth="3.5" />

      {/* Flecha de crecimiento */}
      <path
        d="M53 30 C63 24 72 16 82 10"
        stroke={E[600]}
        strokeWidth="3.8"
        strokeLinecap="round"
      />
      <path
        d="M74 9 H84 V19"
        stroke={E[600]}
        strokeWidth="3.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
