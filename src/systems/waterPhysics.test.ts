import { describe, expect, it } from 'vitest';
import { addCurrentPush, capFallSpeed, selectJumpVelocity, submergedGravity } from './waterPhysics';

describe('submergedGravity', () => {
  it('scales dry gravity by the buoyancy multiplier', () => {
    expect(submergedGravity(900, 0.35)).toBeCloseTo(315, 5);
  });

  it('multiplier of 1 leaves gravity unchanged (sanity check against dry-land physics)', () => {
    expect(submergedGravity(900, 1)).toBe(900);
  });
});

describe('capFallSpeed', () => {
  it('clamps a fall velocity above the submerged terminal speed', () => {
    expect(capFallSpeed(300, 70)).toBe(70);
  });

  it('leaves a fall velocity already under the cap unchanged', () => {
    expect(capFallSpeed(40, 70)).toBe(40);
  });

  it('leaves upward (negative) velocity unchanged - only caps falling, not rising', () => {
    expect(capFallSpeed(-200, 70)).toBe(-200);
  });

  it('leaves velocity exactly at the cap unchanged', () => {
    expect(capFallSpeed(70, 70)).toBe(70);
  });
});

describe('selectJumpVelocity', () => {
  it('returns the dry launch velocity when not submerged', () => {
    expect(selectJumpVelocity(false, -317, -140)).toBe(-317);
  });

  it('returns the gentler swim-kick velocity when submerged', () => {
    expect(selectJumpVelocity(true, -317, -140)).toBe(-140);
  });
});

describe('addCurrentPush', () => {
  it('adds the current push vector onto the base velocity', () => {
    expect(addCurrentPush(90, 0, 40, -70)).toEqual({ x: 130, y: -70 });
  });

  it('is a no-op with a zero push vector (not overlapping any current)', () => {
    expect(addCurrentPush(90, -300, 0, 0)).toEqual({ x: 90, y: -300 });
  });

  it('can push against the player intent (negative push opposing positive velocity)', () => {
    expect(addCurrentPush(90, 0, -120, 0)).toEqual({ x: -30, y: 0 });
  });
});
