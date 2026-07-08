// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import {
  ACTION_TOGGLE_FAILED_COPY,
  type ScorecardSessionWithDetails,
} from '../../../hooks/useScorecardNotes';
import { ActionItemsList } from './ActionItemsList';

afterEach(cleanup);

function session(
  id: string,
  date: string,
  items: Array<{ id: string; content: string; done: boolean }>,
): ScorecardSessionWithDetails {
  return {
    id,
    employee_id: 'e1',
    manager_id: 'm1',
    session_date: date,
    created_at: date,
    updated_at: date,
    notes: [],
    action_items: items.map(i => ({
      id: i.id,
      session_id: id,
      content: i.content,
      is_completed: i.done,
      created_by: 'm1',
      created_at: date,
      updated_at: date,
    })),
  };
}

describe('ActionItemsList', () => {
  it('renders open items before completed ones, completed struck through', () => {
    render(
      <ActionItemsList
        sessions={[
          session('s1', '2026-07-01', [
            { id: 'a1', content: 'Review escalation SOP', done: true },
            { id: 'a2', content: 'Pair on five tickets', done: false },
          ]),
        ]}
        onToggle={async () => ({ ok: true })}
      />,
    );
    const labels = screen.getAllByRole('checkbox').map(cb => cb.parentElement?.textContent);
    expect(labels[0]).toBe('Pair on five tickets');
    expect(labels[1]).toBe('Review escalation SOP');
    expect(screen.getByText('Review escalation SOP').closest('label')?.className).toContain(
      'line-through',
    );
  });

  it('shows the empty state with a suggested action', () => {
    render(<ActionItemsList sessions={[]} onToggle={async () => ({ ok: true })} />);
    expect(screen.getByText(/No action items yet — add them/)).toBeTruthy();
  });

  it('toggling calls onToggle and surfaces a failed save with the undo copy', async () => {
    const onToggle = vi.fn(async () => ({ ok: false, error: 'Network hiccup' }));
    render(
      <ActionItemsList
        sessions={[session('s1', '2026-07-01', [{ id: 'a1', content: 'Do the thing', done: false }])]}
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledWith('a1', true);
    // The optimistic toggle already undid the change on screen — the banner
    // explains that instead of echoing the raw error.
    await waitFor(() => expect(screen.getByText(ACTION_TOGGLE_FAILED_COPY)).toBeTruthy());
  });
});
