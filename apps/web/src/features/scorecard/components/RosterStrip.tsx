import { formatDistanceToNow, parseISO } from 'date-fns';
import type { RosterEntry } from '../../../hooks/useRoster';
import { ToneDot } from './ToneDot';

function ChipSkeleton() {
  return (
    <div className="flex-shrink-0 min-w-[168px] rounded-[10px] border border-hr-line bg-hr-card px-3.5 py-2.5 animate-pulse">
      <div className="h-3.5 bg-hr-line/60 rounded w-2/3 mb-2" />
      <div className="h-2.5 bg-hr-line/60 rounded w-1/2" />
    </div>
  );
}

function chipSubline(entry: RosterEntry): string {
  const last = entry.lastSessionDate
    ? `1:1 ${formatDistanceToNow(parseISO(entry.lastSessionDate), { addSuffix: true })}`
    : 'no 1:1 logged yet';
  return `${entry.summary.label} · ${last}`;
}

/**
 * Horizontal person-picker (replaces the dashboard table). UNORDERED by
 * design — alphabetical, never ranked; the tone dot + flag-count label point
 * attention without scoring anyone.
 */
export function RosterStrip({
  entries,
  selectedId,
  onSelect,
  loading,
}: {
  entries: RosterEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
}) {
  return (
    <div className="flex gap-2.5 overflow-x-auto pb-3 mb-2" role="group" aria-label="Your team">
      {loading
        ? Array.from({ length: 4 }, (_, i) => <ChipSkeleton key={i} />)
        : entries.map(entry => {
            const active = entry.employee.id === selectedId;
            const subline = chipSubline(entry);
            return (
              <button
                key={entry.employee.id}
                onClick={() => onSelect(entry.employee.id)}
                aria-label={`${entry.employee.full_name}, ${subline}`}
                aria-current={active ? 'true' : undefined}
                className={`flex-shrink-0 text-left rounded-[10px] px-3.5 py-2.5 min-w-[168px] max-w-[220px] border border-t-[3px] transition-all duration-100 ${
                  active
                    ? 'bg-hr-navy border-hr-navy border-t-hr-teal text-white shadow-card'
                    : 'bg-hr-card border-hr-line border-t-transparent text-hr-navy hover:-translate-y-px hover:shadow-card'
                }`}
              >
                <span className="flex items-center gap-2 mb-0.5">
                  <ToneDot tone={entry.summary.tone} />
                  <span className="font-heading text-[14px] font-bold truncate">
                    {entry.employee.full_name}
                  </span>
                </span>
                <span className={`block text-[11px] truncate ${active ? 'text-white/60' : 'text-hr-gray'}`}>
                  {subline}
                </span>
              </button>
            );
          })}
    </div>
  );
}
