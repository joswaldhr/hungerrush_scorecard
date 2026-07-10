import { useEffect, useMemo, useState } from 'react';
import { useBlocker } from 'react-router-dom';
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
}

function NotesSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden="true">
      <div className="h-6 bg-white/10 rounded w-1/4" />
      <div className="h-24 bg-white/10 rounded" />
      <div className="h-10 bg-white/10 rounded w-1/3" />
    </div>
  );
}

const fieldLabel = 'text-[12px] font-semibold uppercase tracking-[0.07em] text-[#5E6980] mb-1.5 block';
const fieldInput =
  'rounded-[10px] bg-white/5 border-white/10 text-[14px] text-[#F2F5FA] placeholder:text-[#5E6980] focus:ring-[#2BD9BC]/20 focus:border-[#2BD9BC]/40';

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

  const dirty = noteContent.trim() !== '' || actionItems.length > 0 || newItem.trim() !== '';

  const blocker = useBlocker(dirty);

  useEffect(() => {
    if (blocker.state === 'blocked') {
      const confirmLeave = window.confirm('You have unsaved notes. Are you sure you want to leave?');
      if (confirmLeave) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker]);


  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

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
            style={{ colorScheme: 'dark' }}
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
                <span className="flex-1 text-[14px] text-[#F2F5FA] bg-white/5 border border-white/10 px-3 py-1.5 rounded-[10px]">
                  {item}
                </span>
                <button
                  onClick={() => handleRemoveItem(i)}
                  className="text-[#5E6980] hover:text-[#F2F5FA] p-1 rounded transition-colors"
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
                className="px-3 py-2 text-[14px] rounded-[10px] border border-[#2BD9BC]/30 text-[#2BD9BC] hover:bg-[#2BD9BC]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {saveSuccess && <p className="text-[#2BD9BC] text-[13px]">Session saved</p>}

        {saveError && <WarnBanner>{saveError}</WarnBanner>}

        <button
          onClick={handleSave}
          disabled={saving || (!noteContent.trim() && actionItems.length === 0)}
          className={`px-4 py-2.5 rounded-[10px] text-[14px] font-semibold transition-colors ${
            !saving && (noteContent.trim() || actionItems.length > 0)
              ? 'bg-[#2BD9BC] text-[#101624] hover:bg-[#2BD9BC]/90'
              : 'bg-white/10 text-[#5E6980] cursor-not-allowed'
          }`}
        >
          {saving ? 'Saving...' : 'Save Session'}
        </button>
      </div>

      {weekGroups.length === 0 ? (
        <p className="text-[14px] text-[#98A2B8]">
          No 1:1 sessions in the last 12 weeks — save your first note above.
        </p>
      ) : (
        <div className="space-y-4">
          {historyToggleError && <WarnBanner>{historyToggleError}</WarnBanner>}
          {weekGroups.map(group => (
            <div key={group.week}>
              <p className="text-[12px] font-semibold uppercase tracking-[0.07em] text-[#5E6980] mb-2">
                Week of {format(parseISO(group.week), 'MMM d')}
              </p>
              <div className="space-y-2.5">
                {group.sessions.map(session => (
                  <div key={session.id} className="bg-white/5 border border-white/10 rounded-[12px] p-4 space-y-2.5">
                    <p className="text-[14px] font-medium text-[#F2F5FA]">
                      {format(parseISO(session.session_date), 'EEEE, MMMM d')}
                    </p>

                    {session.notes.map(note => (
                      <p key={note.id} className="text-[14px] text-[#98A2B8] whitespace-pre-wrap">
                        {note.content}
                      </p>
                    ))}

                    {session.action_items.length > 0 && (
                      <div className="space-y-1.5 pt-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#5E6980]">
                          Action Items
                        </p>
                        {session.action_items.map(item => (
                          <label key={item.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.is_completed}
                              onChange={e => handleHistoryToggle(item.id, e.target.checked)}
                              className="rounded border-white/20 bg-white/5 text-[#2BD9BC] focus:ring-[#2BD9BC]/20"
                            />
                            <span
                              className={`text-[14px] ${
                                item.is_completed ? 'line-through text-[#5E6980]' : 'text-[#F2F5FA]'
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
