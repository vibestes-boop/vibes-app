/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        vibe: {
          purple: '#A78BFA',
          green: '#34D399',
          yellow: '#FBBF24',
          pink: '#F472B6',
          blue: '#60A5FA',
        },
      },
    },
  },
  plugins: [],
};
