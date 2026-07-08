import { SPARKLINE_WEEKS, type EvidenceMetric } from '../../../lib/evidence';
import { formatMetricValue } from '../../../lib/formatMetric';
import { timeAgo } from '../../../lib/timeAgo';
import { CadenceSparkline } from './CadenceSparkline';
import { ToneDot } from './ToneDot';
import { TONE_HEX, TONE_TEXT } from './toneStyles';

/**
 * One evidence row: tone, name, trend sub-line, honest sparkline, and the two
 * labeled data windows (this week so far · last completed week). The DB
 * coaching_prompt stays always-visible per the touch-device decision.
 * showSyncedAt adds the per-row synced stamp — SharedScorecardPage must set it
 * (per-tile timestamps are that page's CLAUDE.md exception to the
 * section-level chip).
 */
export function MetricRow({
  metric,
  showSyncedAt = false,
}: {
  metric: EvidenceMetric;
  showSyncedAt?: boolean;
}) {
  const { definition, spec, assessment, currentValue, lastWeekValue, slots, domain, weeksOfHistory, trendWeeks } = metric;
  const tone = assessment.tone;
  const hasHistory = weeksOfHistory > 0;

  let sub: string;
  if (!hasHistory) {
    sub = spec?.nullLabel ?? 'No data yet';
  } else if (tone === 'new') {
    // Counts anchor to completed weeks, so their unlock count can trail the
    // synced-week count by one.
    sub = `wk ${Math.max(trendWeeks, 1)}`;
  } else {
    const abs = assessment.absoluteChange ?? 0;
    const arrow = abs > 0 ? '↑' : abs < 0 ? '↓' : '→';
    sub =
      assessment.pctChange !== null
        ? `${arrow} ${Math.abs(assessment.pctChange).toFixed(1)}%`
        : `${arrow} vs 0`;
  }

  const fmt = (v: number) => formatMetricValue(v, definition.unit);
  const ariaLabel =
    `${definition.name}: ${weeksOfHistory} of the last ${SPARKLINE_WEEKS} weeks synced` +
    (assessment.current !== null ? `, latest ${fmt(assessment.current)}` : '') +
    `, on a fixed ${fmt(domain[0])} to ${fmt(domain[1])} scale` +
    (spec?.band ? `, healthy range ${fmt(spec.band[0])} to ${fmt(spec.band[1])}` : '') +
    (definition.unit === 'count' ? ', trend measured through the last completed week' : '');

  return (
    <div className="py-3 border-b border-hr-line last:border-b-0">
      <div className="flex items-center gap-3.5 flex-wrap">
        <ToneDot tone={tone} />
        <div className="flex-1 min-w-[130px]">
          <p className="text-base font-semibold text-hr-navy">{definition.name}</p>
          <p className={`font-mono text-xs ${TONE_TEXT[tone]}`}>{sub}</p>
        </div>
        <div className="flex items-center gap-3.5 max-[520px]:w-full max-[520px]:justify-between max-[520px]:pl-5">
          {hasHistory && (
            <CadenceSparkline
              slots={slots}
              domain={domain}
              band={spec?.band}
              color={TONE_HEX[tone]}
              ariaLabel={ariaLabel}
            />
          )}
          <div className="text-right min-w-[64px]">
            <p className="font-heading font-bold text-[20px] leading-none text-hr-navy">
              {currentValue !== null ? fmt(currentValue) : '—'}
            </p>
            <p className="text-xs text-hr-gray-mid mt-0.5">this wk</p>
            {lastWeekValue !== null && (
              <p className="text-xs text-hr-gray">last wk {fmt(lastWeekValue)}</p>
            )}
          </div>
        </div>
      </div>
      <p className="text-xs text-hr-gray leading-relaxed mt-1.5 pl-[22px]">
        {definition.coaching_prompt}
      </p>
      {showSyncedAt && metric.latestSyncedAt && (
        <p className="text-xs text-hr-gray-mid mt-1 pl-[22px]">
          Synced {timeAgo(metric.latestSyncedAt)}
        </p>
      )}
    </div>
  );
}
