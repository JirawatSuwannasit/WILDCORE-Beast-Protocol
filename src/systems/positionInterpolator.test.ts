import { describe, expect, it } from 'vitest';
import { PositionInterpolator } from './positionInterpolator';

describe('PositionInterpolator', () => {
  it('interpolates at alpha=0 to the previous step position', () => {
    const interp = new PositionInterpolator(0, 0);
    interp.capture(10, 20);
    expect(interp.interpolate(0)).toEqual({ x: 0, y: 0 });
  });

  it('interpolates at alpha=1 to the current step position', () => {
    const interp = new PositionInterpolator(0, 0);
    interp.capture(10, 20);
    expect(interp.interpolate(1)).toEqual({ x: 10, y: 20 });
  });

  it('blends linearly at alpha=0.5', () => {
    const interp = new PositionInterpolator(0, 0);
    interp.capture(10, 20);
    expect(interp.interpolate(0.5)).toEqual({ x: 5, y: 10 });
  });

  it('shifts prev<-step on each capture, chaining across multiple steps', () => {
    const interp = new PositionInterpolator(0, 0);
    interp.capture(10, 0);
    interp.capture(20, 0);
    expect(interp.interpolate(0)).toEqual({ x: 10, y: 0 });
    expect(interp.interpolate(1)).toEqual({ x: 20, y: 0 });
  });

  it('reset() collapses prev and step to the same point (no interpolation glitch after a teleport)', () => {
    const interp = new PositionInterpolator(0, 0);
    interp.capture(10, 0);
    interp.reset(100, 50);
    expect(interp.interpolate(0)).toEqual({ x: 100, y: 50 });
    expect(interp.interpolate(1)).toEqual({ x: 100, y: 50 });
  });

  it('does not glitch on the very first frame before any capture() has run', () => {
    const interp = new PositionInterpolator(42, 7);
    expect(interp.interpolate(0.5)).toEqual({ x: 42, y: 7 });
  });

  it('stepDelta reports how far the body moved on the most recent capture (e.g. for carrying a rider)', () => {
    const interp = new PositionInterpolator(0, 0);
    interp.capture(15, -3);
    expect(interp.stepDelta).toEqual({ dx: 15, dy: -3 });
  });

  it('stepDelta is zero before any capture() has run', () => {
    const interp = new PositionInterpolator(10, 10);
    expect(interp.stepDelta).toEqual({ dx: 0, dy: 0 });
  });
});
