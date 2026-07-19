import { describe, expect, it } from 'vitest';
import {
  WeaponEnergyBank,
  WeaponSlotCycle,
  WEAPON_SLOTS,
  StickyTracker,
  selectChainTarget,
  selectSplashTargets,
  computeBoomerangPhase,
  turnGroundWaveAtWall,
  computeDotTickCount,
  computeDotTotalDamage,
} from './weapons';
import { WEAPON_ORDER } from '@/data/weaknessWheel';

describe('WeaponEnergyBank', () => {
  it('starts every weapon at max energy, independently tracked', () => {
    const bank = new WeaponEnergyBank(28);
    for (const id of WEAPON_ORDER) {
      expect(bank.getEnergy(id)).toBe(28);
    }
    expect(bank.getMaxEnergy()).toBe(28);
  });

  it('spend deducts exactly the cost when affordable', () => {
    const bank = new WeaponEnergyBank(28);
    const spent = bank.spend('voltChain', 10);
    expect(spent).toBe(true);
    expect(bank.getEnergy('voltChain')).toBe(18);
  });

  it('spend refuses and leaves energy unchanged when insufficient (no partial spend)', () => {
    const bank = new WeaponEnergyBank(10);
    bank.spend('voltChain', 8); // 10 -> 2
    const spent = bank.spend('voltChain', 5); // can't afford
    expect(spent).toBe(false);
    expect(bank.getEnergy('voltChain')).toBe(2);
  });

  it("canAfford matches spend's own affordability check exactly", () => {
    const bank = new WeaponEnergyBank(4);
    expect(bank.canAfford('tideBurst', 4)).toBe(true);
    expect(bank.canAfford('tideBurst', 5)).toBe(false);
    bank.spend('tideBurst', 4);
    expect(bank.canAfford('tideBurst', 1)).toBe(false);
  });

  it('spending never goes negative even at exactly zero energy', () => {
    const bank = new WeaponEnergyBank(2);
    bank.spend('magmaCharge', 2);
    expect(bank.getEnergy('magmaCharge')).toBe(0);
    expect(bank.spend('magmaCharge', 1)).toBe(false);
    expect(bank.getEnergy('magmaCharge')).toBe(0);
  });

  it('refill adds energy but clamps at the max, never overfilling', () => {
    const bank = new WeaponEnergyBank(28);
    bank.spend('frostTalon', 20); // 28 -> 8
    bank.refill('frostTalon', 5); // 8 -> 13
    expect(bank.getEnergy('frostTalon')).toBe(13);
    bank.refill('frostTalon', 100); // clamps at max
    expect(bank.getEnergy('frostTalon')).toBe(28);
  });

  it('refillAll tops every weapon back up to max independently', () => {
    const bank = new WeaponEnergyBank(28);
    bank.spend('voltChain', 20);
    bank.spend('umbraClaw', 28);
    bank.refillAll();
    for (const id of WEAPON_ORDER) {
      expect(bank.getEnergy(id)).toBe(28);
    }
  });

  it("spending one weapon never affects any other weapon's energy", () => {
    const bank = new WeaponEnergyBank(28);
    bank.spend('galeCutter', 28);
    expect(bank.getEnergy('galeCutter')).toBe(0);
    for (const id of WEAPON_ORDER) {
      if (id !== 'galeCutter') expect(bank.getEnergy(id)).toBe(28);
    }
  });
});

describe('WeaponSlotCycle', () => {
  it('starts on buster', () => {
    const cycle = new WeaponSlotCycle();
    expect(cycle.current).toBe('buster');
  });

  it('next() advances through WEAPON_SLOTS in order and wraps back to buster', () => {
    const cycle = new WeaponSlotCycle();
    for (let i = 1; i < WEAPON_SLOTS.length; i += 1) {
      expect(cycle.next()).toBe(WEAPON_SLOTS[i]);
    }
    expect(cycle.next()).toBe('buster'); // wraps
  });

  it('prev() steps backward and wraps to the last slot', () => {
    const cycle = new WeaponSlotCycle();
    expect(cycle.prev()).toBe(WEAPON_SLOTS[WEAPON_SLOTS.length - 1]);
  });

  it('next() then prev() returns to the original slot', () => {
    const cycle = new WeaponSlotCycle();
    cycle.next();
    cycle.next();
    const mid = cycle.current;
    cycle.next();
    expect(cycle.prev()).toBe(mid);
  });

  it('skips locked slots, staying on the current one if everything else is locked', () => {
    const cycle = new WeaponSlotCycle((slot) => slot === 'buster' || slot === 'terraSpike');
    expect(cycle.current).toBe('buster');
    expect(cycle.next()).toBe('terraSpike'); // skips every other locked weapon
    expect(cycle.next()).toBe('buster');
  });

  it('stays put if nothing besides the current slot is unlocked', () => {
    const cycle = new WeaponSlotCycle((slot) => slot === 'buster');
    expect(cycle.next()).toBe('buster');
    expect(cycle.prev()).toBe('buster');
  });
});

