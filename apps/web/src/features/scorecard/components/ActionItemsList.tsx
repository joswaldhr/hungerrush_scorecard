import { useMemo, useState } from 'react';
import {
  ACTION_TOGGLE_FAILED_COPY,
  type ScorecardSessionWithDetails,
} from '../../../hooks/useScorecardNotes';
import { WarnBanner } from '../../../components/WarnBanner';

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
  const [toggleError, setToggleError] = useState<string | null>(null);

  const handleToggle = async (itemId: string, isCompleted: boolean) => {
    setToggleError(null);
    const result = await onToggle(itemId, isCompleted);
    // The toggle is optimistic — by now a failed write has already been
    // undone on screen, and the copy says so (raw error text stays in the
    // result for callers that want it).
    if (!result.ok) {
      setToggleError(ACTION_TOGGLE_FAILED_COPY);
    }
  };

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
      <p className="text-base text-hr-gray">
        No action items yet — add them with your next session note below.
      </p>
    );
  }

  const visible = items.slice(0, MAX_VISIBLE);
  const hiddenCount = items.length - visible.length;

  return (
    <div>
      {toggleError && <WarnBanner className="mb-2">{toggleError}</WarnBanner>}
      {visible.map(({ item }) => (
        <label
          key={item.id}
          className={`flex gap-2.5 items-start py-1.5 cursor-pointer text-base ${
            item.is_completed ? 'line-through text-hr-gray-mid' : 'text-hr-navy'
          }`}
        >
          <input
            type="checkbox"
            checked={item.is_completed}
            onChange={e => handleToggle(item.id, e.target.checked)}
            className="mt-0.5 rounded border-hr-line text-hr-teal focus:ring-hr-teal/20"
          />
          {item.content}
        </label>
      ))}
      {hiddenCount > 0 && (
        <p className="text-xs text-hr-gray-mid mt-1">
          +{hiddenCount} more in past sessions below
        </p>
      )}
    </div>
  );
}
