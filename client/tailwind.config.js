/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#14213D', 50: '#EEF1F7', 100: '#D7DDEB', 400: '#3E4E77', 600: '#233256', 700: '#182645', 900: '#0B1428' },
        signal: { DEFAULT: '#FF6A3D', 50: '#FFF1EB', 100: '#FFDECE', 400: '#FF8B60', 600: '#E85226', 700: '#C43F18' },
        trust: { DEFAULT: '#2F6FED', 50: '#EAF1FE', 100: '#CFE0FC', 600: '#1E52C4' },
        mist: { DEFAULT: '#F6F7FB', 100: '#EFF1F8' },
        okgreen: { DEFAULT: '#17A673', 50: '#E7F8F1' }
      },
      fontFamily: {
        display: ['"Sora"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace']
      },
      borderRadius: { card: '1.5rem' },
      boxShadow: {
        card: '0 8px 30px -12px rgba(20, 33, 61, 0.18)',
        pop: '0 12px 40px -10px rgba(255, 106, 61, 0.35)'
      }
    }
  },
  plugins: []
}
