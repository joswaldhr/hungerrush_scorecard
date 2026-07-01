import { useState } from 'react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { X } from 'lucide-react';
import type { ScorecardSessionWithDetails } from '../../hooks/useScorecardNotes';

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
    <div className="animate-pulse space-y-4">
      <div className="h-6 bg-hr-sand-md rounded w-1/4" />
      <div className="h-24 bg-hr-sand-md rounded" />
      <div className="h-10 bg-hr-sand-md rounded w-1/3" />
    </div>
  );
}

export function NotesPanel({
  sessions,
  loading,
  managerId,
  onSave,
  onToggleActionItem,
}: NotesPanelProps) {
  const [sessionDate, setSessionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [noteContent, setNoteContent] = useState('');
  const [actionItems, setActionItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleAddItem = () => {
    if (!newItem.trim()) return;
    setActionItems(prev => [...prev, newItem.trim()]);
    setNewItem('');
  };

  const handleRemoveItem = (index: number) => {
    setActionItems(prev => prev.filter((_, i) => i !== index));
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
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-[0.07em] text-hr-text-3 mb-1.5 block">
            Session Date
          </label>
          <input
            type="date"
            value={sessionDate}
            onChange={e => setSessionDate(e.target.value)}
            className="rounded-lg border-half border-hr-base text-sm text-hr-text-1 focus:ring-hr-green/20 focus:border-hr-green/40"
          />
        </div>

        <div>
          <label className="text-[10px] font-semibold uppercase tracking-[0.07em] text-hr-text-3 mb-1.5 block">
            Notes
          </label>
          <textarea
            value={noteContent}
            onChange={e => setNoteContent(e.target.value)}
            rows={4}
            placeholder="What do you want to cover in this 1:1?"
            className="w-full rounded-lg border-half border-hr-base text-sm text-hr-text-1 placeholder:text-hr-text-3 focus:ring-hr-green/20 focus:border-hr-green/40"
          />
        </div>

        <div>
          <label className="text-[10px] font-semibold uppercase tracking-[0.07em] text-hr-text-3 mb-1.5 block">
            Action Items
          </label>
          <div className="space-y-2">
            {actionItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex-1 text-sm text-hr-text-1 bg-hr-sand px-3 py-1.5 rounded-lg">
                  {item}
                </span>
                <button
                  onClick={() => handleRemoveItem(i)}
                  className="text-hr-text-3 hover:text-hr-text-1 p-1 rounded transition-colors"
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
                className="flex-1 rounded-lg border-half border-hr-base text-sm text-hr-text-1 placeholder:text-hr-text-3 focus:ring-hr-green/20 focus:border-hr-green/40"
              />
              <button
                onClick={handleAddItem}
                disabled={!newItem.trim()}
                className="px-3 py-2 text-sm rounded-lg border-half border-hr-green/30 text-hr-green hover:bg-hr-green-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {saveSuccess && (
          <p className="text-[#1D9E75] text-[12px]">Session saved</p>
        )}

        {saveError && (
          <div className="bg-hr-amber-light border-half border-hr-amber/20 text-hr-amber p-3 rounded-xl text-sm">
            {saveError}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving || (!noteContent.trim() && actionItems.length === 0)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            !saving && (noteContent.trim() || actionItems.length > 0)
              ? 'bg-hr-navy text-white hover:bg-hr-navy-deep'
              : 'bg-hr-sand-md text-hr-text-3 cursor-not-allowed'
          }`}
        >
          {saving ? 'Saving...' : 'Save Session'}
        </button>
      </div>

      {sessions.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-hr-text-3">Previous Sessions</p>
          {sessions.map(session => (
            <div key={session.id} className="bg-hr-sand rounded-xl p-5 space-y-3">
              <p className="text-sm font-medium text-hr-text-1" title={format(parseISO(session.session_date), 'MMMM d, yyyy')}>
                {formatDistanceToNow(parseISO(session.session_date), { addSuffix: true })}
              </p>

              {session.notes.map(note => (
                <p key={note.id} className="text-sm text-hr-text-2 whitespace-pre-wrap">
                  {note.content}
                </p>
              ))}

              {session.action_items.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-hr-text-3">
                    Action Items
                  </p>
                  {session.action_items.map(item => (
                    <label key={item.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.is_completed}
                        onChange={e => onToggleActionItem(item.id, e.target.checked)}
                        className="rounded border-hr-base text-hr-green focus:ring-hr-green/20"
                      />
                      <span
                        className={`text-sm ${
                          item.is_completed ? 'line-through text-hr-text-3' : 'text-hr-text-1'
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
      )}
    </div>
  );
}
