// @vitest-environment jsdom
// First component tests (FRONTEND.md checklist): renders with full props ·
// skeleton when loading · empty states carry a message, never blank.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TalkingPoints } from './TalkingPoints';
import { NEW_HIRE_COPY, NO_DATA_COPY, STEADY_WEEK_COPY, STEADY_WEEK_SUGGESTION } from '../../../lib/coaching';
import type { TalkingPoint } from '../../../lib/coaching';

afterEach(cleanup);

const POINTS: TalkingPoint[] = [
  { kind: 'discuss', text: 'First Reply Time up 40% — 42.0 min now.', ask: '“What’s changed?”' },
  { kind: 'celebrate', text: 'Customer Satisfaction up 9% vs. the last few weeks.' },
];

describe('TalkingPoints', () => {
  it('renders points with "start here" on the lead and its opening question', () => {
    render(<TalkingPoints points={POINTS} allNew={false} noData={false} loading={false} />);
    expect(screen.getByText('start here')).toBeTruthy();
    expect(screen.getByText('First Reply Time up 40% — 42.0 min now.')).toBeTruthy();
    expect(screen.getByText(/Ask: /)).toBeTruthy();
    expect(screen.getByText('celebrate')).toBeTruthy();
  });

  it('shows a skeleton while loading, not points', () => {
    const { container } = render(<TalkingPoints points={[]} allNew={false} noData={false} loading />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
    expect(screen.queryByText(STEADY_WEEK_COPY)).toBeNull();
  });

  it('steady week empty state has a message and a suggested action', () => {
    render(<TalkingPoints points={[]} allNew={false} noData={false} loading={false} />);
    expect(screen.getByText(STEADY_WEEK_COPY)).toBeTruthy();
    expect(screen.getByText(STEADY_WEEK_SUGGESTION)).toBeTruthy();
  });

  it('all-new history shows the onboarding framing', () => {
    render(<TalkingPoints points={[]} allNew noData={false} loading={false} />);
    expect(screen.getByText(NEW_HIRE_COPY)).toBeTruthy();
  });

  it('no data at all is its own state, not "steady" and not "ramping"', () => {
    render(<TalkingPoints points={[]} allNew={false} noData loading={false} />);
    expect(screen.getByText(NO_DATA_COPY)).toBeTruthy();
    expect(screen.queryByText(STEADY_WEEK_COPY)).toBeNull();
    expect(screen.queryByText(NEW_HIRE_COPY)).toBeNull();
  });
});
