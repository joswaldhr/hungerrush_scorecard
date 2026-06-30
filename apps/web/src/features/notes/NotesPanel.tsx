import { useState } from 'react';
import { format, parseISO } from 'date-fns';
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
      <div className="h-6 bg-slate-200 rounded w-1/4" />
      <div className="h-24 bg-slate-200 rounded" />
      <div className="h-10 bg-slate-200 rounded w-1/3" />
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
    }
    setSaving(false);
  };

  if (loading) return <NotesSkeleton />;

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-bold text-slate-800">New 1:1 Session</h3>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Session Date</label>
          <input
            type="date"
            value={sessionDate}
            onChange={e => setSessionDate(e.target.value)}
            className="rounded-md border-slate-300 text-sm focus:border-hr-green focus:ring-hr-green"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea
            value={noteContent}
            onChange={e => setNoteContent(e.target.value)}
            rows={4}
            placeholder="What did you discuss? What's going well? Where are there opportunities to grow?"
            className="w-full rounded-md border-slate-300 text-sm focus:border-hr-green focus:ring-hr-green"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Action Items</label>
          <div className="space-y-2">
            {actionItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex-1 text-sm text-slate-700 bg-hr-gray px-3 py-1.5 rounded">
                  {item}
                </span>
                <button
                  onClick={() => handleRemoveItem(i)}
                  className="text-slate-400 hover:text-slate-600 text-sm px-2"
                  aria-label={`Remove action item: ${item}`}
                >
                  ×
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
                className="flex-1 rounded-md border-slate-300 text-sm focus:border-hr-green focus:ring-hr-green"
              />
              <button
                onClick={handleAddItem}
                disabled={!newItem.trim()}
                className="px-3 py-2 text-sm rounded-md border border-hr-green text-hr-green hover:bg-hr-green-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {saveError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-sm">
            {saveError}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving || (!noteContent.trim() && actionItems.length === 0)}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            !saving && (noteContent.trim() || actionItems.length > 0)
              ? 'bg-hr-green text-white hover:bg-hr-green-dark'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          {saving ? 'Saving…' : 'Save Session'}
        </button>
      </div>

      {sessions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-800">Previous Sessions</h3>
          {sessions.map(session => (
            <div key={session.id} className="bg-white rounded-lg p-5 space-y-3">
              <p className="text-sm font-medium text-slate-700">
                {format(parseISO(session.session_date), 'MMMM d, yyyy')}
              </p>

              {session.notes.map(note => (
                <p key={note.id} className="text-sm text-slate-600 whitespace-pre-wrap">
                  {note.content}
                </p>
              ))}

              {session.action_items.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Action Items
                  </p>
                  {session.action_items.map(item => (
                    <label key={item.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.is_completed}
                        onChange={e => onToggleActionItem(item.id, e.target.checked)}
                        className="rounded border-slate-300 text-hr-green focus:ring-hr-green"
                      />
                      <span
                        className={`text-sm ${
                          item.is_completed ? 'line-through text-slate-400' : 'text-slate-700'
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
