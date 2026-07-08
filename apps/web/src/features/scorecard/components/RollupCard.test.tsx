// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { MetricDefinition, Profile } from '@scorecard/shared';
import { RollupCard } from './RollupCard';
import type { ManagerRollupRow } from '../../../lib/rollup';

afterEach(cleanup);

function manager(id: string, name: string): Profile {
  return {
    id,
    email: `${id}@hungerrush.com`,
    full_name: name,
    role: 'manager',
    manager_id: null,
    zendesk_agent_id: null,
    assembled_agent_id: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };
}

function def(key: string): MetricDefinition {
  return {
    id: `id-${key}`,
    key,
    name: key,
    unit: 'percent',
    source: 'zendesk',
    coaching_prompt: 'prompt',
    direction: 'higher_is_better',
    is_active: true,
    display_order: 1,
    created_at: '2026-01-01',
  };
}

const ROW: ManagerRollupRow = {
  manager: manager('m1', 'Alex Smith'),
  employeeCount: 4,
  inactiveCount: 0,
  tones: {
    csat_score: { win: 2, discuss: 1, steady: 1, new: 0, total: 4 },
    occupancy: { win: 0, discuss: 0, steady: 3, new: 1, total: 4 },
  },
  wins: 2,
  toDiscuss: 1,
};

describe('RollupCard', () => {
  it('renders manager identity, tone chips, and the flag-count stat pair', () => {
    render(<RollupCard row={ROW} definitions={[def('csat_score'), def('occupancy')]} onOpen={() => {}} />);
    expect(screen.getByText('Alex Smith')).toBeTruthy();
    expect(screen.getByText('m1@hungerrush.com')).toBeTruthy();
    expect(screen.getByText('4 reports')).toBeTruthy();
    // Full breakdown lives in the tooltip/accessible name.
    expect(screen.getByTitle('CSAT: 2 improving, 1 to discuss, 1 steady of 4 reports')).toBeTruthy();
    // Band metric with everyone in range reads steady, never a 0-win fraction.
    expect(screen.getByTitle('Occupancy: 3 steady, 1 building history of 4 reports')).toBeTruthy();
    expect(screen.getByText('wins')).toBeTruthy();
    expect(screen.getByText('to discuss')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: "View Alex Smith's team — 2 wins, 1 to discuss" }),
    ).toBeTruthy();
  });

  it('clicking the card opens the drill-down', () => {
    const onOpen = vi.fn();
    render(<RollupCard row={ROW} definitions={[def('csat_score')]} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('shows the no-trend-data message when no metric has points', () => {
    const empty: ManagerRollupRow = {
      manager: manager('m2', 'Blake Jones'),
      employeeCount: 2,
      inactiveCount: 0,
      tones: {},
      wins: 0,
      toDiscuss: 0,
    };
    render(<RollupCard row={empty} definitions={[def('csat_score')]} onOpen={() => {}} />);
    expect(screen.getByText(/No trend data yet/)).toBeTruthy();
  });

  it('shows the no-longer-synced count when a report has left the directory', () => {
    render(
      <RollupCard
        row={{ ...ROW, inactiveCount: 1 }}
        definitions={[def('csat_score')]}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText(/1 no longer synced/)).toBeTruthy();
  });
});
