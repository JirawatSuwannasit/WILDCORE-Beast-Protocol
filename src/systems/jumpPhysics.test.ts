import { describe, expect, it } from 'vitest';
import { applyJumpCut, computeJumpVelocities } from './jumpPhysics';

describe('computeJumpVelocities', () => {
  it('derives a launch velocity that reaches exactly maxHeight under the given gravity', () => {
    const gravity = 900;
    const maxHeightPx = 56; // 3.5 tiles at 16px
    const { launchVelocity } = computeJumpVelocities(gravity, 32, maxHeightPx);

    // Kinematics: peak height = v^2 / (2g)
    const achievedHeight = launchVelocity ** 2 / (2 * gravity);
    expect(achievedHeight).toBeCloseTo(maxHeightPx, 5);
  });

  it('derives a cut velocity that reaches exactly minHeight under the given gravity', () => {
    const gravity = 900;
    const minHeightPx = 32; // 2 tiles at 16px
    const { cutVelocity } = computeJumpVelocities(gravity, minHeightPx, 56);

    const achievedHeight = cutVelocity ** 2 / (2 * gravity);
    expect(achievedHeight).toBeCloseTo(minHeightPx, 5);
  });

  it('launch velocity is more negative (higher) than cut velocity when max > min', () => {
    const { launchVelocity, cutVelocity } = computeJumpVelocities(900, 32, 56);
    expect(launchVelocity).toBeLessThan(cutVelocity);
  });

  it('produces equal velocities when min and max heights are equal (fixed-height jump)', () => {
    const { launchVelocity, cutVelocity } = computeJumpVelocities(900, 40, 40);
    expect(launchVelocity).toBeCloseTo(cutVelocity, 10);
  });
});

describe('applyJumpCut', () => {
  const { cutVelocity } = computeJumpVelocities(900, 32, 56);

  it('clamps a fast upward velocity (early release right after launch) down to cutVelocity', () => {
    const launchVelocity = -318; // faster (more negative) than cutVelocity
    expect(applyJumpCut(launchVelocity, cutVelocity)).toBeCloseTo(cutVelocity, 5);
  });

  it('leaves velocity unchanged if already at or below the cut ceiling (late release near apex)', () => {
    const nearApexVelocity = cutVelocity + 20; // slower upward speed than the ceiling
    expect(applyJumpCut(nearApexVelocity, cutVelocity)).toBe(nearApexVelocity);
  });

  it('leaves downward velocity unchanged (falling, not jumping)', () => {
    expect(applyJumpCut(150, cutVelocity)).toBe(150);
  });

  it('guarantees at least the minimum height for an instant tap (cut applied immediately at launch)', () => {
    const gravity = 900;
    const { launchVelocity, cutVelocity: cut } = computeJumpVelocities(gravity, 32, 56);
    const cutImmediately = applyJumpCut(launchVelocity, cut);
    const achievedHeight = cutImmediately ** 2 / (2 * gravity);
    expect(achievedHeight).toBeCloseTo(32, 5);
  });
});
