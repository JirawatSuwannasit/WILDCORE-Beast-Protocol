/**
 * Coral Reservoir's signature gimmick tuning (GDD §3.2: "water level
 * raises/lowers on valves; currents push jumps; underwater float
 * physics"). Kept in its own file (like playerTuning.ts) rather than
 * folded into enemyTuning.ts because it's a player-physics modifier, not
 * an enemy/hazard - Player.ts reads it directly the same way it reads
 * playerTuning.
 */
export const waterTuning = {
  buoyancy: {
    /** Multiplies playerTuning.gravity while submerged - much floatier fall than dry land. */
    gravityMultiplier: 0.35,
    /** Terminal fall speed while submerged (px/s) - well under dry free-fall. */
    maxFallSpeedY: 70,
    /** A swim "kick" while submerged replaces the normal jump launch -
     * gentler than a full jump (GDD §3.2 "underwater float physics"),
     * tapped repeatedly to swim upward rather than one big leap. */
    swimKickVelocityY: -140,
  },

  /** GDD §3b hazard matrix: currents deal 0 damage, movement modifier only, always shown by bubbles. */
  current: {
    bubbleTelegraphIntervalFrames: 18,
  },

  /**
   * M4.1-REBUILD (GDD §2.7 problem 2): the setpiece's signature water
   * moment - a rising water level in the wall-kick ascent shaft. Purely an
   * assist, never a hazard (0 damage, same as currents): touching it grants
   * submerged float physics + a gentle upward push, so falling behind the
   * rising water helps the player catch back up instead of punishing them.
   */
  risingWater: {
    /** How fast the surface climbs once triggered (px/s). */
    riseSpeedPxPerSec: 18,
    /** Gentle upward assist applied while the player overlaps the rising water. */
    pushY: -60,
  },
} as const;
