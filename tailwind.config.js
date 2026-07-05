/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#F7F1E3',
        'cream-dark': '#F0E8D6',
        forest: {
          DEFAULT: '#0D3B31',
          light: '#134A3E',
        },
        clay: {
          DEFAULT: '#E8733B',
          light: '#F3A46B',
        },
        ink: '#1C1B18',
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
}
