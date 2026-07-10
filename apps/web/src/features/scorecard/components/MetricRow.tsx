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
    <div className="py-4 border-b border-white/10 last:border-b-0">
      <div className="flex items-center gap-3.5 flex-wrap">
        <ToneDot tone={tone} />
        <div className="flex-1 min-w-[130px]">
          <p className="text-[14px] font-semibold text-[#F2F5FA]">{definition.name}</p>
          <p className={`font-mono text-[11px] mt-0.5 ${TONE_TEXT[tone]}`}>{sub}</p>
        </div>
        <div className="flex items-center gap-4 max-[520px]:w-full max-[520px]:justify-between max-[520px]:pl-5">
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
            <p className="font-heading font-bold text-[18px] leading-none text-[#F2F5FA]">
              {currentValue !== null ? fmt(currentValue) : '—'}
            </p>
            <p className="text-[11px] text-[#5E6980] mt-1">this wk</p>
            {lastWeekValue !== null && (
              <p className="text-[11px] text-[#98A2B8] mt-0.5">last wk {fmt(lastWeekValue)}</p>
            )}
          </div>
        </div>
      </div>
      <p className="text-[12px] text-[#98A2B8] leading-[1.4] mt-2 pl-[22px]">
        {definition.coaching_prompt}
      </p>
      {showSyncedAt && metric.latestSyncedAt && (
        <p className="text-[11px] text-[#5E6980] mt-1 pl-[22px]">
          Synced {timeAgo(metric.latestSyncedAt)}
        </p>
      )}
    </div>
  );
}
