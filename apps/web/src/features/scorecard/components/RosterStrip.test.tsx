// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { Employee } from '@scorecard/shared';
import { RosterStrip } from './RosterStrip';
import type { RosterEntry } from '../../../hooks/useRoster';

afterEach(cleanup);

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
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };
}

const ENTRIES: RosterEntry[] = [
  {
    employee: employee('e1', 'Maya Okafor'),
    summary: { tone: 'win', label: 'on track' },
    lastSessionDate: null,
    hasData: true,
  },
  {
    employee: employee('e2', 'Dario Reyes'),
    summary: { tone: 'discuss', label: 'focus this week' },
    lastSessionDate: null,
    hasData: true,
  },
];

describe('RosterStrip', () => {
  it('renders a chip per entry with a coaching-safe accessible label', () => {
    render(<RosterStrip entries={ENTRIES} selectedId="e1" onSelect={() => {}} loading={false} />);
    expect(screen.getByText('Maya Okafor')).toBeTruthy();
    const maya = screen.getByRole('button', { name: /Maya Okafor, on track/ });
    expect(maya.getAttribute('aria-current')).toBe('true');
    const dario = screen.getByRole('button', { name: /Dario Reyes, focus this week/ });
    expect(dario.getAttribute('aria-current')).toBeNull();
  });

  it('clicking a chip selects that person', () => {
    const onSelect = vi.fn();
    render(<RosterStrip entries={ENTRIES} selectedId="e1" onSelect={onSelect} loading={false} />);
    fireEvent.click(screen.getByRole('button', { name: /Dario Reyes/ }));
    expect(onSelect).toHaveBeenCalledWith('e2');
  });

  it('shows skeleton chips while loading', () => {
    const { container } = render(<RosterStrip entries={[]} selectedId={null} onSelect={() => {}} loading />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
