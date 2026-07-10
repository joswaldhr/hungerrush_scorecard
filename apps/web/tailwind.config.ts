import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#070B14',
        foreground: '#F2F5FA',
        card: 'rgba(255, 255, 255, 0.045)',
        cardBorder: 'rgba(255, 255, 255, 0.1)',
        primary: {
          DEFAULT: '#2BD9BC', // Vibrant Teal
          glow: 'rgba(43, 217, 188, 0.35)',
        },
        secondary: {
          DEFAULT: '#35508C', // Deep Blue/Purple
          glow: 'rgba(53, 80, 140, 0.8)',
        },
        accent: {
          DEFAULT: '#E8845F', // Coral
        },
        warning: {
          DEFAULT: '#E9B454', // Amber
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Montserrat', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glass: '0 32px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)',
        glow: '0 0 40px rgba(43,217,188,0.25)',
      },
      animation: {
        'mesh-a': 'mesh-a 18s ease-in-out infinite',
        'mesh-b': 'mesh-b 22s ease-in-out infinite',
        'mesh-c': 'mesh-c 26s ease-in-out infinite',
        'fade-up': 'fade-up 0.7s cubic-bezier(0.2,0.8,0.2,1) both',
        'pulse-glow': 'pulse-glow 2.4s ease infinite',
        'grain': 'grain 9s ease-in-out infinite',
      },
      keyframes: {
        'mesh-a': {
          '0%, 100%': { transform: 'translate(-8%, -6%) scale(1)' },
          '50%': { transform: 'translate(6%, 8%) scale(1.15)' },
        },
        'mesh-b': {
          '0%, 100%': { transform: 'translate(10%, 6%) scale(1.1)' },
          '50%': { transform: 'translate(-6%, -8%) scale(0.95)' },
        },
        'mesh-c': {
          '0%, 100%': { transform: 'translate(0%, 10%) scale(1)' },
          '50%': { transform: 'translate(4%, -6%) scale(1.2)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(43,217,188,0.45)' },
          '50%': { boxShadow: '0 0 0 5px rgba(43,217,188,0)' },
        },
        grain: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '0.9' },
        }
      }
    },
  },
  plugins: [forms],
} satisfies Config;
