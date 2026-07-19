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
