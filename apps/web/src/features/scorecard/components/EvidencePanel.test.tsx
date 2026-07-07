// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { MetricDefinition } from '@scorecard/shared';
import { EvidencePanel } from './EvidencePanel';
import { buildEvidenceMetrics, groupEvidenceBySource } from '../../../lib/evidence';
import type { EmployeeMetric } from '../../../lib/employeeMetrics';

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

function groupsFor(metric: EmployeeMetric, now: Date) {
  return groupEvidenceBySource(buildEvidenceMetrics([metric], '2026-07-06'), now);
}

const FRESH = new Date('2026-07-07T12:00:00Z');

const csat: EmployeeMetric = {
  definition: def('csat_score', 'Customer Satisfaction', 'percent'),
  currentValue: 95,
  currentSyncedAt: '2026-07-07T10:00:00Z',
  lastWeekValue: 92,
  history: [
    { periodStart: '2026-06-29', value: 92 },
    { periodStart: '2026-07-06', value: 95 },
  ],
  latestSyncedAt: '2026-07-07T10:00:00Z',
};

describe('EvidencePanel', () => {
  it('renders metric name, DB coaching prompt, both labeled windows, and the source header', () => {
    render(<EvidencePanel groups={groupsFor(csat, FRESH)} loading={false} />);
    expect(screen.getByText('Customer Satisfaction')).toBeTruthy();
    expect(screen.getByText('Prompt for Customer Satisfaction')).toBeTruthy();
    expect(screen.getByText('95.0%')).toBeTruthy();
    expect(screen.getByText('this wk')).toBeTruthy();
    expect(screen.getByText('last wk 92.0%')).toBeTruthy();
    expect(screen.getByText('Zendesk')).toBeTruthy();
    expect(screen.getByText(/2 wk/)).toBeTruthy();
  });

  it('degrades to the per-person honest banner when the newest stamp is stale', () => {
    const stale = { ...csat, latestSyncedAt: '2026-07-06T20:00:00Z' }; // 16h before FRESH
    render(<EvidencePanel groups={groupsFor(stale, FRESH)} loading={false} />);
    expect(screen.getByRole('status').textContent).toContain('No fresh Zendesk data for this person');
    expect(screen.getByRole('status').textContent).toContain('showing last sync');
  });

  it('shows a skeleton while loading', () => {
    const { container } = render(<EvidencePanel groups={[]} loading />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('empty state names the problem and a suggested action', () => {
    render(<EvidencePanel groups={[]} loading={false} />);
    expect(screen.getByText('No active metrics to show.')).toBeTruthy();
    expect(screen.getByText(/Ask your admin to enable metrics/)).toBeTruthy();
  });
});
