import { describe, expect, it } from 'vitest';
import { FIXED_DT_MS, FixedTimestepAccumulator } from './fixedTimestep';

describe('FixedTimestepAccumulator', () => {
  it('does not step when delta is below one fixed frame', () => {
    const acc = new FixedTimestepAccumulator();
    let steps = 0;
    const alpha = acc.step(FIXED_DT_MS / 2, () => {
      steps += 1;
    });
    expect(steps).toBe(0);
    expect(alpha).toBeCloseTo(0.5, 5);
  });

  it('steps exactly once per fixed frame at a matching frame rate', () => {
    const acc = new FixedTimestepAccumulator();
    let steps = 0;
    for (let i = 0; i < 10; i += 1) {
      acc.step(FIXED_DT_MS, () => {
        steps += 1;
      });
    }
    expect(steps).toBe(10);
  });

  it('accumulates leftover time across frames instead of dropping it', () => {
    const acc = new FixedTimestepAccumulator();
    let steps = 0;
    // Three frames of 10ms (30ms total) should yield exactly 1 fixed
    // step (16.667ms) with ~13.33ms left in the accumulator, not zero.
    acc.step(10, () => {
      steps += 1;
    });
    acc.step(10, () => {
      steps += 1;
    });
    const alpha = acc.step(10, () => {
      steps += 1;
    });
    expect(steps).toBe(1);
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(1);
  });

  it('caps catch-up steps to avoid a spiral of death after a large stall', () => {
    const acc = new FixedTimestepAccumulator();
    let steps = 0;
    acc.step(10_000, () => {
      steps += 1;
    });
    expect(steps).toBeLessThanOrEqual(5);
  });

  it('reset clears any pending accumulated time', () => {
    const acc = new FixedTimestepAccumulator();
    acc.step(FIXED_DT_MS / 2, () => {});
    acc.reset();
    let steps = 0;
    const alpha = acc.step(1, () => {
      steps += 1;
    });
    expect(steps).toBe(0);
    expect(alpha).toBeCloseTo(1 / FIXED_DT_MS, 5);
  });
});
