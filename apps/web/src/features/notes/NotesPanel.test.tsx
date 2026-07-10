// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import {
  ACTION_TOGGLE_FAILED_COPY,
  type ScorecardSessionWithDetails,
} from '../../hooks/useScorecardNotes';
import { NotesPanel } from './NotesPanel';

afterEach(cleanup);

const SESSION: ScorecardSessionWithDetails = {
  id: 's1',
  employee_id: 'e1',
  manager_id: 'm1',
  session_date: '2026-07-01',
  created_at: '2026-07-01',
  updated_at: '2026-07-01',
  notes: [
    {
      id: 'n1',
      session_id: 's1',
      content: 'Talked through queue coverage.',
      created_by: 'm1',
      created_at: '2026-07-01',
      updated_at: '2026-07-01',
    },
  ],
  action_items: [],
};

function renderPanel(sessions: ScorecardSessionWithDetails[], loading = false) {
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <NotesPanel
          sessions={sessions}
          loading={loading}
          managerId="m1"
          onSave={async () => ({ ok: true })}
          onToggleActionItem={async () => ({ ok: true })}
        />
      ),
    },
  ]);
  return render(<RouterProvider router={router} />);
}

describe('NotesPanel', () => {
  it('shows a skeleton while loading', () => {
    const { container } = renderPanel([], true);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders week-grouped history and the note content', () => {
    renderPanel([SESSION]);
    expect(screen.getByText(/Week of Jun 29/)).toBeTruthy();
    expect(screen.getByText('Talked through queue coverage.')).toBeTruthy();
  });

  it('shows the empty history message with a suggested action', () => {
    renderPanel([]);
    expect(screen.getByText(/No 1:1 sessions in the last 12 weeks — save your first note/)).toBeTruthy();
  });

  it('guards tab close only while a draft exists', () => {
    const router = createMemoryRouter([
      {
        path: '/',
        element: (
          <NotesPanel
            sessions={[]}
            loading={false}
            managerId="m1"
            onSave={async () => ({ ok: true })}
            onToggleActionItem={async () => ({ ok: true })}
          />
        ),
      },
    ]);
    render(<RouterProvider router={router} />);

    const cleanClose = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleanClose);
    expect(cleanClose.defaultPrevented).toBe(false);

    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'half-typed draft' } });

    const dirtyClose = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirtyClose);
    expect(dirtyClose.defaultPrevented).toBe(true);

    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: '' } });
  });

  it('a pending action item counts as a draft', () => {
    const router = createMemoryRouter([
      {
        path: '/',
        element: (
          <NotesPanel
            sessions={[]}
            loading={false}
            managerId="m1"
            onSave={async () => ({ ok: true })}
            onToggleActionItem={async () => ({ ok: true })}
          />
        ),
      },
    ]);
    render(<RouterProvider router={router} />);
    fireEvent.change(screen.getByLabelText('New action item'), { target: { value: 'Pair up' } });
    
    const dirtyClose = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirtyClose);
    expect(dirtyClose.defaultPrevented).toBe(true);
    
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    
    const dirtyClose2 = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirtyClose2);
    expect(dirtyClose2.defaultPrevented).toBe(true);
  });

  it('clears draft status after a successful save and on unmount', async () => {
    const router = createMemoryRouter([
      {
        path: '/',
        element: (
          <NotesPanel
            sessions={[]}
            loading={false}
            managerId="m1"
            onSave={async () => ({ ok: true })}
            onToggleActionItem={async () => ({ ok: true })}
          />
        ),
      },
    ]);
    const { unmount } = render(<RouterProvider router={router} />);
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'First 1:1' } });
    
    let closeEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(closeEvent);
    expect(closeEvent.defaultPrevented).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Save Session' }));
    await screen.findByText('Session saved');
    
    closeEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(closeEvent);
    expect(closeEvent.defaultPrevented).toBe(false);

    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'next draft' } });
    unmount();
    
    closeEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(closeEvent);
    expect(closeEvent.defaultPrevented).toBe(false);
  });

  it('shows the undo copy when a history checkbox toggle fails', async () => {
    const withItem: ScorecardSessionWithDetails = {
      ...SESSION,
      action_items: [
        {
          id: 'ai1',
          session_id: 's1',
          content: 'Follow up on queue coverage',
          is_completed: false,
          created_by: 'm1',
          created_at: '2026-07-01',
          updated_at: '2026-07-01',
        },
      ],
    };
    const router = createMemoryRouter([
      {
        path: '/',
        element: (
          <NotesPanel
            sessions={[withItem]}
            loading={false}
            managerId="m1"
            onSave={async () => ({ ok: true })}
            onToggleActionItem={async () => ({ ok: false, error: 'network down' })}
          />
        ),
      },
    ]);
    render(<RouterProvider router={router} />);
    fireEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(screen.getByText(ACTION_TOGGLE_FAILED_COPY)).toBeTruthy());
  });

  it('keeps Save disabled until there is content, then saves', async () => {
    const onSave = vi.fn(async () => ({ ok: true }));
    const router = createMemoryRouter([
      {
        path: '/',
        element: (
          <NotesPanel
            sessions={[]}
            loading={false}
            managerId="m1"
            onSave={onSave}
            onToggleActionItem={async () => ({ ok: true })}
          />
        ),
      },
    ]);
    render(<RouterProvider router={router} />);
    const save = screen.getByRole('button', { name: 'Save Session' });
    expect((save as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'First 1:1' } });
    expect((save as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(save);
    expect(await screen.findByText('Session saved')).toBeTruthy();
    expect(onSave).toHaveBeenCalledWith('m1', expect.any(String), 'First 1:1', []);
  });
});
