/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f5fa',
          100: '#e1ecf5',
          200: '#c3d9eb',
          300: '#94bfe0',
          400: '#5e9ed0',
          500: '#3981bf',
          600: '#2867a3',
          700: '#215284',
          800: '#1e466e',
          900: '#1b3c5c',
          950: '#0e2338',
        },
      },
    },
  },
  plugins: [],
};
