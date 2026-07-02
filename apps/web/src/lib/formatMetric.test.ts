// Characterization tests — pin CURRENT display formatting before Phase 1B/2 refactors.
import { describe, it, expect } from 'vitest';
import { formatMetricValue } from './formatMetric';

describe('formatMetricValue', () => {
  it('null → "Not configured" regardless of unit', () => {
    expect(formatMetricValue(null, 'seconds')).toBe('Not configured');
    expect(formatMetricValue(null, 'percent')).toBe('Not configured');
    expect(formatMetricValue(null, 'count')).toBe('Not configured');
  });

  it('seconds under 60 minutes render as minutes with 1 decimal', () => {
    expect(formatMetricValue(900, 'seconds')).toBe('15.0 min');
    expect(formatMetricValue(3540, 'seconds')).toBe('59.0 min');
  });

  it('seconds at or above 60 minutes render as hours with 1 decimal', () => {
    expect(formatMetricValue(3600, 'seconds')).toBe('1.0h');
    expect(formatMetricValue(442414, 'seconds')).toBe('122.9h'); // docs/metrics.md example
  });

  it('zero seconds is a measured value, not "no data"', () => {
    expect(formatMetricValue(0, 'seconds')).toBe('0.0 min');
  });

  it('percent renders with 1 decimal and % suffix', () => {
    expect(formatMetricValue(83.333, 'percent')).toBe('83.3%');
    expect(formatMetricValue(0, 'percent')).toBe('0.0%');
    expect(formatMetricValue(100, 'percent')).toBe('100.0%');
  });

  it('count rounds to an integer', () => {
    expect(formatMetricValue(12.4, 'count')).toBe('12');
    expect(formatMetricValue(0, 'count')).toBe('0');
  });

  it('unknown unit falls back to String()', () => {
    expect(formatMetricValue(5, 'widgets')).toBe('5');
  });
});
