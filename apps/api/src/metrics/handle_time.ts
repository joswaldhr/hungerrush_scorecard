import { METRIC_SPECS, type MetricSpec } from '@scorecard/shared';
import type { AssembledWeekData } from './types';

export const spec: MetricSpec = METRIC_SPECS['handle_time']!;

// Average duration in seconds of individual productive (customer-facing) state entries.
// Null when no state matches a productive name — the deliberate asymmetry with
// occupancy/adherence's L6 zeros (this one already behaves correctly).
export function compute(data: AssembledWeekData): number | null {
  const customerFacing = data.states.filter(s => data.productiveStateNames.has(s.state));
  if (customerFacing.length === 0) return null;
  const seconds = customerFacing.reduce((sum, s) => sum + (s.end_time - s.start_time), 0);
  return Math.round(seconds / customerFacing.length);
}
