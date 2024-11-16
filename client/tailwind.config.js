/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      'white': '#f1f5f9',
      'lightgray': '#e5e7eb',
      'gray': '#64748b',
      'darkgray': '#334155',
      'blackgray': '#0f172a',
      'black': '#020617',
      },
    extend: {
      stroke: {
        white: '#f1f5f9',
        lightgray: '#cbd5e1',
      },
    },
  },
  plugins: [
    require('daisyui'),
    function ({ addUtilities }) {
      addUtilities({
        '.scrollbar-thin': {
          '::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '::-webkit-scrollbar-thumb': {
            backgroundColor: '#d1d5db', // light gray color
            borderRadius: '4px',
          },
          '::-webkit-scrollbar-track': {
            backgroundColor: '#f3f4f6', // lighter gray color
          },
        },
      });
    },
  ],
}

