/**
 * All player-feel tuning in one place (rule #4: no hardcoded gameplay
 * numbers) so the PO can retune without touching code. See DECISIONS.md
 * for how the derived values (gravity, jump velocities) were chosen.
 */

/** World tile size in px, matching the GDD's 16x16 tilesets (§10.5). */
export const TILE_SIZE = 16;

export const playerTuning = {
  size: {
    width: 12,
    height: 24,
  },

  run: {
    /** Constant speed, no acceleration curve (GDD §2.2). */
    speed: 90,
  },

  /** px/s^2, downward. Drives jump arc height/duration and fall speed. */
  gravity: 900,

  jump: {
    minHeightTiles: 2,
    maxHeightTiles: 3.5,
    coyoteFrames: 6,
    bufferFrames: 6,
  },

  wall: {
    /** Max downward speed while wall-sliding (well below free-fall). */
    slideSpeed: 40,
    /** Horizontal push away from the wall on a wall kick. */
    kickVelocityX: 140,
    /** Frames of forced horizontal velocity after a kick, so a kick reads
     * as a deliberate commitment instead of being instantly cancellable
     * by holding back into the same wall. Short enough not to block
     * kicking off the *opposite* wall for a chain. */
    kickLockFrames: 6,
  },

  dash: {
    /** Locked until the Legs Capsule (M6) - present as a real, testable
     * system now, but inert: buffered dash inputs are simply discarded
     * while this is false. */
    unlocked: false,
    speed: 220,
    durationFrames: 12,
    cooldownFrames: 18,
    bufferFrames: 6,
  },

  hurt: {
    /** Hurtbox is smaller than the sprite (GDD §2.5 pillar 1: ~70%). */
    hurtboxScale: 0.7,
    /** 1s at the fixed 60Hz step rate (GDD §2.2). */
    invulnFrames: 60,
    flickerIntervalFrames: 4,
    /** Instant horizontal displacement away from the damage source. */
    knockbackHopPx: 4,
    /** Small upward velocity so the 4px hop reads as a hop, not a teleport. */
    knockbackHopVelocityY: -80,
    /** Frames of forced knockback velocity before the player regains control. */
    hitstunFrames: 10,
  },

  buster: {
    /** Pool size IS the on-screen cap (GDD §2.2: 3 bullets max). */
    maxOnScreen: 3,
    speed: 260,
    chargeLv2Seconds: 0.5,
    chargeLv3Seconds: 1.2,
    /** Locked until the Arms Capsule (M6). */
    chargeLv3Unlocked: false,
    damage: { uncharged: 1, lv2: 2, lv3: 4 },
    projectileSize: { uncharged: 4, lv2: 6, lv3: 9 },
    /** Despawn after this long in flight - a lifetime, not a screen-edge
     * check, since the camera scrolls in a level much wider than the
     * viewport (comparing world position to viewport width would
     * despawn shots almost instantly once scrolled in). Comfortably
     * longer than crossing any on-screen encounter. */
    maxFlightMs: 2000,
  },
} as const;
