// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';

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

import { useEmployee } from './useEmployee';

function employeeRow(id: string, name: string) {
  return {
    id,
    profile_id: null,
    full_name: name,
    email: `${id}@hungerrush.com`,
    manager_id: 'mgr-1',
    title: null,
    zendesk_agent_id: null,
    assembled_agent_id: null,
    is_active: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };
}

beforeEach(() => {
  mocks.tableResults.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useEmployee', () => {
  it('loads the employee', async () => {
    mocks.queueResult('employees', { data: employeeRow('e1', 'Maya Okafor'), error: null });
    const { result } = renderHook(() => useEmployee('e1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.employee?.full_name).toBe('Maya Okafor');
    expect(result.current.error).toBe(null);
  });

  it("drops the outgoing person's slow response after a switch", async () => {
    let resolver1!: (value: unknown) => void;
    let resolver2!: (value: unknown) => void;
    const p1 = new Promise((resolve) => { resolver1 = resolve; });
    const p2 = new Promise((resolve) => { resolver2 = resolve; });

    vi.spyOn(mocks, 'makeChain').mockImplementation((table) => {
      const chain: Record<string, unknown> = {};
      for (const method of ['select', 'insert', 'update', 'eq', 'gte', 'order', 'single']) {
        chain[method] = () => chain;
      }
      chain['then'] = (resolve: (r: MockResult) => void) => {
        const next = mocks.tableResults.get(table)?.shift();
        if (next?._resolverKey === '1') p1.then(() => resolve({ data: employeeRow('e1', 'Maya Okafor'), error: null }));
        else if (next?._resolverKey === '2') p2.then(() => resolve({ data: employeeRow('e2', 'Dario Reyes'), error: null }));
        else resolve({ data: null, error: null });
      };
      return chain;
    });

    mocks.queueResult('employees', { error: null, _resolverKey: '1' });
    const { result, rerender } = renderHook(({ id }) => useEmployee(id), { initialProps: { id: 'e1' } });

    mocks.queueResult('employees', { error: null, _resolverKey: '2' });
    rerender({ id: 'e2' });

    // e2 resolves first — the screen shows Dario.
    act(() => { resolver2(true); });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.employee?.full_name).toBe('Dario Reyes');

    // e1's slow response lands late — it must NOT put Maya back on screen.
    act(() => { resolver1(true); });
    await new Promise(r => setTimeout(r, 10));
    expect(result.current.employee?.full_name).toBe('Dario Reyes');
  });
});
