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
      'ligthgray': '#cbd5e1',
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
  ],
}

