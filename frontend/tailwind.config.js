/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        credifi: {
          bg: "#090d16",
          surface: "#0f172a",
          card: "#131d33",
          border: "#1e293b",
          blue: "#2563eb",
          cyan: "#00d2ff",
          emerald: "#10b981",
          amber: "#f59e0b",
          rose: "#ef4444",
          text: "#f8fafc",
          muted: "#94a3b8"
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'glow': '0 0 25px -5px rgba(0, 210, 255, 0.25)',
        'glow-blue': '0 0 25px -5px rgba(37, 99, 235, 0.35)',
      }
    },
  },
  plugins: [],
};
