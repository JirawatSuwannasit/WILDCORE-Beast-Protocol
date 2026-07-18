/**
 * VOLT CHEETAH tuning (GDD §3.1 / §4). Frame counts are fixed-60Hz
 * steps. All patterns must be dodgeable with the buster alone (GDD §4)
 * - weakness (stubbed until M3) only interrupts and adds damage.
 */
export const voltCheetahTuning = {
  /** 16-unit boss bar, same scale as the player's HP (GDD §2.3). */
  maxHp: 16,
  /** Health-fill ritual on room entry (GDD §4: ~1.5s). */
  fillRitualMs: 1500,
  /** Below this HP fraction, patterns chain into the desperation combo. */
  desperationHpFraction: 0.25,
  /** GDD §4: a weakness hit is 4 damage + interrupt, regardless of attacker. */
  weaknessDamage: 4,

  contactDamage: 3,

  dash: {
    /** 3 speeds; telegraphed by how long the boss crouches first - a
     * longer crouch both charges a faster dash and gives the player
     * proportionally more warning for the more dangerous version. */
    speeds: [90, 140, 190],
    crouchFramesBySpeed: [24, 36, 50],
    /** Frames the boss holds at the wall after a dash before recovering. */
    recoverFrames: 20,
  },

  wallPounce: {
    telegraphFrames: 26,
    launchVelocityX: 160,
    launchVelocityY: -210,
    gravity: 900,
  },

  floorSweep: {
    telegraphFrames: 24,
    travelSpeed: 150,
    height: 14,
    damage: 2,
  },

  desperation: {
    /** Desperation strings 2 patterns back-to-back with a short linking pause. */
    linkFrames: 10,
  },
} as const;
