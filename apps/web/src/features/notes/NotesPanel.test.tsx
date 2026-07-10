// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { Link, RouterProvider, createMemoryRouter } from 'react-router-dom';
import {
  ACTION_TOGGLE_FAILED_COPY,
  type ScorecardSessionWithDetails,
} from '../../hooks/useScorecardNotes';
import { NotesPanel } from './NotesPanel';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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

/**
 * Two-route harness: NotesPanel needs a data router for useBlocker, and the
 * "Leave page" link exercises exactly the navigation the blocker guards
 * (person switches, sidebar, palette — all route changes look like this).
 */
function renderPanel(
  sessions: ScorecardSessionWithDetails[],
  loading = false,
  onSave: (
    managerId: string,
    sessionDate: string,
    noteContent: string,
    actionItems: string[],
  ) => Promise<{ ok: boolean; error?: string }> = async () => ({ ok: true }),
  onToggleActionItem: (
    itemId: string,
    isCompleted: boolean,
  ) => Promise<{ ok: boolean; error?: string }> = async () => ({ ok: true }),
) {
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <div>
          <NotesPanel
            sessions={sessions}
            loading={loading}
            managerId="m1"
            onSave={onSave}
            onToggleActionItem={onToggleActionItem}
          />
          <Link to="/away">Leave page</Link>
        </div>
      ),
    },
    { path: '/away', element: <p>away page</p> },
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
    renderPanel([]);
    const cleanClose = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleanClose);
    expect(cleanClose.defaultPrevented).toBe(false);

    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'half-typed draft' } });
    const dirtyClose = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirtyClose);
    expect(dirtyClose.defaultPrevented).toBe(true);

    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: '' } });
    const cleanAgain = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleanAgain);
    expect(cleanAgain.defaultPrevented).toBe(false);
  });

  it('never blocks navigation while the panel is clean', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPanel([]);
    fireEvent.click(screen.getByRole('link', { name: 'Leave page' }));
    expect(await screen.findByText('away page')).toBeTruthy();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('blocks navigation away from a draft and stays on cancel', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPanel([]);
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'half-typed draft' } });
    fireEvent.click(screen.getByRole('link', { name: 'Leave page' }));
    await waitFor(() =>
      expect(confirmSpy).toHaveBeenCalledWith(expect.stringMatching(/unsaved notes/)),
    );
    // Cancel keeps the manager on the page with the draft intact.
    expect((screen.getByLabelText('Notes') as HTMLTextAreaElement).value).toBe('half-typed draft');
    expect(screen.queryByText('away page')).toBeNull();
  });

  it('proceeds with navigation when the manager confirms the discard', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPanel([]);
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'half-typed draft' } });
    fireEvent.click(screen.getByRole('link', { name: 'Leave page' }));
    expect(await screen.findByText('away page')).toBeTruthy();
  });

  it('a pending action item counts as a draft — navigation prompts', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPanel([]);
    fireEvent.change(screen.getByLabelText('New action item'), { target: { value: 'Pair up' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('link', { name: 'Leave page' }));
    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
    expect(screen.queryByText('away page')).toBeNull();
  });

  it('a successful save clears the draft — navigating afterwards never prompts', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPanel([]);
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'First 1:1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Session' }));
    await screen.findByText('Session saved');

    fireEvent.click(screen.getByRole('link', { name: 'Leave page' }));
    expect(await screen.findByText('away page')).toBeTruthy();
    expect(confirmSpy).not.toHaveBeenCalled();
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
    renderPanel([withItem], false, undefined, async () => ({ ok: false, error: 'network down' }));
    fireEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(screen.getByText(ACTION_TOGGLE_FAILED_COPY)).toBeTruthy());
  });

  it('keeps Save disabled until there is content, then saves', async () => {
    const onSave = vi.fn(async () => ({ ok: true }));
    renderPanel([], false, onSave);
    const save = screen.getByRole('button', { name: 'Save Session' });
    expect((save as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'First 1:1' } });
    expect((save as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(save);
    expect(await screen.findByText('Session saved')).toBeTruthy();
    expect(onSave).toHaveBeenCalledWith('m1', expect.any(String), 'First 1:1', []);
  });
});
