/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Bebas Neue', 'sans-serif'],
        body:    ['Outfit', 'sans-serif'],
      },
      colors: {
        gold:  { DEFAULT: '#C9960A', light: '#F0C040' },
        brand: { blue: '#1A4FC4',    red: '#C0143C'   },
      },
    },
  },
  plugins: [],
}