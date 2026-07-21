/**
 * Enemy + hazard tuning for Speedway Savanna (GDD §3b), and shared
 * defaults future stages (M4) can reuse. Frame counts are fixed-60Hz
 * steps, matching src/config/playerTuning.ts's convention.
 */

/** GDD §3b universal enemy rules. */
export const enemyCommon = {
  contactDamage: 2,
  /** Every ranged/melee attack telegraphs for at least this long (feel pillar #4). */
  minTelegraphFrames: 20,
} as const;

export const patrolDroneTuning = {
  hp: 2,
  hoverSpeed: 20,
  /** How far the drone patrols from its spawn point, each direction. */
  patrolRangeX: 48,
  /** Sightline ray length in front of the drone. */
  sightRangeX: 140,
  sightHalfHeight: 10,
  telegraphFrames: 20,
  boltSpeed: 130,
  boltDamage: 2,
  /** Frames before the drone can fire again after a shot. */
  cooldownFrames: 90,
  /** Mid-boss "twin patrol drones circling a pylon" (GDD §3.1) reuse this enemy in orbit mode. */
  orbitRadius: 24,
  orbitPeriodFrames: 180,
} as const;

export const sparkBugTuning = {
  hp: 1,
  /** Frames of growing "about to hop" telegraph before each hop. */
  telegraphFrames: 24,
  hopIntervalFrames: 70,
  hopVelocityX: 70,
  hopVelocityY: -110,
  gravity: 700,
} as const;

export const turretSunflowerTuning = {
  hp: 3,
  openFrames: 24,
  /** How long it stays open (vulnerable + able to fire) before closing again. */
  openHoldFrames: 30,
  closedFrames: 60,
  boltSpeed: 110,
  boltDamage: 2,
  /** 3-way spread, in radians from straight toward the player. */
  spreadAngleRad: 0.4,
} as const;

export const electricFenceTuning = {
  damage: 2,
  /** Pulses on a visible+audible beat; GDD §3b: safe window >=40 frames. */
  onFrames: 50,
  safeFrames: 50,
} as const;

export const collapsingBridgeTuning = {
  /** Crack telegraph before giving way (GDD §3b: 24f). */
  crackFrames: 24,
  /** How long the tile stays gone before resetting (checkpoint-independent, so retries aren't punished by a still-broken bridge). */
  respawnFrames: 90,
} as const;

export const speedStripTuning = {
  /** Multiplier applied to run speed while standing on a speed-boost strip. */
  speedMultiplier: 1.6,
} as const;

export const spikeTuning = {
  /** GDD §3b hazard matrix: spikes are lethal (instant respawn at checkpoint). */
  lethal: true,
} as const;

// --- Coral Reservoir (GDD §3.2 / §3b) --------------------------------------

export const bubbleCrabTuning = {
  hp: 2,
  walkSpeed: 24,
  /** Popped by any hit (buster or weapon); stays vulnerable this long (2s at 60Hz) before re-bubbling. */
  vulnerableFrames: 120,
} as const;

export const dartFishTuning = {
  hp: 1,
  /** Idles, then wiggles this long (>=20f telegraph) before dashing straight. */
  wiggleFrames: 20,
  dashSpeed: 150,
  /** Frames the dash lasts before the fish stops and returns to idling. */
  dashFrames: 30,
  idleFrames: 90,
} as const;

export const toxicUrchinTuning = {
  /** Stationary reef hazard - contact damage, not lethal (unlike spikes). */
  contactDamage: 1,
} as const;

export const currentTuning = {
  /** Visual telegraph only - GDD §3b: currents are 0 damage, always shown by bubbles. */
  bubbleCount: 5,
} as const;

export const waterValveTuning = {
  /** Debounce so one contact toggles the gate exactly once, not every overlapping frame. */
  toggleCooldownFrames: 30,
} as const;

export const waterGateTuning = {
  /** How long the water-level tween takes when a valve raises/lowers it (GDD §3.2). */
  toggleTweenMs: 700,
} as const;

// --- Ember Foundry (GDD §3.3 / §3b) ----------------------------------------

export const slagBlobTuning = {
  hp: 2,
  crawlSpeed: 18,
  gravity: 900,
  patrolRangeX: 40,
  /** GDD §3b: "periodically inflates (glow 24f) and lobs 2 slag arcs." */
  inflateFrames: 24,
  arcCount: 2,
  arcSpeed: 90,
  arcDamage: 2,
  /** Frames of rest between attacks once cooled down from the last one. */
  cooldownFrames: 100,
  /** Forward offsets (px, along facing direction) where the landing flames spawn - approximates where the lobbed arcs come down without needing full projectile-impact tracking. */
  flameOffsetsX: [24, 44] as readonly number[],
} as const;

export const slagFlameTuning = {
  /** GDD §3b: "slag leaves brief floor flames" - a lingering contact hazard, not lethal. */
  contactDamage: 1,
  lifetimeFrames: 150,
} as const;

export const emberBatTuning = {
  hp: 1,
  /** GDD §3b: "eyes light 20f then U-curve swoop when the player passes below." */
  eyeGlowFrames: 20,
  swoopFrames: 50,
  /** How far below the ceiling anchor the U-curve dips at its lowest point. */
  swoopDepthPx: 44,
  /** Horizontal proximity to the anchor that arms the eye-glow telegraph, once the player is below it. */
  triggerRangeX: 60,
  cooldownFrames: 80,
} as const;

export const heatVentTuning = {
  /** Rising-ember particle count for the vent's visual telegraph (mirrors currentTuning.bubbleCount). */
  emberCount: 6,
} as const;

export const pistonCrusherTuning = {
  /** GDD §3b: "rails visible, 2-cycle rhythm, >=30f open window" - generous margin over the floor. */
  openFrames: 50,
  /** >=20f feel-pillar telegraph before the head slams down the rail. */
  telegraphFrames: 24,
  /** How long the crusher stays extended (lethal, blocking) before retracting. */
  extendedFrames: 30,
  /** Visual slide duration for the head moving between retracted/extended. */
  travelMs: 140,
} as const;

export const risingLavaTuning = {
  /**
   * GDD (M4.2 prompt): "chase speed in config, NEVER faster than the
   * dash-less run" - playerTuning.run.speed is 90px/s; kept well under
   * that (see DECISIONS.md) so a player who keeps moving upward at a
   * normal climbing pace always stays ahead with real margin.
   */
  riseSpeedPxPerSec: 50,
} as const;
