/**
 * Pure underwater-physics helpers (GDD §3.2 Coral Reservoir gimmick: water
 * level valves, currents, float physics). No Phaser import - same split as
 * jumpPhysics.ts/weapons.ts, so it's directly unit-testable; Player.ts and
 * ReservoirScene.ts are the Phaser-side callers.
 */

/** Buoyant fall: multiplies dry-land gravity while submerged. */
export function submergedGravity(dryGravity: number, multiplier: number): number {
  return dryGravity * multiplier;
}

/** Clamps a downward (positive) fall velocity to the submerged terminal speed; leaves rising/negative velocity untouched. */
export function capFallSpeed(velocityY: number, maxFallSpeedY: number): number {
  return velocityY > maxFallSpeedY ? maxFallSpeedY : velocityY;
}

/** Clamps a rising (negative) velocity to the submerged terminal rise speed; leaves falling/positive velocity untouched. */
export function capRiseSpeed(velocityY: number, maxRiseSpeedY: number): number {
  return velocityY < -maxRiseSpeedY ? -maxRiseSpeedY : velocityY;
}

/**
 * Bounds submerged velocity in both directions to a terminal speed - GDD
 * §3.2 "float physics" means bounded, not a runaway accelerator. Without
 * this, a per-frame assist that's added every fixed step for as long as
 * the player overlaps a water zone (e.g. RisingWaterZone's gentle push)
 * compounds indefinitely instead of settling anywhere, since Arcade
 * velocity persists between frames rather than resetting to zero - that
 * unbounded accumulation was the P1 bug ("player can't sink, just bobs at
 * the surface"). Call this LAST in the frame, after gravity/kicks/pushes
 * have all contributed, so it's the actual terminal speed for the step.
 */
export function clampSubmergedVelocityY(
  velocityY: number,
  maxFallSpeedY: number,
  maxRiseSpeedY: number,
): number {
  return capRiseSpeed(capFallSpeed(velocityY, maxFallSpeedY), maxRiseSpeedY);
}

/** Jump input while submerged is a gentler "swim kick", not the full dry-land launch. */
export function selectJumpVelocity(
  submerged: boolean,
  dryLaunchVelocity: number,
  swimKickVelocity: number,
): number {
  return submerged ? swimKickVelocity : dryLaunchVelocity;
}

/** Currents (GDD §3b: 0 damage, movement modifier only) add directly onto the player's velocity for the frame they're overlapping. */
export function addCurrentPush(
  velocityX: number,
  velocityY: number,
  pushX: number,
  pushY: number,
): { x: number; y: number } {
  return { x: velocityX + pushX, y: velocityY + pushY };
}
