// Interval math for the Assembled metrics — moved verbatim from
// connectors/assembled.ts in Phase 1B. Pure functions, pinned by intervals.test.ts.

export interface TimeInterval {
  start: number;
  end: number;
}

export function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const first = sorted[0]!;
  const merged: TimeInterval[] = [{ start: first.start, end: first.end }];
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]!;
    const last = merged[merged.length - 1]!;
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ start: current.start, end: current.end });
    }
  }
  return merged;
}

export function totalDuration(intervals: TimeInterval[]): number {
  return mergeIntervals(intervals).reduce((sum, iv) => sum + (iv.end - iv.start), 0);
}

export function overlapDuration(a: TimeInterval[], b: TimeInterval[]): number {
  const mergedA = mergeIntervals(a);
  const mergedB = mergeIntervals(b);
  let total = 0;
  for (const ia of mergedA) {
    for (const ib of mergedB) {
      const start = Math.max(ia.start, ib.start);
      const end = Math.min(ia.end, ib.end);
      if (end > start) total += end - start;
    }
  }
  return total;
}

export function toIntervals(items: Array<{ start_time: number; end_time: number }>): TimeInterval[] {
  return items.map(i => ({ start: i.start_time, end: i.end_time }));
}
