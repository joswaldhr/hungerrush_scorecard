import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

// Cadence tokens (Phase 3, 2026-07-07) — the T object in
// docs/design/hungerrush-cadence/cadence-v2.jsx is the source of these values.
// CLAUDE.md's token table is amended in the same commit that lands this file.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'hr-navy':       '#0C1443', // headings · nav · primary ink
        'hr-navy-soft':  '#3A3F6B', // eyebrows · secondary navy
        'hr-teal':       '#3B8272', // brand accent · wins · actions
        'hr-teal-tint':  '#EAF3F0', // positive tint backgrounds
        'hr-coral':      '#C4553A', // the ONE attention accent — "discuss", never "alarm"
        'hr-coral-tint': '#FBF1EE', // lead discuss-card background
        'hr-amber':      '#E9930F', // system degradation (stale sync) · notes tone
        'hr-amber-tint': '#FDF4E3', // stale-banner background
        'hr-amber-deep': '#8A5A0B', // readable amber text on the tint
        'hr-bg':         '#F6F7F9', // page background
        'hr-card':       '#FFFFFF',
        'hr-line':       '#E3E6EE', // borders · dividers
        'hr-gray':       '#5C607E', // secondary text
        'hr-gray-light': '#9EA2BC', // tertiary text · steady/new tone
        // The pre-Cadence transitional aliases (hr-green, hr-sand, hr-text-*, …)
        // were retired 2026-07-07 with the last old surface (Phase 3 session 2).
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Montserrat', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'card':       '0 1px 3px rgba(12,20,67,0.08), 0 4px 16px rgba(12,20,67,0.06)',
        'card-hover': '0 4px 12px rgba(12,20,67,0.10), 0 2px 4px rgba(12,20,67,0.06)',
        'panel':      '0 8px 32px rgba(12,20,67,0.14), 0 2px 8px rgba(12,20,67,0.06)',
      },
    },
  },
  plugins: [forms],
} satisfies Config;
