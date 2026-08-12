/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Escalas de "presión" táctil intermedias
      scale: {
        98: '0.98',
      },
      // Alias de las sombras de Tailwind v4 usadas por los componentes de Inicio
      boxShadow: {
        '2xs': '0 1px rgb(0 0 0 / 0.05)',
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      },
      backdropBlur: {
        xs: '4px',
      },
    },
  },
  plugins: [],
};