describe('selectChainTarget (Volt Chain)', () => {
  it('picks the nearest candidate within range', () => {
    const impact = { x: 0, y: 0 };
    const candidates = [
      { x: 100, y: 0 }, // out of range
      { x: 30, y: 0 }, // in range, nearer
      { x: 40, y: 0 }, // in range, farther
    ];
    expect(selectChainTarget(impact, candidates, 56)).toBe(1);
  });

  it('returns null when nothing is within range', () => {
    expect(selectChainTarget({ x: 0, y: 0 }, [{ x: 200, y: 0 }], 56)).toBeNull();
  });

  it('returns null for an empty candidate list', () => {
    expect(selectChainTarget({ x: 0, y: 0 }, [], 56)).toBeNull();
  });

  it('treats the range as inclusive at the exact boundary', () => {
    expect(selectChainTarget({ x: 0, y: 0 }, [{ x: 56, y: 0 }], 56)).toBe(0);
  });
});

describe('selectSplashTargets (Tide Burst)', () => {
  it('returns every candidate within the splash radius, in index order', () => {
    const impact = { x: 0, y: 0 };
    const candidates = [
      { x: 10, y: 0 }, // in range
      { x: 100, y: 0 }, // out of range
      { x: -20, y: 0 }, // in range
    ];
    expect(selectSplashTargets(impact, candidates, 24)).toEqual([0, 2]);
  });

  it('returns an empty array when nothing is in range', () => {
    expect(selectSplashTargets({ x: 0, y: 0 }, [{ x: 500, y: 0 }], 24)).toEqual([]);
  });
});

describe('computeBoomerangPhase (Gale Cutter)', () => {
  it('is outbound before reaching max range', () => {
    expect(computeBoomerangPhase(0, 100)).toBe('outbound');
    expect(computeBoomerangPhase(99, 100)).toBe('outbound');
  });

  it('flips to returning at and beyond max range', () => {
    expect(computeBoomerangPhase(100, 100)).toBe('returning');
    expect(computeBoomerangPhase(150, 100)).toBe('returning');
  });
});

describe('turnGroundWaveAtWall (Terra Spike)', () => {
  it('turns from horizontal to vertical', () => {
    expect(turnGroundWaveAtWall('horizontal')).toBe('vertical');
  });

  it('stays vertical once already turned (turns exactly once)', () => {
    expect(turnGroundWaveAtWall('vertical')).toBe('vertical');
  });
});

describe('StickyTracker (Venom Sting: one dart per enemy)', () => {
  it('allows sticking to a fresh target', () => {
    const tracker = new StickyTracker<string>();
    expect(tracker.canStick('enemyA')).toBe(true);
  });

  it('refuses a second stick to an already-stuck target', () => {
    const tracker = new StickyTracker<string>();
    tracker.markStuck('enemyA');
    expect(tracker.canStick('enemyA')).toBe(false);
  });

  it('does not affect other targets', () => {
    const tracker = new StickyTracker<string>();
    tracker.markStuck('enemyA');
    expect(tracker.canStick('enemyB')).toBe(true);
  });

  it('clear() frees the target up to be stuck again', () => {
    const tracker = new StickyTracker<string>();
    tracker.markStuck('enemyA');
    tracker.clear('enemyA');
    expect(tracker.canStick('enemyA')).toBe(true);
  });
});

describe('DoT tick math (Venom Sting)', () => {
  it('computes the whole number of ticks that fit in the duration', () => {
    expect(computeDotTickCount(2000, 500)).toBe(4);
    expect(computeDotTickCount(2100, 500)).toBe(4); // partial tick doesn't count
  });

  it('computes total DoT damage as damage-per-tick times tick count', () => {
    expect(computeDotTotalDamage(1, 2000, 500)).toBe(4);
    expect(computeDotTotalDamage(2, 2000, 500)).toBe(8);
  });
});
