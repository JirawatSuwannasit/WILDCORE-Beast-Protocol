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
