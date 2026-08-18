/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        deck: {
          950: '#0A0E14',
          900: '#0F141C',
          800: '#161C27',
          700: '#212938',
          600: '#2E3849',
          border: '#28303F',
        },
        signal: {
          amber: '#E8A33D',
          teal: '#3DDDC0',
          rose: '#E8637A',
          violet: '#9B87F5',
        },
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui'],
      },
      keyframes: {
        pulse_dot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.4', transform: 'scale(0.85)' },
        },
        rise_in: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        pulse_dot: 'pulse_dot 1.4s ease-in-out infinite',
        rise_in: 'rise_in 0.25s ease-out',
      },
    },
  },
  plugins: [],
};
