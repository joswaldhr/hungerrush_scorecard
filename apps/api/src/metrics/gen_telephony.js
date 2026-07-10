const fs = require('fs');
const specs = [
  { key: 'ib_calls_answered', filter: "c.direction === 'inbound' && c.completion_status === 'completed'", map: null },
  { key: 'ib_calls_declined', filter: "c.direction === 'inbound' && c.completion_status === 'declined'", map: null },
  { key: 'ib_calls_missed', filter: "c.direction === 'inbound' && c.completion_status === 'missed'", map: null },
  { key: 'ib_talk_time', filter: "c.direction === 'inbound'", map: "c => c.talk_time" },
  { key: 'ob_talk_time', filter: "c.direction === 'outbound'", map: "c => c.talk_time" },
  { key: 'ob_calls', filter: "c.direction === 'outbound'", map: null }
];

specs.forEach(s => {
  const content = `import { METRIC_SPECS, type MetricSpec } from '@scorecard/shared';
import type { ZendeskWeekData } from './types';

export const spec: MetricSpec = METRIC_SPECS['${s.key}']!;

export function compute(data: ZendeskWeekData): number | null {
  const calls = data.calls.filter(c => ${s.filter});
  if (calls.length === 0) return null;
  ${s.map ? `const total = calls.reduce((sum, c) => sum + (${s.map})(c), 0);
  return Math.round(total / calls.length);` : `return calls.length;`}
}
`;
  fs.writeFileSync(`apps/api/src/metrics/${s.key}.ts`, content);
});
console.log('Done');
