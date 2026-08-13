/** @type {import('tailwindcss').Config} */
export default {
  // 'class' (not 'media') so the toggle is a real user choice stored in localStorage,
  // not just mirroring the OS setting with no way to override it.
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Every one of these reads from a CSS variable (defined in index.css for
        // :root and .dark) instead of a fixed hex value. This is what makes every
        // existing `bg-cream`, `text-ink`, `bg-forest`, etc. across the whole app
        // automatically switch between light/dark -- none of those ~26 files needed
        // a single line changed; only the token definitions here and the variable
        // values in index.css did.
        cream: 'rgb(var(--color-cream) / <alpha-value>)',
        'cream-dark': 'rgb(var(--color-cream-dark) / <alpha-value>)',
        forest: {
          DEFAULT: 'rgb(var(--color-forest) / <alpha-value>)',
          light: 'rgb(var(--color-forest-light) / <alpha-value>)',
        },
        clay: {
          DEFAULT: 'rgb(var(--color-clay) / <alpha-value>)',
          light: 'rgb(var(--color-clay-light) / <alpha-value>)',
        },
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
      },
      fontFamily: {
        // A thin, high-contrast editorial serif for display type — the single most
        // important lever for reading as "premium" instead of "template". Used large
        // and sparingly, never for body copy or UI chrome (that stays on Inter).
        display: ['"Instrument Serif"', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl2: '1.25rem',
        xl3: '1.75rem',
      },
      letterSpacing: {
        widest2: '0.18em',
      },
    },
  },
  plugins: [],
}
