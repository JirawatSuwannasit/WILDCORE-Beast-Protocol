import { describe, expect, it } from 'vitest';
import {
  WEAKNESS_WHEEL,
  WEAPON_ORDER,
  WEAPON_UTILITY_TAG,
  WEAKNESS_DAMAGE,
  getWeaknessEntry,
  isWeakness,
  getUtilityTag,
  weaknessReactionAnimKey,
  type UtilityTag,
} from './weaknessWheel';

/** GDD §5 table, copied verbatim for a byte-for-byte comparison against the data file. */
const GDD_TABLE = [
  {
    boss: 'voltCheetah',
    stage: 'Speedway Savanna',
    weaponGained: 'voltChain',
    weakTo: 'umbraClaw',
  },
  { boss: 'tideManta', stage: 'Coral Reservoir', weaponGained: 'tideBurst', weakTo: 'voltChain' },
  { boss: 'magmaRhino', stage: 'Ember Foundry', weaponGained: 'magmaCharge', weakTo: 'tideBurst' },
  {
    boss: 'frostOwl',
    stage: 'Aurora Observatory',
    weaponGained: 'frostTalon',
    weakTo: 'magmaCharge',
  },
  { boss: 'galeFalcon', stage: 'Skyhaven Ruins', weaponGained: 'galeCutter', weakTo: 'frostTalon' },
  {
    boss: 'venomMantis',
    stage: 'Bloom Greenhouse',
    weaponGained: 'venomSting',
    weakTo: 'galeCutter',
  },
  {
    boss: 'terraPangolin',
    stage: 'Hollow Quarry',
    weaponGained: 'terraSpike',
    weakTo: 'venomSting',
  },
  {
    boss: 'shadowPanther',
    stage: 'Eclipse District',
    weaponGained: 'umbraClaw',
    weakTo: 'terraSpike',
  },
] as const;

describe('WEAKNESS_WHEEL', () => {
  it('has exactly 8 entries, one per boss', () => {
    expect(WEAKNESS_WHEEL).toHaveLength(8);
  });

  it('matches the GDD §5 table exactly (boss, stage, weaponGained, weakTo)', () => {
    const actual = WEAKNESS_WHEEL.map(({ boss, stage, weaponGained, weakTo }) => ({
      boss,
      stage,
      weaponGained,
      weakTo,
    }));
    expect(actual).toEqual(GDD_TABLE);
  });

  it('every weapon is gained by exactly one boss (no duplicates, full coverage)', () => {
    const gained = WEAKNESS_WHEEL.map((e) => e.weaponGained);
    expect(new Set(gained).size).toBe(8);
  });

  it("closes the ring: each entry's weakTo is some other entry's weaponGained", () => {
    const gainedSet = new Set(WEAKNESS_WHEEL.map((e) => e.weaponGained));
    for (const entry of WEAKNESS_WHEEL) {
      expect(gainedSet.has(entry.weakTo)).toBe(true);
      expect(entry.weakTo).not.toBe(entry.weaponGained); // nothing is weak to itself
    }
  });

  it('the ring loop closes exactly as GDD §3 describes it (Shadow Panther weak to Terra Spike, looping back to Volt Cheetah being weak to Umbra Claw - the last weapon gained)', () => {
    const last = WEAKNESS_WHEEL[WEAKNESS_WHEEL.length - 1];
    const first = WEAKNESS_WHEEL[0];
    expect(last?.weaponGained).toBe(first?.weakTo);
  });
});

describe('WEAPON_ORDER', () => {
  it('derives from WEAKNESS_WHEEL in wheel order, one entry per weapon', () => {
    expect(WEAPON_ORDER).toEqual(WEAKNESS_WHEEL.map((e) => e.weaponGained));
    expect(WEAPON_ORDER).toHaveLength(8);
  });
});

describe('WEAPON_UTILITY_TAG', () => {
  it('is a complete 1:1 bijection over the 8 weapons and 8 utility tags', () => {
    const tags = Object.values(WEAPON_UTILITY_TAG);
    expect(tags).toHaveLength(8);
    expect(new Set(tags).size).toBe(8); // every tag used exactly once
  });

  it('covers every UtilityTag exactly once', () => {
    const expectedTags: UtilityTag[] = [
      'power',
      'douse',
      'melt',
      'freeze',
      'cut',
      'corrode',
      'quake',
      'phase',
    ];
    const actualTags = Object.values(WEAPON_UTILITY_TAG).sort();
    expect(actualTags).toEqual([...expectedTags].sort());
  });

  it('getUtilityTag matches WEAPON_UTILITY_TAG for every weapon', () => {
    for (const weaponId of WEAPON_ORDER) {
      expect(getUtilityTag(weaponId)).toBe(WEAPON_UTILITY_TAG[weaponId]);
    }
  });
});

describe('WEAKNESS_DAMAGE', () => {
  it('is 4, per GDD §4 ("Weakness hits: 4 damage + interrupt + unique reaction animation")', () => {
    expect(WEAKNESS_DAMAGE).toBe(4);
  });
});

describe('getWeaknessEntry / isWeakness', () => {
  it('returns the correct entry for a known boss', () => {
    expect(getWeaknessEntry('voltCheetah')).toEqual(WEAKNESS_WHEEL[0]);
  });

  it('throws for an unknown boss id', () => {
    // @ts-expect-error - deliberately passing an invalid id to exercise the guard
    expect(() => getWeaknessEntry('notABoss')).toThrow();
  });

  it('isWeakness is true only for the exact weakness weapon', () => {
    expect(isWeakness('umbraClaw', 'voltCheetah')).toBe(true);
    expect(isWeakness('voltChain', 'voltCheetah')).toBe(false);
    expect(isWeakness('terraSpike', 'shadowPanther')).toBe(true);
  });

  it('isWeakness is false for every non-matching weapon across all 8 bosses', () => {
    for (const entry of WEAKNESS_WHEEL) {
      for (const weaponId of WEAPON_ORDER) {
        expect(isWeakness(weaponId, entry.boss)).toBe(weaponId === entry.weakTo);
      }
    }
  });
});

describe('weaknessReactionAnimKey', () => {
  it('is keyed per boss, not per weapon (GDD §4: "unique reaction animation" belongs to the boss)', () => {
    expect(weaknessReactionAnimKey('voltCheetah')).toBe('voltCheetah-weakness-reaction');
    expect(weaknessReactionAnimKey('shadowPanther')).toBe('shadowPanther-weakness-reaction');
  });
});
