// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { currentWeekStartUtc, weekStartStr, type MetricDefinition } from '@scorecard/shared';
import { SharedScorecardPage } from './SharedScorecardPage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', 'http://api.test');
});

function renderPage(token = 'tok-1') {
  return render(
    <MemoryRouter initialEntries={[`/shared/${token}`]}>
      <Routes>
        <Route path="/shared/:token" element={<SharedScorecardPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const CSAT: MetricDefinition = {
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

function okPayload() {
  const thisWeek = weekStartStr(currentWeekStartUtc());
  return {
    employee: { full_name: 'Maya Okafor', email: 'maya@hungerrush.com' },
    definitions: [CSAT],
    snapshots: [
      {
        metric_key: 'csat_score',
        value: 92,
        period_start: thisWeek,
        period_end: thisWeek,
        synced_at: new Date().toISOString(),
      },
    ],
  };
}

describe('SharedScorecardPage', () => {
  it('renders the snapshot with framing copy and a per-row synced stamp', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => okPayload() })),
    );
    renderPage();
    expect(await screen.findByText('Maya Okafor')).toBeTruthy();
    expect(screen.getByText(/not a performance review/)).toBeTruthy();
    expect(screen.getByText('Customer Satisfaction')).toBeTruthy();
    // The per-tile synced timestamp is this page's CLAUDE.md rule.
    expect(screen.getByText(/^Synced /)).toBeTruthy();
    expect(screen.getByText('Read-only view shared by your manager')).toBeTruthy();
  });

  it('shows skeleton while loading', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    const { container } = renderPage();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows the expired-link message with a suggested action', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 410,
        json: async () => ({ error: 'This link has expired.' }),
      })),
    );
    renderPage();
    expect(await screen.findByText('Link expired')).toBeTruthy();
    expect(screen.getByText('This link has expired.')).toBeTruthy();
    expect(screen.getByText(/ask your manager for a fresh one/)).toBeTruthy();
  });
});
