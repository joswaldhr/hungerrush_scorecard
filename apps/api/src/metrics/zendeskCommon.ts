// Common subexpressions of the former computeAllMetrics (connectors/zendesk.ts),
// moved verbatim in Phase 1B — shared by the Zendesk metric modules.
import type { ZendeskWeekData } from './types';

export function roundPercent(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

// PRESERVE-FOR-PARITY (L11): a reply outside business hours records business: 0 —
// the reply_time_in_minutes object is truthy, so the 0 is pushed and drags averages down.
export function collectReplySeconds(data: ZendeskWeekData): number[] {
  const replySeconds: number[] = [];
  for (const t of data.tickets) {
    const ms = data.metricSets.get(t.id);
    if (ms?.reply_time_in_minutes) {
      replySeconds.push(ms.reply_time_in_minutes.business * 60);
    }
  }
  return replySeconds;
}
