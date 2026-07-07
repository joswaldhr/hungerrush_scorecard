import { useState, useEffect, useCallback } from 'react';
import { subWeeks, format } from 'date-fns';
import { supabase } from '../lib/supabase';
import type {
  ScorecardSession,
  SessionNote,
  SessionActionItem,
} from '@scorecard/shared';

export interface ScorecardSessionWithDetails extends ScorecardSession {
  notes: SessionNote[];
  action_items: SessionActionItem[];
}

/**
 * The ONE session window (weeks): notes history, briefing action-item
 * carry-over, and the roster chip's "last 1:1" all read it — two windows
 * here would let the chip advertise a session the briefing can't see.
 */
export const SESSION_LOOKBACK_WEEKS = 12;

export function useScorecardNotes(employeeId: string) {
  const [sessions, setSessions] = useState<ScorecardSessionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setError(null);
    // Wider than the old 4-week notes list: open action items from past
    // sessions carry into the briefing (Cadence).
    const windowStart = format(subWeeks(new Date(), SESSION_LOOKBACK_WEEKS), 'yyyy-MM-dd');

    const { data, error: err } = await supabase
      .from('scorecard_sessions')
      .select('*, session_notes(*), session_action_items(*)')
      .eq('employee_id', employeeId)
      .gte('session_date', windowStart)
      .order('session_date', { ascending: false });

    if (err) {
      setError(err.message);
    } else {
      const typed = (data ?? []).map((row: Record<string, unknown>) => ({
        ...(row as unknown as ScorecardSession),
        notes: (row.session_notes ?? []) as SessionNote[],
        action_items: (row.session_action_items ?? []) as SessionActionItem[],
      }));
      setSessions(typed);
    }
    setLoading(false);
  }, [employeeId]);

  useEffect(() => {
    // New employeeId: drop the previous employee's sessions (see useEmployee).
    setSessions([]);
    setLoading(true);
    fetchSessions();
  }, [fetchSessions]);

  const createSession = useCallback(
    async (
      managerId: string,
      sessionDate: string,
      noteContent: string,
      actionItems: string[],
    ): Promise<{ ok: boolean; error?: string }> => {
      const { data: session, error: sessionErr } = await supabase
        .from('scorecard_sessions')
        .insert({ employee_id: employeeId, manager_id: managerId, session_date: sessionDate })
        .select()
        .single();

      if (sessionErr || !session) {
        return { ok: false, error: sessionErr?.message ?? 'Failed to create session' };
      }

      const sessionId = (session as ScorecardSession).id;

      if (noteContent.trim()) {
        const { error: noteErr } = await supabase
          .from('session_notes')
          .insert({ session_id: sessionId, content: noteContent, created_by: managerId });

        if (noteErr) return { ok: false, error: noteErr.message };
      }

      const itemsToInsert = actionItems
        .filter(item => item.trim())
        .map(item => ({
          session_id: sessionId,
          content: item,
          created_by: managerId,
        }));

      if (itemsToInsert.length > 0) {
        const { error: itemsErr } = await supabase
          .from('session_action_items')
          .insert(itemsToInsert);

        if (itemsErr) return { ok: false, error: itemsErr.message };
      }

      await fetchSessions();
      return { ok: true };
    },
    [employeeId, fetchSessions],
  );

  const toggleActionItem = useCallback(
    async (itemId: string, isCompleted: boolean): Promise<{ ok: boolean; error?: string }> => {
      const { error: err } = await supabase
        .from('session_action_items')
        .update({ is_completed: isCompleted, updated_at: new Date().toISOString() })
        .eq('id', itemId);

      if (err) return { ok: false, error: err.message };

      setSessions(prev =>
        prev.map(s => ({
          ...s,
          action_items: s.action_items.map(ai =>
            ai.id === itemId ? { ...ai, is_completed: isCompleted } : ai,
          ),
        })),
      );

      return { ok: true };
    },
    [],
  );

  return { sessions, loading, error, refetch: fetchSessions, createSession, toggleActionItem };
}
