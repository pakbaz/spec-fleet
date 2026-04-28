import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'novimart-blue': '#0E5BD8',
        'novimart-gray': '#4B5563',
      },
    },
  },
  plugins: [],
};

export default config;
