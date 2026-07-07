import type { TrendTone } from '@scorecard/shared';
import { TONE_BG } from './toneStyles';

/** Decorative tone marker — pair it with text that carries the meaning. */
export function ToneDot({ tone }: { tone: TrendTone }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${TONE_BG[tone]}`}
    />
  );
}
