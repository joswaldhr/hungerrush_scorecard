import type { TrendTone } from '@scorecard/shared';

// Hex literals mirror the Cadence tokens in tailwind.config.ts — SVG attributes
// can't consume Tailwind classes. Change them together.
export const TONE_HEX: Record<TrendTone, string> = {
  win: '#3B8272',
  discuss: '#C4553A',
  steady: '#9EA2BC',
  new: '#9EA2BC',
};
export const SPARK_BAND_FILL = TONE_HEX.win;
export const SPARK_BASELINE = '#E3E6EE';

export const TONE_TEXT: Record<TrendTone, string> = {
  win: 'text-hr-teal',
  discuss: 'text-hr-coral',
  steady: 'text-hr-gray-light',
  new: 'text-hr-gray-light',
};

export const TONE_BG: Record<TrendTone, string> = {
  win: 'bg-hr-teal',
  discuss: 'bg-hr-coral',
  steady: 'bg-hr-gray-light',
  new: 'bg-hr-gray-light',
};
