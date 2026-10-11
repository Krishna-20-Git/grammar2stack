/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#080A12',
        panel: '#111827',
        panel2: '#0D1220',
        edge: '#1F2A3D',
        cyan: { DEFAULT: '#00F5FF', dim: '#0A4F57' },
        magenta: { DEFAULT: '#FF2BD6', dim: '#5A1450' },
        lime: { DEFAULT: '#B6FF00', dim: '#3E5410' },
        violet: { DEFAULT: '#8B5CFF', dim: '#2E2160' },
        danger: { DEFAULT: '#FF3B4F', dim: '#5A1620' },
        ink: '#F1F5F9',
        slate: { DEFAULT: '#94A3B8', deep: '#64748B' },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'Menlo', 'monospace'],
        display: ['"Chakra Petch"', '"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
