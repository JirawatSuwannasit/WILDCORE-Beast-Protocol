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
    /** Terminal fall (sink) speed while submerged (px/s) - well under dry free-fall. */
    maxFallSpeedY: 70,
    /** Terminal rise speed while submerged (px/s). Symmetric cap to maxFallSpeedY -
     * GDD §3.2 "underwater float physics" means a bounded float, not an
     * unbounded rocket. Without this, a lingering per-frame assist (e.g.
     * RisingWaterZone's pushY, added every fixed step for as long as the
     * player overlaps it) compounds indefinitely instead of settling at a
     * terminal speed, which is what caused the P1 "player can't sink, just
     * bobs at the surface" bug - the assist wasn't the surface, it was an
     * accelerating force. Set comfortably above swimKickVelocityY's
     * magnitude so a deliberate kick still reads as a stronger stroke than
     * passive assist alone. */
    maxRiseSpeedY: 150,
    /** A swim "kick" while submerged replaces the normal jump launch -
     * gentler than a full jump (GDD §3.2 "underwater float physics"),
     * tapped repeatedly to swim upward rather than one big leap. */
    swimKickVelocityY: -140,
    /** Direct swim speed (px/s) while holding up/down in water - GDD §3.2
     * "player can swim down" / "move freely in the water volume". Same
     * constant-speed-no-acceleration model as horizontal run movement, just
     * gentler to read as swimming rather than running. Applies in both
     * directions: holding down actively descends instead of waiting on
     * gravity alone, holding up swims rather than just kick-bobbing. */
    swimSpeedY: 60,
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

  /**
   * P1 bugfix: every water overlay (this rising surface, an open WaterGate's
   * fill) is a translucent Rectangle GameObject with no explicit depth,
   * defaulting to depth 0 - same as the player's visual sprite. Phaser
   * breaks same-depth ties by scene-add order, and every water overlay is
   * spawned during entity setup, which runs *after* the player is
   * constructed - so water was rendering in front of the player, not behind
   * it, making the player appear to vanish on entry. A small negative depth
   * keeps every water overlay behind gameplay actors (player, enemies),
   * regardless of add order, without touching the player's own depth (and
   * therefore without risking any other actor's stacking).
   */
  renderDepth: -1,
} as const;
