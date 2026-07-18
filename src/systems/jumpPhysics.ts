/**
 * Pure variable-height jump math (GDD §2.2: "release early = short hop").
 * Given a downward gravity and the min/max jump heights, derive the
 * launch velocity for a full-height jump and the velocity ceiling that
 * guarantees the minimum height even on an instant tap-and-release.
 *
 * Phaser/Arcade Physics use a y-down coordinate system, so "up" is
 * negative velocity throughout.
 */
export interface JumpVelocities {
  /** Launch velocity (negative) that reaches maxHeight if held to apex. */
  launchVelocity: number;
  /** Velocity ceiling (negative, closer to 0) for an early release. */
  cutVelocity: number;
}

export function computeJumpVelocities(
  gravity: number,
  minHeightPx: number,
  maxHeightPx: number,
): JumpVelocities {
  return {
    launchVelocity: -Math.sqrt(2 * gravity * maxHeightPx),
    cutVelocity: -Math.sqrt(2 * gravity * minHeightPx),
  };
}

/**
 * Apply an early jump-button release: clamps an upward velocity down to
 * the cut velocity so releasing immediately still guarantees minHeightPx,
 * but never *adds* upward speed if the player is already below that
 * ceiling (e.g. releasing near the apex).
 */
export function applyJumpCut(velocityY: number, cutVelocity: number): number {
  return velocityY < cutVelocity ? cutVelocity : velocityY;
}
