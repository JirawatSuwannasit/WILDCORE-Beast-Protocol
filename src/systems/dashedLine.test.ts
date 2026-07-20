import { describe, expect, it } from 'vitest';
import { computeDashSegments } from './dashedLine';

describe('computeDashSegments', () => {
  it('splits a horizontal line into alternating dash/gap pieces', () => {
    const segments = computeDashSegments(0, 0, 30, 0, 10, 5);
    expect(segments).toEqual([
      { x1: 0, y1: 0, x2: 10, y2: 0 },
      { x1: 15, y1: 0, x2: 25, y2: 0 },
    ]);
  });

  it('clips the final dash to the segment end instead of overshooting', () => {
    const segments = computeDashSegments(0, 0, 12, 0, 10, 5);
    expect(segments.at(-1)).toEqual({ x1: 0, y1: 0, x2: 10, y2: 0 });
    expect(segments).toHaveLength(1);
  });

  it('works diagonally (dash length measured along the line, not per-axis)', () => {
    const segments = computeDashSegments(0, 0, 8, 6, 10, 0);
    // Total distance is 10 (3-4-5 triangle scaled), so one dash covers it exactly.
    expect(segments).toEqual([{ x1: 0, y1: 0, x2: 8, y2: 6 }]);
  });

  it('returns no segments for a zero-length line', () => {
    expect(computeDashSegments(5, 5, 5, 5, 10, 5)).toEqual([]);
  });

  it('returns multiple dashes for a long line', () => {
    const segments = computeDashSegments(0, 0, 100, 0, 10, 10);
    expect(segments).toHaveLength(5);
    expect(segments[0]).toEqual({ x1: 0, y1: 0, x2: 10, y2: 0 });
    expect(segments[1]).toEqual({ x1: 20, y1: 0, x2: 30, y2: 0 });
  });
});
