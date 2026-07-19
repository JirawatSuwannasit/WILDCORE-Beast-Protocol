import { WEAPON_ORDER, type WeaponId } from '@/data/weaknessWheel';
import { weaponEnergyTuning } from '@/config/weaponTuning';

/**
 * Pure weapon-system logic (GDD §5/§2.2 "Weapon Wheel"): energy
 * bookkeeping, Q/E slot cycling, and the small geometry/timing helpers
 * every weapon's behavior state machine needs. Mirrors
 * `src/systems/jumpPhysics.ts`'s split - this file has no Phaser import
 * so it's directly unit-testable; the Phaser-side pooled sprites and
 * scene wiring that actually *use* this logic live in
 * `src/actors/WeaponController.ts` and `src/actors/weapons/`.
 */

// --- Energy -----------------------------------------------------------

/**
 * Tracks each of the 8 weapons' energy independently (GDD §2.3: "weapon
 * energy per weapon"). Spending never goes negative or partially spends;
 * refilling never exceeds the cap.
 */
export class WeaponEnergyBank {
  private readonly maxEnergy: number;
  private readonly energy: Record<WeaponId, number>;

  constructor(maxEnergy: number = weaponEnergyTuning.maxEnergy) {
    this.maxEnergy = maxEnergy;
    this.energy = Object.fromEntries(WEAPON_ORDER.map((id) => [id, maxEnergy])) as Record<
      WeaponId,
      number
    >;
  }

  getEnergy(id: WeaponId): number {
    return this.energy[id];
  }

  getMaxEnergy(): number {
    return this.maxEnergy;
  }

  canAfford(id: WeaponId, cost: number): boolean {
    return this.energy[id] >= cost;
  }

  /** Spends `cost` energy iff affordable; returns whether it fired. Never partially spends. */
  spend(id: WeaponId, cost: number): boolean {
    if (!this.canAfford(id, cost)) return false;
    this.energy[id] -= cost;
    return true;
  }

  refill(id: WeaponId, amount: number): void {
    this.energy[id] = Math.min(this.maxEnergy, this.energy[id] + amount);
  }

  /** GDD §2.3: "refills between Stage Select visits." */
  refillAll(): void {
    for (const id of WEAPON_ORDER) this.energy[id] = this.maxEnergy;
  }
}

// --- Slot cycling (Q/E weapon wheel) -----------------------------------

export type WeaponSlot = 'buster' | WeaponId;

/** Every fireable slot in wheel order, buster first - buster is always available, never locked. */
export const WEAPON_SLOTS: readonly WeaponSlot[] = ['buster', ...WEAPON_ORDER];

/**
 * Cycles through `WEAPON_SLOTS`, skipping any slot `isUnlocked` rejects
 * (weapons are earned from bosses per GDD §2.1 step 3 - there's no
 * save/progression system yet to source real unlock state from, so the
 * default predicate accepts everything; see DECISIONS.md). Wraps in
 * both directions; if every other slot is locked, stays on the current one.
 */
export class WeaponSlotCycle {
  private index = 0;

  constructor(private readonly isUnlocked: (slot: WeaponSlot) => boolean = () => true) {}

  get current(): WeaponSlot {
    return WEAPON_SLOTS[this.index] ?? 'buster';
  }

  next(): WeaponSlot {
    this.index = this.step(1);
    return this.current;
  }

  prev(): WeaponSlot {
    this.index = this.step(-1);
    return this.current;
  }

  private step(direction: 1 | -1): number {
    let candidate = this.index;
    for (let i = 0; i < WEAPON_SLOTS.length; i += 1) {
      candidate = (candidate + direction + WEAPON_SLOTS.length) % WEAPON_SLOTS.length;
      const slot = WEAPON_SLOTS[candidate];
      if (slot !== undefined && this.isUnlocked(slot)) return candidate;
    }
    return this.index;
  }
}

// --- Per-weapon behavior helpers ---------------------------------------

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Volt Chain: "chains to 1 nearby enemy" - nearest candidate within
 * range, or null if none qualify. `candidates` should exclude the
 * primary target already hit.
 */
export function selectChainTarget(
  impact: Point2D,
  candidates: readonly Point2D[],
  rangePx: number,
): number | null {
  let bestIndex: number | null = null;
  let bestDistSq = rangePx * rangePx;

  candidates.forEach((candidate, index) => {
    const dx = candidate.x - impact.x;
    const dy = candidate.y - impact.y;
    const distSq = dx * dx + dy * dy;
    if (distSq <= bestDistSq) {
      bestDistSq = distSq;
      bestIndex = index;
    }
  });

  return bestIndex;
}

/** Tide Burst: "lobbed splash arc" - every candidate within splash radius of the impact point. */
export function selectSplashTargets(
  impact: Point2D,
  candidates: readonly Point2D[],
  radiusPx: number,
): number[] {
  const radiusSq = radiusPx * radiusPx;
  const indices: number[] = [];

  candidates.forEach((candidate, index) => {
    const dx = candidate.x - impact.x;
    const dy = candidate.y - impact.y;
    if (dx * dx + dy * dy <= radiusSq) indices.push(index);
  });

  return indices;
}

export type BoomerangPhase = 'outbound' | 'returning';

/** Gale Cutter: "boomerang ... returns" - flips to returning once it's traveled its max range. */
export function computeBoomerangPhase(
  distanceTraveledPx: number,
  maxRangePx: number,
): BoomerangPhase {
  return distanceTraveledPx >= maxRangePx ? 'returning' : 'outbound';
}

export type GroundWaveAxis = 'horizontal' | 'vertical';

/** Terra Spike: "ground wave that travels floor -> walls" - turns to vertical exactly once, at a wall. */
export function turnGroundWaveAtWall(currentAxis: GroundWaveAxis): GroundWaveAxis {
  return currentAxis === 'horizontal' ? 'vertical' : currentAxis;
}

/** Venom Sting: "one [dart] per enemy" - a small generic membership tracker, keyed by whatever identity the caller uses (e.g. an Enemy instance). */
export class StickyTracker<T> {
  private readonly stuck = new Set<T>();

  canStick(target: T): boolean {
    return !this.stuck.has(target);
  }

  markStuck(target: T): void {
    this.stuck.add(target);
  }

  clear(target: T): void {
    this.stuck.delete(target);
  }
}

/** Venom Sting DoT: number of whole ticks that fit in the DoT's duration. */
export function computeDotTickCount(durationMs: number, tickMs: number): number {
  return Math.floor(durationMs / tickMs);
}

/** Venom Sting DoT: total damage dealt over the full duration (ticks only, excludes the initial direct hit). */
export function computeDotTotalDamage(
  damagePerTick: number,
  durationMs: number,
  tickMs: number,
): number {
  return damagePerTick * computeDotTickCount(durationMs, tickMs);
}
