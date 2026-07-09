// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';

// Result shape the thenable chain resolves with; _resolverKey lets the race
// test hand specific queued results a manually-resolved promise.
type MockResult = {
  data?: unknown;
  error: { message: string } | null;
  _resolverKey?: string;
};

const mocks = vi.hoisted(() => {
  type HoistedResult = {
    data?: unknown;
    error: { message: string } | null;
    _resolverKey?: string;
  };
  const tableResults = new Map<string, HoistedResult[]>();

  function queueResult(table: string, result: HoistedResult) {
    const list = tableResults.get(table) ?? [];
    list.push(result);
    tableResults.set(table, list);
  }

  function makeChain(table: string): unknown {
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'insert', 'update', 'eq', 'gte', 'order', 'single']) {
      chain[method] = () => chain;
    }
    chain['then'] = (resolve: (r: HoistedResult) => void) => {
      resolve(tableResults.get(table)?.shift() ?? { data: null, error: null });
    };
    return chain;
  }

  return { tableResults, queueResult, makeChain };
});

vi.mock('../lib/supabase', () => ({
  supabase: { from: (table: string) => mocks.makeChain(table) },
}));

import { useEmployeeMetrics } from './useEmployeeMetrics';

const DEF_ROW = {
  key: 'ticket_volume',
  name: 'Ticket Volume',
  description: 'Tickets',
  unit: 'count',
  is_active: true,
  display_order: 1,
  coaching_prompt: 'Test prompt',
  created_at: '2026-07-06',
  updated_at: '2026-07-06'
};

const SNAPSHOT_ROW = {
  id: 1,
  employee_id: 'e1',
  metric_key: 'ticket_volume',
  period_start: '2026-07-06',
  period_end: '2026-07-12',
  value: 42,
  synced_at: '2026-07-06T12:00:00Z',
  created_at: '2026-07-06T12:00:00Z'
};

beforeEach(() => {
  mocks.tableResults.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useEmployeeMetrics', () => {
  it('loads metrics successfully', async () => {
    // We expect two queries: snapshots then definitions (from Promise.all)
    mocks.queueResult('metric_snapshots', { data: [SNAPSHOT_ROW], error: null });
    mocks.queueResult('metric_definitions', { data: [DEF_ROW], error: null });

    const { result } = renderHook(() => useEmployeeMetrics('e1'));

    // Initially loading
    expect(result.current.loading).toBe(true);
    expect(result.current.metrics).toEqual([]);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe(null);
    expect(result.current.metrics.length).toBe(1);
    expect(result.current.metrics[0]?.definition.name).toBe('Ticket Volume');
  });

  it('handles errors from supabase', async () => {
    mocks.queueResult('metric_snapshots', { error: { message: 'DB down' } });
    mocks.queueResult('metric_definitions', { data: [DEF_ROW], error: null });

    const { result } = renderHook(() => useEmployeeMetrics('e1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('DB down');
    expect(result.current.metrics).toEqual([]);
  });

  it('prevents race conditions when switching employees rapidly', async () => {
    let snapshotResolver1!: (value: unknown) => void;
    let defResolver1!: (value: unknown) => void;
    let snapshotResolver2!: (value: unknown) => void;
    let defResolver2!: (value: unknown) => void;

    // First hook render calls
    const p1a = new Promise((resolve) => { snapshotResolver1 = resolve; });
    const p1b = new Promise((resolve) => { defResolver1 = resolve; });
    // Second hook render calls
    const p2a = new Promise((resolve) => { snapshotResolver2 = resolve; });
    const p2b = new Promise((resolve) => { defResolver2 = resolve; });

    // Mock the chain explicitly to hang until each keyed promise resolves
    vi.spyOn(mocks, 'makeChain').mockImplementation((table) => {
      const chain: Record<string, unknown> = {};
      for (const method of ['select', 'insert', 'update', 'eq', 'gte', 'order', 'single']) {
        chain[method] = () => chain;
      }
      chain['then'] = (resolve: (r: MockResult) => void) => {
        const next = mocks.tableResults.get(table)?.shift();
        if (next?._resolverKey === '1a') p1a.then(() => resolve({ data: [SNAPSHOT_ROW], error: null }));
        else if (next?._resolverKey === '1b') p1b.then(() => resolve({ data: [DEF_ROW], error: null }));
        else if (next?._resolverKey === '2a') p2a.then(() => resolve({ data: [], error: null }));
        else if (next?._resolverKey === '2b') p2b.then(() => resolve({ data: [DEF_ROW], error: null }));
        else resolve({ data: null, error: null });
      };
      return chain;
    });

    mocks.queueResult('metric_snapshots', { error: null, _resolverKey: '1a' });
    mocks.queueResult('metric_definitions', { error: null, _resolverKey: '1b' });

    const { result, rerender } = renderHook(({ id }) => useEmployeeMetrics(id), { initialProps: { id: 'e1' } });

    mocks.queueResult('metric_snapshots', { error: null, _resolverKey: '2a' });
    mocks.queueResult('metric_definitions', { error: null, _resolverKey: '2b' });

    rerender({ id: 'e2' });

    // Resolve second request first!
    act(() => {
      snapshotResolver2(true);
      defResolver2(true);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.metrics.length).toBe(1); // 1 definition
    expect(result.current.metrics[0]?.currentValue).toBe(null); // e2 has no snapshots

    // Now resolve first request
    act(() => {
      snapshotResolver1(true);
      defResolver1(true);
    });

    // We wait a tick to ensure no state updates happen
    await new Promise(r => setTimeout(r, 10));

    // e1's data must NOT overwrite e2's data
    expect(result.current.metrics[0]?.currentValue).toBe(null);
  });
});
