import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { X } from 'lucide-react';
import { currentWeekStartUtc, weekStartStr } from '@scorecard/shared';
import { WarnBanner } from '../../components/WarnBanner';
import {
  ACTION_TOGGLE_FAILED_COPY,
  type ScorecardSessionWithDetails,
} from '../../hooks/useScorecardNotes';

interface NotesPanelProps {
  sessions: ScorecardSessionWithDetails[];
  loading: boolean;
  managerId: string;
  onSave: (
    managerId: string,
    sessionDate: string,
    noteContent: string,
    actionItems: string[],
  ) => Promise<{ ok: boolean; error?: string }>;
  onToggleActionItem: (itemId: string, isCompleted: boolean) => Promise<{ ok: boolean; error?: string }>;
  /**
   * Reports whether a draft (note text or pending action items) would be lost
   * if the panel unmounted — the roster person-switch guard reads it. The
   * panel reports clean on unmount.
   */
  onDirtyChange?: (dirty: boolean) => void;
}

function NotesSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden="true">
      <div className="h-6 bg-hr-line/60 rounded w-1/4" />
      <div className="h-24 bg-hr-line/60 rounded" />
      <div className="h-10 bg-hr-line/60 rounded w-1/3" />
    </div>
  );
}

const fieldLabel = 'text-xs font-semibold uppercase tracking-[0.07em] text-hr-gray-mid mb-1.5 block';
const fieldInput =
  'rounded-lg border-hr-line text-base text-hr-navy placeholder:text-hr-gray-mid focus:ring-hr-teal/20 focus:border-hr-teal/40';

/** UTC week key for a session date — groups the history by week (Cadence). */
function weekOf(sessionDate: string): string {
  return weekStartStr(currentWeekStartUtc(new Date(`${sessionDate}T00:00:00Z`)));
}

