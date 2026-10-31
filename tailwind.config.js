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
        lic: {
          navy: '#0b192c',
          blue: '#1e3e62',
          gold: '#ff6500',
          yellow: '#f5a623',
          dark: '#000000',
        },
        primary: {
          50: '#f0f5fa',
          100: '#e1ecf5',
          200: '#c3d9eb',
          500: '#1e3e62',
          600: '#172f4a',
          700: '#0f1f33',
          800: '#0b192c',
          900: '#07101c',
        },
        accent: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#16a34a',
          600: '#15803d',
          700: '#166534',
        }
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif'
        ]
      }
    },
  },
  plugins: [],
}
