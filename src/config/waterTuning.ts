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
} as const;
