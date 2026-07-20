import { describe, expect, it } from 'vitest';
import {
  addCurrentPush,
  capFallSpeed,
  capRiseSpeed,
  clampSubmergedVelocityY,
  selectJumpVelocity,
  submergedGravity,
} from './waterPhysics';

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

describe('capRiseSpeed', () => {
  it('clamps a rising velocity beyond the submerged terminal rise speed', () => {
    expect(capRiseSpeed(-500, 150)).toBe(-150);
  });

  it('leaves a rising velocity already under the cap unchanged', () => {
    expect(capRiseSpeed(-80, 150)).toBe(-80);
  });

  it('leaves falling (positive) velocity unchanged - only caps rising, not falling', () => {
    expect(capRiseSpeed(300, 150)).toBe(300);
  });

  it('leaves velocity exactly at the cap unchanged', () => {
    expect(capRiseSpeed(-150, 150)).toBe(-150);
  });
});

describe('clampSubmergedVelocityY', () => {
  it('bounds a runaway upward velocity to the rise cap - the P1 "cannot submerge" bug', () => {
    // Simulates RisingWaterZone's pushY (-60) compounding onto velocity
    // every fixed step for several consecutive frames of overlap, the
    // exact mechanism that caused the player to rocket toward the surface
    // and never be able to sink.
    let velocityY = 0;
    for (let frame = 0; frame < 10; frame += 1) {
      velocityY = clampSubmergedVelocityY(velocityY - 60, 70, 150);
    }
    expect(velocityY).toBe(-150);
  });

  it('bounds a fast fall to the fall cap', () => {
    expect(clampSubmergedVelocityY(400, 70, 150)).toBe(70);
  });

  it('leaves velocity within both bounds unchanged', () => {
    expect(clampSubmergedVelocityY(20, 70, 150)).toBe(20);
    expect(clampSubmergedVelocityY(-20, 70, 150)).toBe(-20);
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
