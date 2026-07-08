import { METRIC_SPECS, type MetricDefinition } from '@scorecard/shared';
import type { ManagerRollupRow, MetricToneCounts } from '../../../lib/rollup';

/**
 * One metric's tone counts as a chip. Copy stays in Cadence words — improving /
 * to discuss / steady / new — and the full breakdown lives in the tooltip and
 * accessible name. Coral is "discuss", never "alarm"; band metrics (no win
 * state) read "steady" when every report sits inside the healthy range.
 */
function chipText(counts: MetricToneCounts): string {
  const parts: string[] = [];
  if (counts.win > 0) parts.push(`${counts.win} improving`);
  if (counts.discuss > 0) parts.push(`${counts.discuss} to discuss`);
  if (parts.length === 0) return counts.steady > 0 ? 'steady' : 'new';
  return parts.join(' · ');
}

function chipDetail(label: string, counts: MetricToneCounts): string {
  const parts: string[] = [];
  if (counts.win > 0) parts.push(`${counts.win} improving`);
  if (counts.discuss > 0) parts.push(`${counts.discuss} to discuss`);
  if (counts.steady > 0) parts.push(`${counts.steady} steady`);
  if (counts.new > 0) parts.push(`${counts.new} building history`);
  return `${label}: ${parts.join(', ')} of ${counts.total} report${counts.total === 1 ? '' : 's'}`;
}

function chipClass(counts: MetricToneCounts): string {
  if (counts.discuss > 0) return 'bg-hr-coral-tint border-hr-coral/20 text-hr-coral';
  if (counts.win > 0) return 'bg-hr-teal-tint border-hr-teal/20 text-hr-teal';
  if (counts.steady > 0) return 'bg-hr-bg border-hr-line text-hr-gray';
  return 'bg-hr-bg border-hr-line text-hr-gray-light';
}

function ToneChip({ label, counts }: { label: string; counts: MetricToneCounts }) {
  const detail = chipDetail(label, counts);
  return (
    <span
      title={detail}
      aria-label={detail}
      className={`text-[11px] px-2 py-0.5 rounded-full border ${chipClass(counts)}`}
    >
      <span className="font-medium">{label}</span> · {chipText(counts)}
    </span>
  );
}

function Stat({ value, word, valueClass }: { value: number; word: string; valueClass: string }) {
  return (
    <div className="text-center">
      <div className={`font-heading font-extrabold text-[20px] leading-none ${valueClass}`}>
        {value}
      </div>
      <div className="text-[10px] text-hr-gray mt-1">{word}</div>
    </div>
  );
}

/**
 * One manager's team card on the rollup. The stat pair and chips are flag /
 * trend counts over the shared trend window — same engine as the briefing, so
 * the rollup can never contradict a person's scorecard.
 */
export function RollupCard({
  row,
  definitions,
  onOpen,
}: {
  row: ManagerRollupRow;
  definitions: MetricDefinition[];
  onOpen: () => void;
}) {
  const chips = definitions.filter(d => row.tones[d.key]);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`View ${row.manager.full_name}'s team — ${row.wins} wins, ${row.toDiscuss} to discuss`}
      className="w-full text-left bg-hr-card rounded-xl border border-hr-line p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 transition-all duration-100 hover:-translate-y-px hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hr-teal focus-visible:ring-offset-2"
    >
      <div className="w-full sm:w-56 flex-shrink-0 min-w-0">
        <p className="font-heading text-[14px] font-bold text-hr-navy truncate">
          {row.manager.full_name}
        </p>
        <p className="text-[11px] text-hr-gray-light truncate">{row.manager.email}</p>
        <p className="text-[11px] text-hr-gray mt-0.5">
          {row.employeeCount} report{row.employeeCount === 1 ? '' : 's'}
          {row.inactiveCount > 0 && (
            <span className="text-hr-gray-light"> · {row.inactiveCount} no longer synced</span>
          )}
        </p>
      </div>
      <div className="flex-1 flex flex-wrap gap-1.5 min-w-0">
        {chips.length > 0 ? (
          chips.map(def => (
            <ToneChip
              key={def.key}
              label={METRIC_SPECS[def.key]?.shortLabel ?? def.name}
              counts={row.tones[def.key]!}
            />
          ))
        ) : (
          <span className="text-[11px] text-hr-gray-light">
            No trend data yet — builds as weekly syncs accumulate.
          </span>
        )}
      </div>
      <div className="flex gap-5 flex-shrink-0 sm:pl-2">
        <Stat value={row.wins} word="wins" valueClass="text-hr-teal" />
        <Stat
          value={row.toDiscuss}
          word="to discuss"
          valueClass={row.toDiscuss > 0 ? 'text-hr-coral' : 'text-hr-gray-light'}
        />
      </div>
    </button>
  );
}
