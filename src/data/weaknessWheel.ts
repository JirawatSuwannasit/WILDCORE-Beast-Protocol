/**
 * The rock-paper-scissors weakness wheel (GDD §5) and the utility-tag
 * table each boss weapon unlocks (GDD §3.1-3.8 prose - "Utility: powers
 * dead machinery", "douses fires", etc.). Pure data, no Phaser import,
 * so it's directly unit-testable against the GDD table and importable
 * from anywhere (actors, scenes, config) the same way `TILE_SIZE` is.
 */

export type WeaponId =
  | 'voltChain'
  | 'tideBurst'
  | 'magmaCharge'
  | 'frostTalon'
  | 'galeCutter'
  | 'venomSting'
  | 'terraSpike'
  | 'umbraClaw';

export type BossId =
  | 'voltCheetah'
  | 'tideManta'
  | 'magmaRhino'
  | 'frostOwl'
  | 'galeFalcon'
  | 'venomMantis'
  | 'terraPangolin'
  | 'shadowPanther';

/**
 * Utility hooks a weapon triggers on tagged stage objects (GDD §3 prose,
 * one tag per weapon). "phase" isn't spelled out in prose for Umbra Claw
 * the way the other seven are ("powers"/"douses"/"melts"/etc.) - it's
 * inferred from its own description ("short-range dash-slash with
 * i-frames") and is the only tag left unassigned once the other seven are
 * read off their stage sections. Logged here rather than silently: see
 * DECISIONS.md.
 */
export type UtilityTag =
  'power' | 'douse' | 'melt' | 'freeze' | 'cut' | 'corrode' | 'quake' | 'phase';

export interface WeaknessEntry {
  readonly boss: BossId;
  readonly stage: string;
  readonly weaponGained: WeaponId;
  readonly weakTo: WeaponId;
  readonly utilityTag: UtilityTag;
}

/**
 * Exact copy of the GDD §5 table, in ring order (top-to-bottom here
 * matches the §3 "Umbra Claw -> Volt Cheetah -> Volt Chain -> ..." loop
 * diagram read one weapon-gain at a time). Do not reorder or reword -
 * `weaknessWheel.test.ts` checks this against the table verbatim.
 */
export const WEAKNESS_WHEEL: readonly WeaknessEntry[] = [
  {
    boss: 'voltCheetah',
    stage: 'Speedway Savanna',
    weaponGained: 'voltChain',
    weakTo: 'umbraClaw',
    utilityTag: 'power',
  },
  {
    boss: 'tideManta',
    stage: 'Coral Reservoir',
    weaponGained: 'tideBurst',
    weakTo: 'voltChain',
    utilityTag: 'douse',
  },
  {
    boss: 'magmaRhino',
    stage: 'Ember Foundry',
    weaponGained: 'magmaCharge',
    weakTo: 'tideBurst',
    utilityTag: 'melt',
  },
  {
    boss: 'frostOwl',
    stage: 'Aurora Observatory',
    weaponGained: 'frostTalon',
    weakTo: 'magmaCharge',
    utilityTag: 'freeze',
  },
  {
    boss: 'galeFalcon',
    stage: 'Skyhaven Ruins',
    weaponGained: 'galeCutter',
    weakTo: 'frostTalon',
    utilityTag: 'cut',
  },
  {
    boss: 'venomMantis',
    stage: 'Bloom Greenhouse',
    weaponGained: 'venomSting',
    weakTo: 'galeCutter',
    utilityTag: 'corrode',
  },
  {
    boss: 'terraPangolin',
    stage: 'Hollow Quarry',
    weaponGained: 'terraSpike',
    weakTo: 'venomSting',
    utilityTag: 'quake',
  },
  {
    boss: 'shadowPanther',
    stage: 'Eclipse District',
    weaponGained: 'umbraClaw',
    weakTo: 'terraSpike',
    utilityTag: 'phase',
  },
];

/** Weapon-gain order, derived (not re-typed) from the wheel so the two can never drift apart. */
export const WEAPON_ORDER: readonly WeaponId[] = WEAKNESS_WHEEL.map((entry) => entry.weaponGained);

export const WEAPON_UTILITY_TAG: Readonly<Record<WeaponId, UtilityTag>> = Object.fromEntries(
  WEAKNESS_WHEEL.map((entry) => [entry.weaponGained, entry.utilityTag]),
) as Record<WeaponId, UtilityTag>;

/** GDD §4: every boss weakness hit is this much damage, regardless of which boss or weapon. */
export const WEAKNESS_DAMAGE = 4;

export function getWeaknessEntry(bossId: BossId): WeaknessEntry {
  const entry = WEAKNESS_WHEEL.find((e) => e.boss === bossId);
  if (!entry) throw new Error(`weaknessWheel: unknown boss id "${bossId}"`);
  return entry;
}

export function isWeakness(weaponId: WeaponId, bossId: BossId): boolean {
  return getWeaknessEntry(bossId).weakTo === weaponId;
}

export function getUtilityTag(weaponId: WeaponId): UtilityTag {
  return WEAPON_UTILITY_TAG[weaponId];
}

/** GDD §4: "unique reaction animation" - keyed per boss (the reaction is the boss's, not the weapon's). */
export function weaknessReactionAnimKey(bossId: BossId): string {
  return `${bossId}-weakness-reaction`;
}
