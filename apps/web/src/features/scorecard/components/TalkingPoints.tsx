import type { TalkingPoint } from '../../../lib/coaching';
import {
  NEW_HIRE_COPY,
  NO_DATA_COPY,
  NO_DATA_SUGGESTION,
  STEADY_WEEK_COPY,
  STEADY_WEEK_SUGGESTION,
} from '../../../lib/coaching';

const KIND_COLOR: Record<TalkingPoint['kind'], { text: string; border: string; leadBg: string }> = {
  discuss:   { text: 'text-hr-coral', border: 'border-l-hr-coral', leadBg: 'bg-hr-coral-tint border-hr-coral/20' },
  celebrate: { text: 'text-hr-teal',  border: 'border-l-hr-teal',  leadBg: 'bg-hr-teal-tint border-hr-teal/20' },
  growth:    { text: 'text-hr-teal',  border: 'border-l-hr-teal',  leadBg: 'bg-hr-teal-tint border-hr-teal/20' },
  note:      { text: 'text-hr-amber', border: 'border-l-hr-amber', leadBg: 'bg-hr-amber-tint border-hr-amber/20' },
  ramping:   { text: 'text-hr-amber', border: 'border-l-hr-amber', leadBg: 'bg-hr-amber-tint border-hr-amber/20' },
};

function PointsSkeleton() {
  return (
    <div className="animate-pulse space-y-2.5" aria-hidden="true">
      <div className="h-[72px] bg-hr-line/60 rounded-lg" />
      <div className="h-14 bg-hr-line/60 rounded-lg" />
      <div className="h-14 bg-hr-line/60 rounded-lg" />
    </div>
  );
}

/**
 * The briefing's core: talking points ordered discuss → celebrate → notes,
 * the top one flagged "start here" with its suggested opening question.
 */
export function TalkingPoints({
  points,
  allNew,
  noData,
  loading,
}: {
  points: TalkingPoint[];
  allNew: boolean;
  noData: boolean;
  loading: boolean;
}) {
  if (loading) return <PointsSkeleton />;

  if (noData) {
    return (
      <div className="bg-hr-bg rounded-lg p-4">
        <p className="text-[13px] text-hr-navy mb-1">{NO_DATA_COPY}</p>
        <p className="text-[13px] text-hr-gray">{NO_DATA_SUGGESTION}</p>
      </div>
    );
  }

  if (allNew) {
    return (
      <div className="bg-hr-bg rounded-lg p-4">
        <p className="text-[13px] text-hr-gray leading-relaxed">{NEW_HIRE_COPY}</p>
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="bg-hr-bg rounded-lg p-4">
        <p className="text-[13px] text-hr-navy mb-1">{STEADY_WEEK_COPY}</p>
        <p className="text-[13px] text-hr-gray">{STEADY_WEEK_SUGGESTION}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {points.map((p, i) => {
        const c = KIND_COLOR[p.kind];
        const lead = i === 0 && (p.kind === 'discuss' || p.kind === 'celebrate');
        return (
          <div
            key={i}
            className={`rounded-lg border-l-[3px] ${c.border} ${
              lead ? `border ${c.leadBg} px-4 py-3.5` : 'bg-hr-bg px-3.5 py-3'
            }`}
          >
            <div className="flex gap-2 items-baseline mb-1">
              <span className={`font-heading text-[10px] font-bold tracking-[0.1em] uppercase ${c.text}`}>
                {p.kind}
              </span>
              {lead && (
                <span className={`font-heading text-[10px] font-bold tracking-[0.1em] uppercase text-white rounded px-1.5 py-0.5 ${p.kind === 'discuss' ? 'bg-hr-coral' : 'bg-hr-teal'}`}>
                  start here
                </span>
              )}
            </div>
            <p className={`${lead ? 'text-[14px]' : 'text-[13.5px]'} text-hr-navy leading-normal`}>
              {p.text}
            </p>
            {p.ask && (
              <p className="text-[13px] text-hr-navy-soft italic mt-1.5">Ask: {p.ask}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
