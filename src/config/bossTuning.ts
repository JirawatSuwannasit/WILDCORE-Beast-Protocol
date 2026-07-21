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

/** ANGLERFISH mid-boss (GDD §3.2: "lamp mimic in a dark tunnel"). Simpler than a full boss - no shutter door/ritual, single-screen arena, no weakness hook. */
export const anglerfishTuning = {
  maxHp: 6,
  contactDamage: 2,

  /** Idles disguised as a hanging lamp - a slow bioluminescent flicker, no threat. */
  mimicFlickerFrames: 40,

  /** GDD feel pillar #4: >=20f telegraph before the lure-lit reveal + lunge. */
  revealTelegraphFrames: 26,
  lungeSpeedX: 130,
  lungeSpeedY: 40,
  lungeFrames: 24,
  retreatSpeed: 60,
  /** Frames back at rest (re-mimicking) before it can lunge again. */
  cooldownFrames: 70,
} as const;

/**
 * TIDE MANTA (GDD §3.2 / §4). 3 core patterns, all dodgeable with the
 * buster alone; weak to Volt Chain (wired via weaknessWheel.ts - it
 * "electrifies the water it swims in", represented as a visual tint
 * during the stun rather than a separate gameplay effect).
 */
export const tideMantaTuning = {
  maxHp: 16,
  fillRitualMs: 1500,
  desperationHpFraction: 0.25,
  weaknessDamage: 4,
  contactDamage: 3,

  sineGlide: {
    telegraphFrames: 24,
    durationFrames: 150,
    speedX: 70,
    amplitudeY: 40,
    periodFrames: 90,
  },

  burrowErupt: {
    burrowFrames: 20,
    travelFrames: 40,
    /** Shadow telegraph under the player before eruption (GDD §3.2: "shadow telegraph"; >=20f). */
    shadowTelegraphFrames: 26,
    eruptVelocityY: -260,
    gravity: 900,
    damage: 3,
  },

  orbRing: {
    telegraphFrames: 24,
    orbCount: 8,
    orbSpeed: 90,
    orbDamage: 2,
  },

  desperation: {
    linkFrames: 10,
  },
} as const;

/**
 * SLAG GOLEM mid-boss (GDD §3.3: "slag golem that re-forms once"). Two HP
 * pools it manages itself (phase1Hp counted outside the base Enemy hp
 * field entirely, so a first "defeat" never actually zeroes the real hp/
 * isDead the scene reads - see SlagGolem.ts) - only the second pool maps
 * onto the base Enemy's real hp, so onDeath/onDefeated fire exactly once,
 * on the genuine final kill. No shutter door/ritual/weakness, same as
 * Anglerfish - a real mid-boss fight, but simpler than a full boss.
 */
export const slagGolemTuning = {
  phase1Hp: 5,
  phase2Hp: 5,
  contactDamage: 2,
  /** Crumble -> re-form animation length (mirrors a boss fill-ritual's scale). */
  reformFrames: 90,
  lumberSpeed: 16,
  patrolRangeX: 50,
  /** >=20f telegraph before the ground-pound (glowing cracks spreading up the arms). */
  slamTelegraphFrames: 26,
  slamRecoverFrames: 40,
  /** Radius (px) of the readable ground-pound AOE. */
  slamRangeX: 30,
  slamDamage: 2,
  attackCooldownFrames: 90,
} as const;

/**
 * MAGMA RHINO (GDD §3.3 / §4). 3 core patterns, all dodgeable with the
 * buster alone; weak to Tide Burst ("extinguishes his charge flame" -
 * interrupt + 4 damage, same fixed-damage weakness contract as every
 * other boss).
 */
export const magmaRhinoTuning = {
  maxHp: 16,
  fillRitualMs: 1500,
  desperationHpFraction: 0.25,
  weaknessDamage: 4,
  contactDamage: 3,

  ramCharge: {
    telegraphFrames: 28,
    speed: 160,
    /** GDD §3.3: "cracks the wall leaving a brief stun opening" - a genuine free-hit window, not just a recovery pause. */
    wallStunFrames: 55,
  },

  lavaGeysers: {
    /** >=20f telegraph (ground glow/crack) before each geyser in the sequence erupts. */
    telegraphFrames: 26,
    eruptFrames: 24,
    /** Frames between one geyser's telegraph starting and the next one's, in the readable sequence. */
    stepFrames: 30,
    damage: 3,
    recoverFrames: 20,
  },

  hornToss: {
    telegraphFrames: 26,
    rockCount: 3,
    rockSpeed: 130,
    damage: 2,
    recoverFrames: 20,
  },

  desperation: {
    linkFrames: 10,
  },
} as const;
