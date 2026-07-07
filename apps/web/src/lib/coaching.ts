// Cadence coaching engine — FLAGS-ONLY in Phase 3 (ADOPTION.md decision 3).
// Talking points + suggested opening questions are computed client-side from
// metric trend flags. The per-person context fields (workload/growth/ramping/
// personal) are a fast-follow AFTER Phase 3: the PersonContext branches below
// are deliberately dormant template code — no caller passes context yet, and
// the manager edit UI + table + RLS land with that fast-follow.
//
// These strings are situational ENGINE copy (which flag fired), not per-metric
// coaching prompts — metric_definitions.coaching_prompt still renders on the
// evidence panel. Every string here must pass the coaching-language rules;
// coaching.test.ts enforces the forbidden list over all generated output.
import type { TrendAssessment, TrendTone } from '@scorecard/shared';
import { formatMetricValue } from './formatMetric';
import type { AssessedTiming } from './evidence';

export interface AssessedMetric {
  key: string;
  /** Display name from metric_definitions (DB-owned). */
  label: string;
  /** metric_definitions.unit — drives value formatting inside point text. */
  unit: string;
  /**
   * Which week the assessed value belongs to — copy tense must match:
   * 'current' says "now", 'lastWeek' says "last week" (count metrics anchor
   * there by design), 'stale'/null says "at last sync". Never claim "now"
   * about a value the row beside it doesn't show as this week's.
   */
  timing: AssessedTiming | null;
  assessment: TrendAssessment;
}

/** Dormant until the post-Phase-3 context fast-follow (ADOPTION.md decision 3). */
export interface PersonContext {
  workload?: string;
  growth?: string;
  personal?: string;
  ramping?: string;
}

export type TalkingPointKind = 'discuss' | 'celebrate' | 'growth' | 'note' | 'ramping';

export interface TalkingPoint {
  kind: TalkingPointKind;
  text: string;
  /** Suggested opening question — only the first discuss + first celebrate keep one. */
  ask?: string;
}

const ASK_DISCUSS = '“What’s changed in your queue lately that I might not see from my side?”';
const ASK_PACE = '“How is the pace feeling lately — honestly?”';
const ASK_CELEBRATE = '“What’s working here that we should protect?”';
// Dormant context-blend variants (fast-follow):
const ASK_WORKLOAD = '“If you could hand off one thing this month, what would it be?”';
const ASK_GROWTH = '“What would you want your first stretch project to be?”';
const ASK_RAMPING = '“What’s been most confusing so far?”';

/** Shown instead of talking points when every metric is in the "new" state. */
export const NEW_HIRE_COPY =
  'Under a month of history — trends unlock at week 4. Keep this one about onboarding.';

/** Empty-state copy when no metric is a discuss or a win this week. */
export const STEADY_WEEK_COPY =
  'A steady week across the board — no metric needs the spotlight.';
export const STEADY_WEEK_SUGGESTION =
  'Good week for a growth conversation — or review the open action items below.';

/** Empty-state copy for a person with no synced metrics at all. */
export const NO_DATA_COPY =
  'No synced metrics for this person yet — talking points build once data starts flowing.';
export const NO_DATA_SUGGESTION =
  'You can still capture notes and action items below.';

function directionWord(absoluteChange: number): string {
  return absoluteChange > 0 ? 'up' : 'down';
}

function pctText(pctChange: number): string {
  return `${Math.abs(pctChange).toFixed(0)}%`;
}

/**
 * Build the briefing's talking points, ordered discuss → celebrate → context
 * notes. Presentation marks the first point "start here" when it is a discuss
 * or celebrate. Steady and new metrics contribute nothing.
 */
export function buildTalkingPoints(
  metrics: AssessedMetric[],
  context?: PersonContext,
): TalkingPoint[] {
  const discuss: TalkingPoint[] = [];
  const celebrate: TalkingPoint[] = [];
  const notes: TalkingPoint[] = [];

  for (const m of metrics) {
    const a = m.assessment;
    if (a.current === null) continue;
    const value = formatMetricValue(a.current, m.unit);
    // Honest tense: the phrase names the week the assessed value belongs to.
    const valueNow =
      m.timing === 'current' ? `${value} now`
        : m.timing === 'lastWeek' ? `${value} last week`
          : `${value} at last sync`;
    const thisWeek =
      m.timing === 'current' ? 'this week'
        : m.timing === 'lastWeek' ? 'last week'
          : 'in its latest synced week';
    const atValue =
      m.timing === 'current' ? `at ${value}`
        : m.timing === 'lastWeek' ? `at ${value} last week`
          : `last synced at ${value}`;

    if (a.tone === 'discuss') {
      if (a.bandPosition === 'above') {
        discuss.push({
          kind: 'discuss',
          text: `${m.label} ${atValue} — above the healthy range; worth checking the pace is sustainable.`,
          ask: context?.workload ? ASK_WORKLOAD : ASK_PACE,
        });
      } else if (a.bandPosition === 'below') {
        discuss.push({
          kind: 'discuss',
          text: `${m.label} ${atValue} — below the healthy range ${thisWeek}.`,
          ask: ASK_DISCUSS,
        });
      } else if (a.pctChange === null || a.absoluteChange === null) {
        discuss.push({
          kind: 'discuss',
          text: `${m.label} moved to ${value} ${thisWeek}.`,
          ask: ASK_DISCUSS,
        });
      } else {
        discuss.push({
          kind: 'discuss',
          text: `${m.label} ${directionWord(a.absoluteChange)} ${pctText(a.pctChange)} — ${valueNow}.`,
          ask: ASK_DISCUSS,
        });
      }
    }

    if (a.tone === 'win') {
      const text =
        a.pctChange === null || a.absoluteChange === null
          ? `${m.label} at ${value} ${thisWeek} — building from a quiet stretch.`
          : `${m.label} ${directionWord(a.absoluteChange)} ${pctText(a.pctChange)} vs. the last few weeks.`;
      celebrate.push({ kind: 'celebrate', text, ask: ASK_CELEBRATE });
    }
  }

  // Dormant context branches (fast-follow) — no caller passes context in Phase 3.
  if (context?.growth) notes.push({ kind: 'growth', text: `${context.growth}.`, ask: ASK_GROWTH });
  if (context?.personal) notes.push({ kind: 'note', text: `${context.personal}.` });
  if (context?.ramping) notes.push({ kind: 'ramping', text: `${context.ramping}.`, ask: ASK_RAMPING });

  // Keep asks from repeating: only the first discuss + first celebrate keep theirs.
  const trimAsks = (points: TalkingPoint[]) =>
    points.map((p, i) => (i === 0 ? p : { kind: p.kind, text: p.text }));

  return [...trimAsks(discuss), ...trimAsks(celebrate), ...notes];
}

/**
 * Roster-chip summary: dot tone + label from a person's metric tones.
 * Labels are flag counts in coaching-safe words (ADOPTION.md repairs: no
 * "needs attention", nothing that echoes "flag").
 */
export function rosterSummary(tones: TrendTone[]): { tone: TrendTone; label: string } {
  if (tones.length === 0) return { tone: 'new', label: 'no data yet' };
  if (tones.every(t => t === 'new')) return { tone: 'new', label: 'ramping' };
  const discussCount = tones.filter(t => t === 'discuss').length;
  if (discussCount >= 2) return { tone: 'discuss', label: 'focus this week' };
  if (discussCount === 1) return { tone: 'steady', label: 'one to discuss' };
  return { tone: 'win', label: 'on track' };
}
