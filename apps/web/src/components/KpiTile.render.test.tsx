// @vitest-environment jsdom
// Render tests for the shared-page tile (KpiTile.test.ts covers the badge
// logic; this covers the component contract from FRONTEND.md).
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { currentWeekStartUtc, weeksBeforeUtc, weekStartStr, type MetricDefinition } from '@scorecard/shared';
import { KpiTile, KpiTileSkeleton } from './KpiTile';

afterEach(cleanup);

function def(key: string, name: string, unit: string): MetricDefinition {
  return {
    id: `id-${key}`,
    key,
    name,
    unit,
    source: 'zendesk',
    coaching_prompt: `Prompt for ${name}`,
    direction: 'higher_is_better',
    is_active: true,
    display_order: 1,
    created_at: '2026-01-01',
  };
}

// Weeks derived from the same clock the component reads — deterministic by construction.
const wk = (n: number) => weekStartStr(weeksBeforeUtc(currentWeekStartUtc(), n));

describe('KpiTile', () => {
  it('renders name, value, and the DB coaching prompt', () => {
    render(
      <KpiTile
        definition={def('csat_score', 'Customer Satisfaction', 'percent')}
        value={95}
        syncedAt="2026-07-07T10:00:00Z"
        history={[{ periodStart: wk(1), value: 92 }, { periodStart: wk(0), value: 95 }]}
      />,
    );
    expect(screen.getByText('Customer Satisfaction')).toBeTruthy();
    expect(screen.getByText('95.0%')).toBeTruthy();
    expect(screen.getByText('Prompt for Customer Satisfaction')).toBeTruthy();
    expect(screen.getByText(/Synced /)).toBeTruthy();
  });

  it('null value shows the spec nullLabel, never a judgment', () => {
    render(
      <KpiTile
        definition={def('csat_score', 'Customer Satisfaction', 'percent')}
        value={null}
        syncedAt={null}
        history={[]}
      />,
    );
    expect(screen.getByText('No ratings yet')).toBeTruthy();
  });

  it('a partial current week does not put an attention arrow on a steady count metric', () => {
    render(
      <KpiTile
        definition={def('ticket_volume', 'Ticket Volume', 'count')}
        value={3}
        syncedAt={null}
        history={[
          { periodStart: wk(4), value: 40 },
          { periodStart: wk(3), value: 40 },
          { periodStart: wk(2), value: 38 },
          { periodStart: wk(1), value: 41 },
          { periodStart: wk(0), value: 3 }, // in-progress week
        ]}
      />,
    );
    expect(screen.getByText('3')).toBeTruthy(); // live value still shown
    expect(screen.queryByText('↓')).toBeNull(); // trend anchored to completed weeks
  });

  it('skeleton renders a pulse placeholder', () => {
    const { container } = render(<KpiTileSkeleton />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });
});
