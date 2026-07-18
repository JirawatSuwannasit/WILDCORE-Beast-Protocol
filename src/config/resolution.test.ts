import { describe, expect, it } from 'vitest';
import { computeRenderWidth, EXTENDED_WIDTH, GAME_HEIGHT, GAME_WIDTH } from './resolution';

describe('computeRenderWidth', () => {
  it('renders exactly the critical frame at 16:9', () => {
    expect(computeRenderWidth(1920, 1080)).toBe(GAME_WIDTH);
  });

  it('extends the background to fill a Samsung S25-like 19.5:9 screen', () => {
    // Galaxy S25: 2340x1080 physical, ~19.5:9. Regression for the P1
    // report: this used to pillarbox instead of extending.
    const width = computeRenderWidth(2340, 1080);
    expect(width).toBeGreaterThan(GAME_WIDTH);
    expect(width).toBeLessThanOrEqual(EXTENDED_WIDTH);
    // Should closely match the device aspect (no leftover pillarbox).
    expect(width / GAME_HEIGHT).toBeCloseTo(2340 / 1080, 1);
  });

  it('extends fully to the 21:9 cap with no pillarboxing', () => {
    const width = computeRenderWidth(2100, 900); // exactly 21:9
    expect(width).toBe(EXTENDED_WIDTH);
  });

  it('clamps at the 21:9 cap for even wider screens instead of extending indefinitely', () => {
    const width = computeRenderWidth(3200, 1000); // 3.2:1, wider than 21:9
    expect(width).toBe(EXTENDED_WIDTH);
  });

  it('keeps the full critical frame for a narrower-than-16:9 viewport', () => {
    const width = computeRenderWidth(900, 1080); // portrait-ish, narrower than 16:9
    expect(width).toBe(GAME_WIDTH);
  });

  it('falls back to the critical frame width for a degenerate zero-size viewport', () => {
    expect(computeRenderWidth(0, 0)).toBe(GAME_WIDTH);
  });
});
