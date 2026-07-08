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
        'hr-teal':       '#3B8272', // brand accent — FILLS/BORDERS/dots (as text: white bg only, 4.54:1)
        'hr-teal-deep':  '#2E6653', // teal TEXT on tints/white (5.91:1 on tint, 6.68:1 white — audit PR 4)
        'hr-teal-tint':  '#EAF3F0', // positive tint backgrounds
        'hr-coral':      '#C4553A', // the ONE attention accent — "discuss", never "alarm"; FILLS/BORDERS/dots
        'hr-coral-deep': '#A8442C', // coral TEXT on tints/white (5.36:1 on tint, 5.95:1 white — audit PR 4)
        'hr-coral-tint': '#FBF1EE', // lead discuss-card background
        'hr-amber':      '#E9930F', // system degradation (stale sync) · notes tone — fills/borders
        'hr-amber-tint': '#FDF4E3', // stale-banner background
        'hr-amber-deep': '#8A5A0B', // readable amber text on the tint (5.42:1)
        'hr-bg':         '#F6F7F9', // page background
        'hr-card':       '#FFFFFF',
        'hr-line':       '#E3E6EE', // borders · dividers
        'hr-gray':       '#5C607E', // secondary text (6.12:1 on white)
        'hr-gray-mid':   '#687090', // tertiary TEXT (4.87:1 white, 4.55:1 bg — audit PR 4; gray-light failed at 2.52)
        'hr-gray-light': '#9EA2BC', // decoration ONLY: dots · skeleton accents — never text (2.52:1)
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Montserrat', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      // The ONE type scale (audit PR 4) — shadows Tailwind's core steps below 16px
      // so an accidental core `text-sm` can't reintroduce an off-scale size.
      // Sizes only (no bundled line-heights), matching how the previous
      // arbitrary values behaved. Display sizes (16px+) stay per-surface.
      fontSize: {
        xs: '11px',    // labels · eyebrows · chips · stamps
        sm: '12.5px',  // sublines · meta text
        base: '13.5px', // body
        lg: '15px',    // emphasized body · page titles
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
