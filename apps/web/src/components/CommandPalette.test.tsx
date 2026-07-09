// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { Employee } from '@scorecard/shared';
import type { RosterEntry } from '../hooks/useRoster';

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  role: { value: 'manager' },
  entries: [] as unknown[],
}));

vi.mock('../hooks/useRoster', () => ({
  useRoster: () => ({ entries: h.entries, loading: false, error: null }),
}));

vi.mock('../features/auth/AuthProvider', () => ({
  useAuth: () => ({ role: h.role.value }),
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => h.navigate,
}));

import { CommandPalette } from './CommandPalette';

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
  { employee: employee('e2', 'Dario Reyes'), summary: { tone: 'steady', label: 'steady' }, lastSessionDate: null, hasData: true },
];

beforeEach(() => {
  h.role.value = 'manager';
  h.entries.length = 0;
  h.entries.push(...ENTRIES);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CommandPalette', () => {
  it('renders nothing while closed and toggles via Ctrl+K', () => {
    const onOpenChange = vi.fn();
    const { container } = render(<CommandPalette open={false} onOpenChange={onOpenChange} />);
    expect(container.innerHTML).toBe('');

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
  });

  it('Ctrl+K closes an open palette; Esc in the input closes too', () => {
    const onOpenChange = vi.fn();
    render(<CommandPalette open onOpenChange={onOpenChange} />);

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);

    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('lists pages and people, and filters by the query', () => {
    render(<CommandPalette open onOpenChange={() => {}} />);
    expect(screen.getByRole('option', { name: /Your team/ })).toBeTruthy();
    expect(screen.queryByRole('option', { name: /Team rollup/ })).toBeNull(); // manager role
    expect(screen.getByRole('option', { name: /Maya Okafor/ })).toBeTruthy();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'dario' } });
    expect(screen.queryByRole('option', { name: /Maya Okafor/ })).toBeNull();
    expect(screen.getByRole('option', { name: /Dario Reyes/ })).toBeTruthy();
  });

  it('shows role-gated pages for an admin', () => {
    h.role.value = 'admin';
    render(<CommandPalette open onOpenChange={() => {}} />);
    expect(screen.getByRole('option', { name: /Team rollup/ })).toBeTruthy();
    expect(screen.getByRole('option', { name: /Metrics/ })).toBeTruthy();
    expect(screen.getByRole('option', { name: /Export log/ })).toBeTruthy();
  });

  it('arrows move the selection; Enter navigates and closes', () => {
    const onOpenChange = vi.fn();
    render(<CommandPalette open onOpenChange={onOpenChange} />);
    const input = screen.getByRole('combobox');

    // Items for a manager: [Your team, Maya, Dario] — ArrowDown lands on Maya.
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: /Maya Okafor/ }).getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(h.navigate).toHaveBeenCalledWith('/scorecard/e1');
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('clicking an option navigates', () => {
    const onOpenChange = vi.fn();
    render(<CommandPalette open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole('option', { name: /Dario Reyes/ }));
    expect(h.navigate).toHaveBeenCalledWith('/scorecard/e2');
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('shows the empty state with a suggestion when nothing matches', () => {
    render(<CommandPalette open onOpenChange={() => {}} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzzz' } });
    expect(screen.getByText(/No matches — try a different name/)).toBeTruthy();
  });
});
