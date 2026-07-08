// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Employee } from '@scorecard/shared';
import type { RosterEntry } from '../../hooks/useRoster';

// The page composes heavy neighbours — stub everything that isn't the roster
// selection / guard / keyboard behavior under test.
vi.mock('../../hooks/useRoster', () => ({
  useRoster: () => ({ entries: ENTRIES, loading: false, error: null }),
}));

vi.mock('./components/Briefing', () => ({
  Briefing: ({
    employeeId,
    onNotesDirtyChange,
  }: {
    employeeId: string;
    onNotesDirtyChange?: (dirty: boolean) => void;
  }) => (
    <div>
      <span data-testid="briefing-person">{employeeId}</span>
      <button onClick={() => onNotesDirtyChange?.(true)}>make-dirty</button>
      <textarea aria-label="fake note field" />
    </div>
  ),
}));

vi.mock('../onboarding/TourModal', () => ({
  TourModal: () => null,
  useTour: () => ({ showTour: false, closeTour: () => {} }),
}));

vi.mock('../../components/AppLayout', () => ({
  AppLayout: ({ children, title }: { children: React.ReactNode; title: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

import { ScorecardPage } from './ScorecardPage';

function employee(id: string, name: string): Employee {
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

const ENTRIES: RosterEntry[] = [
  { employee: employee('e1', 'Maya Okafor'), summary: { tone: 'win', label: 'on track' }, lastSessionDate: null, hasData: true },
  { employee: employee('e2', 'Dario Reyes'), summary: { tone: 'discuss', label: 'focus this week' }, lastSessionDate: null, hasData: true },
  { employee: employee('e3', 'Priya Nair'), summary: { tone: 'steady', label: 'steady' }, lastSessionDate: null, hasData: true },
];

function renderPage(initialPath = '/scorecard/e1') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/scorecard/:employeeId?" element={<ScorecardPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function briefingPerson(): string {
  return screen.getByTestId('briefing-person').textContent ?? '';
}

let confirmSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ScorecardPage unsaved-note guard', () => {
  it('switches people without confirmation when the note is clean', () => {
    renderPage();
    expect(briefingPerson()).toBe('e1');
    fireEvent.click(screen.getByRole('button', { name: /Dario Reyes/ }));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(briefingPerson()).toBe('e2');
  });

  it('confirms before a switch discards a draft, and stays on cancel', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'make-dirty' }));
    fireEvent.click(screen.getByRole('button', { name: /Dario Reyes/ }));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringMatching(/unsaved note/));
    expect(briefingPerson()).toBe('e1'); // cancel keeps the draft's person
  });

  it('switches and discards when the manager confirms', () => {
    confirmSpy.mockReturnValue(true);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'make-dirty' }));
    fireEvent.click(screen.getByRole('button', { name: /Dario Reyes/ }));
    expect(briefingPerson()).toBe('e2');
  });

  it('re-clicking the selected person never prompts', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'make-dirty' }));
    fireEvent.click(screen.getByRole('button', { name: /Maya Okafor/ }));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(briefingPerson()).toBe('e1');
  });
});

describe('ScorecardPage keyboard basics', () => {
  it("'/' focuses the roster search", () => {
    renderPage();
    const search = screen.getByLabelText('Search team members');
    fireEvent.keyDown(document.body, { key: '/' });
    expect(document.activeElement).toBe(search);
  });

  it("'/' while typing in a field does not steal focus", () => {
    renderPage();
    const note = screen.getByLabelText('fake note field');
    (note as HTMLTextAreaElement).focus();
    fireEvent.keyDown(note, { key: '/' });
    expect(document.activeElement).toBe(note);
  });

  it('arrow keys step through the roster and clamp at the ends', () => {
    renderPage();
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(briefingPerson()).toBe('e2');
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(briefingPerson()).toBe('e1');
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(briefingPerson()).toBe('e1'); // no wrap past the first person
  });

  it('arrow keys while typing never switch people', () => {
    renderPage();
    fireEvent.keyDown(screen.getByLabelText('fake note field'), { key: 'ArrowRight' });
    expect(briefingPerson()).toBe('e1');
  });

  it('an arrow-key switch goes through the unsaved-note confirm', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'make-dirty' }));
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringMatching(/unsaved note/));
    expect(briefingPerson()).toBe('e1'); // confirm mocked to cancel
  });

  it('Esc clears the search from the box itself and from anywhere else', () => {
    renderPage();
    const search = screen.getByLabelText('Search team members') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'maya' } });
    fireEvent.keyDown(search, { key: 'Escape' }); // the input's own handler
    expect(search.value).toBe('');
    fireEvent.change(search, { target: { value: 'dario' } });
    fireEvent.keyDown(document.body, { key: 'Escape' }); // the global listener
    expect(search.value).toBe('');
  });
});
