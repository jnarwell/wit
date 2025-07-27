// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'mono': ['"Roboto Mono"', 'monospace'],
        'sans': ['"Roboto Mono"', 'monospace'],
        'serif': ['"Roboto Mono"', 'monospace'],
      }
    },
  },
  plugins: [],
}