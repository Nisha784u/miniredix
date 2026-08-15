/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#080808',
          1: '#101010',
          2: '#181818',
          3: '#222222',
          4: '#2a2a2a',
        },
        accent: {
          DEFAULT: '#dc2626',
          hover: '#ef4444',
          muted: '#7f1d1d',
          subtle: '#1c0707',
        },
        border: {
          DEFAULT: '#2a2a2a',
          strong: '#3a3a3a',
        },
        text: {
          primary: '#e8e8e8',
          secondary: '#999999',
          muted: '#555555',
          inverse: '#0a0a0a',
        },
        success: {
          DEFAULT: '#22c55e',
          muted: '#052e16',
          text: '#4ade80',
        },
        warning: {
          DEFAULT: '#f59e0b',
          muted: '#1c1200',
          text: '#fbbf24',
        },
        error: {
          DEFAULT: '#ef4444',
          muted: '#1c0707',
          text: '#f87171',
        },
        info: {
          DEFAULT: '#3b82f6',
          muted: '#0c1a3a',
          text: '#60a5fa',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideIn: { from: { opacity: '0', transform: 'translateY(-4px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};
