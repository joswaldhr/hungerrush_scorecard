import { useMemo } from 'react';
import type { ScorecardSessionWithDetails } from '../../../hooks/useScorecardNotes';

const MAX_VISIBLE = 8;

/**
 * Open action items from recent sessions, surfaced in the briefing so they
 * carry into the next 1:1. Completed items stay visible (struck through)
 * until they fall out of the fetched window.
 */
export function ActionItemsList({
  sessions,
  onToggle,
}: {
  sessions: ScorecardSessionWithDetails[];
  onToggle: (itemId: string, isCompleted: boolean) => Promise<{ ok: boolean; error?: string }>;
}) {
  const items = useMemo(() => {
    const flat = sessions.flatMap(s =>
      s.action_items.map(item => ({ item, sessionDate: s.session_date })),
    );
    flat.sort((a, b) => {
      if (a.item.is_completed !== b.item.is_completed) return a.item.is_completed ? 1 : -1;
      return b.sessionDate.localeCompare(a.sessionDate);
    });
    return flat;
  }, [sessions]);

  if (items.length === 0) {
    return (
      <p className="text-[13px] text-hr-gray">
        No action items yet — add them with your next session note below.
      </p>
    );
  }

  const visible = items.slice(0, MAX_VISIBLE);
  const hiddenCount = items.length - visible.length;

  return (
    <div>
      {visible.map(({ item }) => (
        <label
          key={item.id}
          className={`flex gap-2.5 items-start py-1.5 cursor-pointer text-[13.5px] ${
            item.is_completed ? 'line-through text-hr-gray-light' : 'text-hr-navy'
          }`}
        >
          <input
            type="checkbox"
            checked={item.is_completed}
            onChange={e => onToggle(item.id, e.target.checked)}
            className="mt-0.5 rounded border-hr-line text-hr-teal focus:ring-hr-teal/20"
          />
          {item.content}
        </label>
      ))}
      {hiddenCount > 0 && (
        <p className="text-[11px] text-hr-gray-light mt-1">
          +{hiddenCount} more in past sessions below
        </p>
      )}
    </div>
  );
}
