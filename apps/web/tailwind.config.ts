import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'hr-navy':        '#1E2E4A',
        'hr-navy-deep':   '#141E30',
        'hr-green':       '#1D9E75',
        'hr-green-dark':  '#0F6E56',
        'hr-green-light': '#E1F5EE',
        'hr-sand':        '#F7F6F3',
        'hr-sand-md':     '#EDEBE6',
        'hr-amber':       '#D97706',
        'hr-amber-light': '#FFFBEB',
        'hr-text-1':      '#1C1917',
        'hr-text-2':      '#57534E',
        'hr-text-3':      '#A8A29E',
        'hr-gray':        '#F7F6F3',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'eyebrow': ['10px', { lineHeight: '1', letterSpacing: '0.09em', fontWeight: '600' }],
      },
      boxShadow: {
        'card':       '0 1px 3px rgba(28,25,23,0.06), 0 1px 2px rgba(28,25,23,0.04)',
        'card-hover': '0 4px 12px rgba(28,25,23,0.08), 0 2px 4px rgba(28,25,23,0.04)',
        'panel':      '0 8px 32px rgba(28,25,23,0.12), 0 2px 8px rgba(28,25,23,0.06)',
      },
      borderWidth: {
        'half': '0.5px',
      },
      borderColor: {
        'hr-base':   'rgba(28,25,23,0.08)',
        'hr-strong': 'rgba(28,25,23,0.16)',
      },
    },
  },
  plugins: [forms],
} satisfies Config;
