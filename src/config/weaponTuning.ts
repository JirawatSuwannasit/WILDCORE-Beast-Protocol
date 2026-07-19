/**
 * All boss-weapon tuning (rule #4: no hardcoded gameplay numbers). GDD
 * §5/§3 describe each weapon's *behavior* ("lobbed splash arc", "chains
 * to 1 nearby enemy", "freezes minor enemies into temporary platforms
 * for 3s", "10 i-frames") but not its exact numbers - those are this
 * milestone's judgment calls, logged in DECISIONS.md. `behavior` picks
 * which state machine `src/actors/WeaponController.ts` runs for that
 * weapon; everything else is that behavior's parameters.
 */
export type WeaponBehaviorKind =
  | 'bolt' // Volt Chain: straight shot, chains to 1 nearby enemy on hit
  | 'lobbed' // Tide Burst: gravity arc, splash damage on impact
  | 'pierceCarry' // Magma Charge: piercing ram-shot, carries the player forward
  | 'freezeShuriken' // Frost Talon: straight shot, freezes minor enemies into a platform
  | 'boomerang' // Gale Cutter: travels out, then returns to the thrower
  | 'stickyDot' // Venom Sting: sticks to target, damage-over-time, one per enemy
  | 'groundWave' // Terra Spike: travels the floor, turns to climb a wall
  | 'dashSlash'; // Umbra Claw: short player-carrying melee hitbox with i-frames

/**
 * Shared weapon-energy economy (GDD §2.3: "weapon energy per weapon;
 * small/large pickups from enemies; refills between Stage Select
 * visits" - no numbers given). 28 units per weapon mirrors the genre's
 * classic weapon-energy-bar convention; pickups sized so a handful of
 * kills meaningfully replenishes a weapon without trivializing the
 * resource. Every weapon shares this same cap - only firing cost varies.
 */
export const weaponEnergyTuning = {
  maxEnergy: 28,
  pickupSmall: 2,
  pickupLarge: 8,
} as const;

export interface WeaponTuningEntry {
  readonly behavior: WeaponBehaviorKind;
  readonly energyCost: number;
  readonly damage: number;
  readonly speed: number;
  readonly size: number;
  readonly maxFlightMs: number;
}

export interface BoltTuning extends WeaponTuningEntry {
  readonly behavior: 'bolt';
  readonly chainRangePx: number;
  readonly chainDamage: number;
}

export interface LobbedTuning extends WeaponTuningEntry {
  readonly behavior: 'lobbed';
  readonly gravity: number;
  readonly splashRadiusPx: number;
  readonly splashDamage: number;
}

export interface PierceCarryTuning extends WeaponTuningEntry {
  readonly behavior: 'pierceCarry';
  readonly carryDistancePx: number;
  readonly carryFrames: number;
}

export interface FreezeShurikenTuning extends WeaponTuningEntry {
  readonly behavior: 'freezeShuriken';
  readonly freezeDurationMs: number;
}

export interface BoomerangTuning extends WeaponTuningEntry {
  readonly behavior: 'boomerang';
  readonly maxRangePx: number;
}

export interface StickyDotTuning extends WeaponTuningEntry {
  readonly behavior: 'stickyDot';
  readonly dotDamage: number;
  readonly dotTickMs: number;
  readonly dotDurationMs: number;
}

export interface GroundWaveTuning extends WeaponTuningEntry {
  readonly behavior: 'groundWave';
  readonly maxRangePx: number;
  /** Keeps it riding the floor (like the player) until it hits a wall and turns to climb. */
  readonly gravity: number;
}

export interface DashSlashTuning extends WeaponTuningEntry {
  readonly behavior: 'dashSlash';
  readonly dashDistancePx: number;
  readonly dashFrames: number;
  readonly iFrames: number;
  readonly hitboxWidth: number;
  readonly hitboxHeight: number;
}

export const weaponTuning: {
  voltChain: BoltTuning;
  tideBurst: LobbedTuning;
  magmaCharge: PierceCarryTuning;
  frostTalon: FreezeShurikenTuning;
  galeCutter: BoomerangTuning;
  venomSting: StickyDotTuning;
  terraSpike: GroundWaveTuning;
  umbraClaw: DashSlashTuning;
} = {
  voltChain: {
    behavior: 'bolt',
    energyCost: 2,
    damage: 2,
    speed: 240,
    size: 4,
    maxFlightMs: 700,
    chainRangePx: 56, // 3.5 tiles - reaches a second enemy standing just past the first
    chainDamage: 2,
  },
  tideBurst: {
    behavior: 'lobbed',
    energyCost: 2,
    damage: 2,
    speed: 140,
    size: 7,
    maxFlightMs: 1400,
    gravity: 480,
    splashRadiusPx: 24,
    splashDamage: 1,
  },
  magmaCharge: {
    behavior: 'pierceCarry',
    energyCost: 4,
    damage: 3,
    speed: 200,
    size: 10,
    maxFlightMs: 500, // "short" ram-shot - a fraction of the buster's 2000ms max flight
    carryDistancePx: 24, // GDD §5 prompt: "carrying the player 24px"
    carryFrames: 14,
  },
  frostTalon: {
    behavior: 'freezeShuriken',
    energyCost: 2,
    damage: 2,
    speed: 220,
    size: 5,
    maxFlightMs: 700,
    freezeDurationMs: 3000, // GDD §3.4/§5 prompt: "freezes ... for 3s"
  },
  galeCutter: {
    behavior: 'boomerang',
    energyCost: 2,
    damage: 2,
    speed: 200,
    size: 6,
    maxFlightMs: 1600,
    maxRangePx: 100,
  },
  venomSting: {
    behavior: 'stickyDot',
    energyCost: 2,
    damage: 1,
    speed: 180,
    size: 4,
    maxFlightMs: 900,
    dotDamage: 1,
    dotTickMs: 500,
    dotDurationMs: 2000, // 4 ticks -> +4 damage over 2s, on top of the 1 direct hit
  },
  terraSpike: {
    behavior: 'groundWave',
    energyCost: 2,
    damage: 2,
    speed: 130,
    size: 8,
    maxFlightMs: 1800,
    maxRangePx: 140,
    gravity: 900, // matches playerTuning.gravity, so it settles onto the floor at the same rate the player does
  },
  umbraClaw: {
    behavior: 'dashSlash',
    energyCost: 4,
    damage: 3,
    speed: 0, // moved via the carry, not a travelling projectile
    size: 0,
    maxFlightMs: 0,
    dashDistancePx: 32, // "short-range"
    dashFrames: 8,
    iFrames: 10, // GDD §5 prompt: "10 i-frames"
    hitboxWidth: 20,
    hitboxHeight: 20,
  },
};
