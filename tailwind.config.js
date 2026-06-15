/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        forest: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#40916C',
          500: '#2D6A4F',
          600: '#1B4332',
          700: '#143328',
          800: '#0D2419',
          900: '#06150E',
        },
        earth: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#A67C00',
          500: '#8B6914',
          600: '#6B5210',
          700: '#4A390B',
          800: '#3A2C08',
          900: '#1F1704',
        },
        sky: {
          50: '#F0F9FF',
          100: '#E0F2FE',
          200: '#BAE6FD',
          300: '#90E0EF',
          400: '#48CAE4',
          500: '#00B4D8',
          600: '#0096C7',
          700: '#0077B6',
          800: '#005F8A',
          900: '#003F5E',
        },
        waitlist: '#FB8500',
        warning: '#E63946',
        success: '#06D6A0',
        cream: '#F5F0E8',
      },
      fontFamily: {
        serif: ['Noto Serif SC', 'serif'],
        sans: ['Noto Sans SC', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
