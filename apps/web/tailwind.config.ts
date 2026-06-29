import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'hr-navy': '#1E2E4A',
        'hr-green': '#1D9E75',
        'hr-green-dark': '#0F6E56',
        'hr-green-light': '#E1F5EE',
        'hr-gray': '#EFEFED',
      },
    },
  },
  plugins: [forms],
} satisfies Config;
