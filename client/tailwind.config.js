/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        justice: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc7fb',
          400: '#36a8f7',
          500: '#0c8de7',
          600: '#016fc4',
          700: '#02589f',
          800: '#064b83',
          900: '#0a3f6d',
          950: '#072848',
        },
        slate: {
          850: '#151f32',
          900: '#0f172a',
          950: '#080d1a',
        },
        badge: {
          verified: '#10b981',
          mismatch: '#ef4444',
          pending: '#f59e0b',
          custody: '#6366f1'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'glow': '0 0 20px -5px rgba(12, 141, 231, 0.4)',
        'glow-success': '0 0 20px -5px rgba(16, 185, 129, 0.4)',
        'glow-danger': '0 0 20px -5px rgba(239, 68, 68, 0.4)',
      }
    },
  },
  plugins: [],
}
