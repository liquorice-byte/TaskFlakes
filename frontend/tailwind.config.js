/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fef7ed',
          100: '#fdecd6',
          200: '#fad8ac',
          300: '#f6be79',
          400: '#f09843',
          500: '#ed7d1f',
          600: '#de6216',
          700: '#b84a14',
          800: '#933b16',
          900: '#773216',
        },
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(-4px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 120ms ease-out',
        slideInRight: 'slideInRight 180ms ease-out',
      },
    },
  },
  plugins: [],
};
