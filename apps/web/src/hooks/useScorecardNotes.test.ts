// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';

// Thenable query-builder stub: every builder method returns the chain, and
// awaiting the chain pops the next queued result for that table — enough to
// drive fetch + update flows without modelling PostgREST.
const mocks = vi.hoisted(() => {
  type MockResult = { data?: unknown; error: { message: string } | null };
  const tableResults = new Map<string, MockResult[]>();

  function queueResult(table: string, result: MockResult) {
    const list = tableResults.get(table) ?? [];
    list.push(result);
    tableResults.set(table, list);
  }

  function makeChain(table: string): unknown {
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'insert', 'update', 'eq', 'gte', 'order', 'single']) {
      chain[method] = () => chain;
    }
    chain['then'] = (resolve: (r: MockResult) => void) => {
      resolve(tableResults.get(table)?.shift() ?? { data: null, error: null });
    };
    return chain;
  }

  return { tableResults, queueResult, makeChain };
});

vi.mock('../lib/supabase', () => ({
  supabase: { from: (table: string) => mocks.makeChain(table) },
}));

import { useScorecardNotes } from './useScorecardNotes';

const SESSION_ROW = {
  id: 's1',
  employee_id: 'e1',
  manager_id: 'm1',
  session_date: '2026-07-06',
  created_at: '2026-07-06',
  updated_at: '2026-07-06',
  session_notes: [],
  session_action_items: [
    {
      id: 'ai1',
      session_id: 's1',
      content: 'Shadow a senior agent on two calls',
      is_completed: false,
      created_by: 'm1',
      created_at: '2026-07-06',
      updated_at: '2026-07-06',
    },
  ],
};

function itemCompleted(result: { current: ReturnType<typeof useScorecardNotes> }): boolean {
  return result.current.sessions[0]!.action_items[0]!.is_completed;
}

beforeEach(() => {
  mocks.tableResults.clear();
});

afterEach(cleanup);

describe('useScorecardNotes toggleActionItem (optimistic)', () => {
  it('flips the item before the write resolves and keeps it on success', async () => {
    mocks.queueResult('scorecard_sessions', { data: [SESSION_ROW], error: null });
    const { result } = renderHook(() => useScorecardNotes('e1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(itemCompleted(result)).toBe(false);

    mocks.queueResult('session_action_items', { error: null });
    let pending!: Promise<{ ok: boolean; error?: string }>;
    act(() => {
      pending = result.current.toggleActionItem('ai1', true);
    });
    // The write has not resolved yet — the checkbox must already read checked.
    expect(itemCompleted(result)).toBe(true);

    let outcome: { ok: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await pending;
    });
    expect(outcome).toEqual({ ok: true });
    expect(itemCompleted(result)).toBe(true);
  });

  it('rolls the item back and returns the error when the write fails', async () => {
    mocks.queueResult('scorecard_sessions', { data: [SESSION_ROW], error: null });
    const { result } = renderHook(() => useScorecardNotes('e1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    mocks.queueResult('session_action_items', { error: { message: 'network down' } });
    let pending!: Promise<{ ok: boolean; error?: string }>;
    act(() => {
      pending = result.current.toggleActionItem('ai1', true);
    });
    expect(itemCompleted(result)).toBe(true); // optimistic flip

    let outcome: { ok: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await pending;
    });
    expect(outcome).toEqual({ ok: false, error: 'network down' });
    expect(itemCompleted(result)).toBe(false); // rolled back
  });
});
