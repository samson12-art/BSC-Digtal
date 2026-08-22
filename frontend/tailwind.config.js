/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e6f2f0',
          100: '#cce5e1',
          200: '#99cbc3',
          300: '#66b1a5',
          400: '#339787',
          500: '#136f63',
          600: '#0e554c',
          700: '#0a3f38',
          800: '#072a25',
          900: '#041512',
        },
        surface: '#ffffff',
        muted: '#6c7774',
        border: '#dfe7e4',
        sidebar: '#101918',
      }
    },
  },
  plugins: [],
}
