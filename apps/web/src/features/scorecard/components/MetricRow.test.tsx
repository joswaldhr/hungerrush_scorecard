// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { MetricDefinition } from '@scorecard/shared';
import { buildEvidenceMetrics } from '../../../lib/evidence';
import { MetricRow } from './MetricRow';

afterEach(cleanup);

const DEF: MetricDefinition = {
  id: 'id-csat',
  key: 'csat_score',
  name: 'Customer Satisfaction',
  unit: 'percent',
  source: 'zendesk',
  coaching_prompt: 'What is driving positive customer feedback?',
  direction: 'higher_is_better',
  is_active: true,
  display_order: 1,
  created_at: '2026-01-01',
};

function evidenceRow(latestSyncedAt: string | null) {
  const [row] = buildEvidenceMetrics(
    [
      {
        definition: DEF,
        currentValue: 92,
        currentSyncedAt: latestSyncedAt,
        lastWeekValue: 90,
        history: [{ periodStart: '2026-07-06', value: 92 }],
        latestSyncedAt,
      },
    ],
    '2026-07-06',
  );
  return row!;
}

describe('MetricRow', () => {
  it('shows the per-row synced stamp only when showSyncedAt is set (shared-page rule)', () => {
    const row = evidenceRow(new Date().toISOString());
    render(<MetricRow metric={row} showSyncedAt />);
    expect(screen.getByText(/^Synced /)).toBeTruthy();
    cleanup();
    render(<MetricRow metric={row} />);
    expect(screen.queryByText(/^Synced /)).toBeNull();
  });

  it('renders both labeled windows and the DB coaching prompt', () => {
    render(<MetricRow metric={evidenceRow(null)} />);
    expect(screen.getByText('this wk')).toBeTruthy();
    expect(screen.getByText(/last wk/)).toBeTruthy();
    expect(screen.getByText('What is driving positive customer feedback?')).toBeTruthy();
  });
});
