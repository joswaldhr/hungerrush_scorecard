// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SyncFreshnessChip } from './SyncFreshnessChip';

afterEach(cleanup);

const NOW = new Date('2026-07-08T18:00:00Z');

describe('SyncFreshnessChip', () => {
  it('renders nothing until a stamp exists', () => {
    const { container } = render(<SyncFreshnessChip latestSyncedAt={null} now={NOW} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows a quiet gray stamp while fresh (inside the 9h bound)', () => {
    render(<SyncFreshnessChip latestSyncedAt="2026-07-08T16:00:00Z" now={NOW} />);
    const chip = screen.getByText(/^synced .*ago$/);
    expect(chip.className).toContain('text-hr-gray-mid');
    expect(chip.className).not.toContain('hr-amber');
  });

  it('degrades to amber past the 9h bound — system state, not performance', () => {
    render(<SyncFreshnessChip latestSyncedAt="2026-07-08T08:00:00Z" now={NOW} />);
    const chip = screen.getByText(/^synced .*ago$/);
    expect(chip.className).toContain('text-hr-amber-deep');
    expect(chip.className).toContain('bg-hr-amber-tint');
  });
});
