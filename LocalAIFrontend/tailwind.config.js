/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      colors: {
        base:     '#0d1117',
        surface:  '#161b22',
        elevated: '#21262d',
        hover:    '#2d333b',
        active:   '#373e47',
        border:   '#30363d',
        'text-primary':   '#e6edf3',
        'text-secondary': '#8b949e',
        'text-muted':     '#6e7681',
        accent:   '#388bfd',
        'accent-hover': '#58a6ff',
        success:  '#3fb950',
        warning:  '#d29922',
        danger:   '#f85149',
        citation: '#a5d6ff',
      },
      animation: {
        'fade-in':    'fadeIn 0.25s ease',
        'slide-in':   'slideIn 0.2s ease',
        'blink':      'blink 1s step-end infinite',
        'pulse-slow': 'pulse 2s infinite',
        'spin-fast':  'spin 0.7s linear infinite',
        'highlight':  'highlightFlash 1.5s ease',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        slideIn: { from: { opacity: '0', transform: 'translateX(-12px)' }, to: { opacity: '1', transform: 'none' } },
        blink:   { '0%,100%': { opacity: '1' }, '50%': { opacity: '0' } },
        highlightFlash: {
          '0%':   { backgroundColor: 'rgba(187,128,9,0.6)' },
          '60%':  { backgroundColor: 'rgba(187,128,9,0.35)' },
          '100%': { backgroundColor: 'rgba(187,128,9,0.2)' },
        },
      },
    },
  },
  plugins: [],
}