export function NotesPanel({
  sessions,
  loading,
  managerId,
  onSave,
  onToggleActionItem,
  onDirtyChange,
}: NotesPanelProps) {
  const today = new Date().toISOString().split('T')[0];
  const minDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [sessionDate, setSessionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [noteContent, setNoteContent] = useState('');
  const [actionItems, setActionItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [historyToggleError, setHistoryToggleError] = useState<string | null>(null);

  // A draft exists once any field the save would persist has content; the
  // date field alone is not a draft. Guards both loss paths (REVIEW.md 2.1):
  // person-switch (via onDirtyChange → the roster confirm) and tab close
  // (via beforeunload below).
  const dirty = noteContent.trim() !== '' || actionItems.length > 0 || newItem.trim() !== '';

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // Unmounting destroys the draft with the panel — report clean so a stale
  // dirty flag can't keep confirming switches that no longer lose anything.
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy Chrome requirement — without returnValue the prompt is skipped.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // Sessions arrive newest-first; group into weeks in that order (presentation
  // only — no schema change).
  const weekGroups = useMemo(() => {
    const groups: Array<{ week: string; sessions: ScorecardSessionWithDetails[] }> = [];
    for (const session of sessions) {
      const week = weekOf(session.session_date);
      const last = groups[groups.length - 1];
      if (last && last.week === week) {
        last.sessions.push(session);
      } else {
        groups.push({ week, sessions: [session] });
      }
    }
    return groups;
  }, [sessions]);

  const handleAddItem = () => {
    if (!newItem.trim()) return;
    setActionItems(prev => [...prev, newItem.trim()]);
    setNewItem('');
  };

  const handleRemoveItem = (index: number) => {
    setActionItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleHistoryToggle = async (itemId: string, isCompleted: boolean) => {
    setHistoryToggleError(null);
    const result = await onToggleActionItem(itemId, isCompleted);
    // Optimistic toggle: a failed write is already undone on screen — say so.
    if (!result.ok) {
      setHistoryToggleError(ACTION_TOGGLE_FAILED_COPY);
    }
  };

  const handleSave = async () => {
    if (!noteContent.trim() && actionItems.length === 0) return;
    setSaving(true);
    setSaveError(null);
    const result = await onSave(managerId, sessionDate, noteContent, actionItems);
    if (!result.ok) {
      setSaveError(result.error ?? 'Failed to save session');
    } else {
      setNoteContent('');
      setActionItems([]);
      setNewItem('');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
    setSaving(false);
  };

  if (loading) return <NotesSkeleton />;

  return (
    <div className="space-y-7">
      <div className="space-y-4">
        <div>
          <label htmlFor="session-date" className={fieldLabel}>
            Session Date
          </label>
          <input
            id="session-date"
            type="date"
            value={sessionDate}
            min={minDate}
            max={today}
            onChange={e => setSessionDate(e.target.value)}
            className={fieldInput}
          />
        </div>

        <div>
          <label htmlFor="session-notes" className={fieldLabel}>
            Notes
          </label>
          <textarea
            id="session-notes"
            value={noteContent}
            onChange={e => setNoteContent(e.target.value)}
            rows={4}
            placeholder="What do you want to cover in this 1:1?"
            className={`${fieldInput} w-full`}
          />
        </div>

        <div>
          <p className={fieldLabel}>Action Items</p>
          <div className="space-y-2">
            {actionItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex-1 text-base text-hr-navy bg-hr-bg px-3 py-1.5 rounded-lg">
                  {item}
                </span>
                <button
                  onClick={() => handleRemoveItem(i)}
                  className="text-hr-gray-mid hover:text-hr-navy p-1 rounded transition-colors"
                  aria-label={`Remove action item: ${item}`}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newItem}
                onChange={e => setNewItem(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddItem();
                  }
                }}
                placeholder="Add an action item..."
                aria-label="New action item"
                className={`${fieldInput} flex-1`}
              />
              <button
                onClick={handleAddItem}
                disabled={!newItem.trim()}
                className="px-3 py-2 text-base rounded-lg border border-hr-teal/30 text-hr-teal-deep hover:bg-hr-teal-tint transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {saveSuccess && <p className="text-hr-teal-deep text-sm">Session saved</p>}

        {saveError && <WarnBanner>{saveError}</WarnBanner>}

        <button
          onClick={handleSave}
          disabled={saving || (!noteContent.trim() && actionItems.length === 0)}
          className={`px-4 py-2 rounded-lg text-base font-medium transition-colors ${
            !saving && (noteContent.trim() || actionItems.length > 0)
              ? 'bg-hr-teal text-white hover:bg-hr-teal/90'
              : 'bg-hr-line text-hr-gray-mid cursor-not-allowed'
          }`}
        >
          {saving ? 'Saving...' : 'Save Session'}
        </button>
      </div>

      {weekGroups.length === 0 ? (
        <p className="text-base text-hr-gray">
          No 1:1 sessions in the last 12 weeks — save your first note above.
        </p>
      ) : (
        <div className="space-y-4">
          {historyToggleError && <WarnBanner>{historyToggleError}</WarnBanner>}
          {weekGroups.map(group => (
            <div key={group.week}>
              <p className="text-xs font-semibold uppercase tracking-[0.07em] text-hr-gray-mid mb-2">
                Week of {format(parseISO(group.week), 'MMM d')}
              </p>
              <div className="space-y-2.5">
                {group.sessions.map(session => (
                  <div key={session.id} className="bg-hr-bg rounded-xl p-4 space-y-2.5">
                    <p className="text-sm font-medium text-hr-navy">
                      {format(parseISO(session.session_date), 'EEEE, MMMM d')}
                    </p>

                    {session.notes.map(note => (
                      <p key={note.id} className="text-base text-hr-gray whitespace-pre-wrap">
                        {note.content}
                      </p>
                    ))}

                    {session.action_items.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold uppercase tracking-[0.07em] text-hr-gray-mid">
                          Action Items
                        </p>
                        {session.action_items.map(item => (
                          <label key={item.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.is_completed}
                              onChange={e => handleHistoryToggle(item.id, e.target.checked)}
                              className="rounded border-hr-line text-hr-teal focus:ring-hr-teal/20"
                            />
                            <span
                              className={`text-base ${
                                item.is_completed ? 'line-through text-hr-gray-mid' : 'text-hr-navy'
                              }`}
                            >
                              {item.content}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
