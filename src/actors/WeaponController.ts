import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { getRectTexture } from '@/systems/placeholderTexture';
import { FIXED_DT_MS } from '@/systems/fixedTimestep';
import { EdgeDetector } from '@/systems/edgeDetector';
import type { InputSnapshot } from '@/systems/input';
import { WEAPON_ORDER, getUtilityTag, type UtilityTag, type WeaponId } from '@/data/weaknessWheel';
import {
  weaponTuning,
  type BoltTuning,
  type BoomerangTuning,
  type DashSlashTuning,
  type GroundWaveTuning,
  type LobbedTuning,
  type PierceCarryTuning,
  type StickyDotTuning,
} from '@/config/weaponTuning';
import {
  WeaponEnergyBank,
  WeaponSlotCycle,
  StickyTracker,
  selectChainTarget,
  selectSplashTargets,
  computeBoomerangPhase,
  computeDotTickCount,
  type WeaponSlot,
} from '@/systems/weapons';
import { WeaponEffectSprite } from '@/actors/weapons/WeaponEffectSprite';
import type { Enemy } from '@/actors/Enemy';

const POOL_SIZE = 12;
const WHEEL_UI_DEPTH = 1950;

/** Any stage object a weapon's utility tag can trigger (GDD §3 prose: "powers dead machinery", "cuts ropes", ...). */
export interface TaggedUtility {
  readonly requiredTag: UtilityTag;
  tryActivate(tag: UtilityTag): boolean;
}

const WEAPON_COLOR: Record<WeaponId, number> = {
  voltChain: THEME.accentAmber,
  tideBurst: THEME.accentTeal,
  magmaCharge: THEME.accentCoral,
  frostTalon: THEME.accentTeal,
  galeCutter: THEME.moss,
  venomSting: THEME.moss,
  terraSpike: THEME.panel,
  umbraClaw: THEME.accentCoral,
};

function msToFrames(ms: number): number {
  return Math.round(ms / FIXED_DT_MS);
}

/**
 * Owns the 8 boss weapons (GDD §5): energy, the Q/E weapon wheel
 * (buster + 8 weapons in a ring), firing dispatch per weapon's behavior,
 * and per-frame stepping of every active effect's behavior state
 * machine (boomerang turn-and-return, ground-wave wall turn, sticky
 * DoT ticking). Constructed by `Player` exactly like `BusterWeapon`;
 * the owning scene registers overlaps against `hitboxes` the same way
 * it already does for `player.buster.projectiles`.
 */
export class WeaponController {
  private readonly pool: WeaponEffectSprite[];
  private readonly energyBank = new WeaponEnergyBank();
  private readonly slotCycle = new WeaponSlotCycle();
  private readonly stickyTracker = new StickyTracker<Enemy>();

  private readonly nextEdge = new EdgeDetector();
  private readonly prevEdge = new EdgeDetector();
  private readonly fireEdge = new EdgeDetector();

  private readonly hudText: Phaser.GameObjects.Text;
  private readonly wheelBackdrop: Phaser.GameObjects.Rectangle;
  private readonly wheelTexts: Phaser.GameObjects.Text[];

  constructor(private readonly scene: Phaser.Scene) {
    this.pool = Array.from({ length: POOL_SIZE }, () => new WeaponEffectSprite(scene));

    this.hudText = scene.add
      .text(6, scene.scale.height - 12, '', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: THEME.textCream,
      })
      .setScrollFactor(0)
      .setDepth(WHEEL_UI_DEPTH);

    const wheelLines = ['buster', ...WEAPON_ORDER];
    this.wheelBackdrop = scene.add
      .rectangle(
        scene.scale.width / 2,
        scene.scale.height / 2,
        120,
        wheelLines.length * 10 + 8,
        0x000000,
        0.75,
      )
      .setScrollFactor(0)
      .setDepth(WHEEL_UI_DEPTH)
      .setVisible(false);
    this.wheelTexts = wheelLines.map((slot, index) =>
      scene.add
        .text(
          scene.scale.width / 2,
          scene.scale.height / 2 - (wheelLines.length * 10) / 2 + index * 10 + 5,
          slot,
          { fontFamily: 'monospace', fontSize: '8px', color: THEME.textCream },
        )
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(WHEEL_UI_DEPTH + 1)
        .setVisible(false),
    );

    this.updateHud();
  }

  /** Every pooled effect (for scene overlap registration - mirrors `buster.projectiles`), active or not. */
  get hitboxes(): readonly WeaponEffectSprite[] {
    return this.pool;
  }

  get currentSlot(): WeaponSlot {
    return this.slotCycle.current;
  }

  get isBusterActive(): boolean {
    return this.currentSlot === 'buster';
  }

  /** Shows/hides the pause weapon wheel (GDD §2.2: "or pause wheel") - call from the owning scene's pause toggle. */
  setPaused(paused: boolean): void {
    this.wheelBackdrop.setVisible(paused);
    if (!paused) {
      for (const text of this.wheelTexts) text.setVisible(false);
      return;
    }
    const current = this.currentSlot;
    const wheelLines = ['buster', ...WEAPON_ORDER];
    this.wheelTexts.forEach((text, index) => {
      text.setVisible(true);
      text.setColor(wheelLines[index] === current ? THEME.textCream : '#7a6c86');
    });
  }

  fixedUpdate(
    input: InputSnapshot,
    originX: number,
    originY: number,
    direction: 1 | -1,
    playerX: number,
    playerY: number,
    applyCarry: (velocityX: number, frames: number) => void,
    grantIFrames: (frames: number) => void,
  ): void {
    if (this.nextEdge.update(input.weaponNextHeld).justPressed) {
      this.slotCycle.next();
      this.updateHud();
    }
    if (this.prevEdge.update(input.weaponPrevHeld).justPressed) {
      this.slotCycle.prev();
      this.updateHud();
    }

    for (const effect of this.pool) {
      if (effect.active) this.stepEffect(effect, playerX, playerY);
    }

    const fireEdgeState = this.fireEdge.update(input.shootHeld);
    if (!this.isBusterActive && fireEdgeState.justPressed) {
      this.tryFire(
        this.currentSlot as WeaponId,
        originX,
        originY,
        direction,
        applyCarry,
        grantIFrames,
      );
    }
  }

  /** Called by the scene's overlap wiring when a hitbox touches an enemy. */
  resolveEnemyHit(effect: WeaponEffectSprite, enemy: Enemy, allEnemies: readonly Enemy[]): void {
    if (!effect.active || !effect.weaponId || enemy.isDead) return;
    if (effect.alreadyHit.has(enemy)) return;
    const weaponId = effect.weaponId;
    const tuning = weaponTuning[weaponId];

    switch (tuning.behavior) {
      case 'bolt': {
        enemy.applyWeaponHit(weaponId, tuning.damage);
        effect.alreadyHit.add(enemy);
        effect.deactivate();
        this.applyChain(weaponId, tuning, enemy, allEnemies);
        break;
      }
      case 'lobbed': {
        enemy.applyWeaponHit(weaponId, tuning.damage);
        effect.alreadyHit.add(enemy);
        effect.deactivate();
        this.applySplash(weaponId, tuning, enemy, allEnemies);
        break;
      }
      case 'pierceCarry': {
        enemy.applyWeaponHit(weaponId, tuning.damage);
        effect.alreadyHit.add(enemy); // pierces through - stays active, won't re-hit this one
        break;
      }
      case 'freezeShuriken': {
        const froze = enemy.freeze(msToFrames(tuning.freezeDurationMs));
        if (!froze) enemy.applyWeaponHit(weaponId, tuning.damage);
        effect.alreadyHit.add(enemy);
        effect.deactivate();
        break;
      }
      case 'boomerang': {
        enemy.applyWeaponHit(weaponId, tuning.damage);
        effect.alreadyHit.add(enemy); // grazes through - keeps flying/returning
        break;
      }
      case 'stickyDot': {
        this.applySticky(weaponId, tuning, effect, enemy);
        break;
      }
      case 'groundWave': {
        enemy.applyWeaponHit(weaponId, tuning.damage);
        effect.alreadyHit.add(enemy); // a wave, not a bullet - keeps traveling
        break;
      }
      case 'dashSlash': {
        enemy.applyWeaponHit(weaponId, tuning.damage);
        effect.alreadyHit.add(enemy);
        break;
      }
    }
  }

  /** Called by the scene's overlap wiring when a hitbox touches a tagged utility object. */
  resolveUtilityHit(effect: WeaponEffectSprite, target: TaggedUtility): void {
    if (!effect.active || !effect.weaponId) return;
    target.tryActivate(getUtilityTag(effect.weaponId));
  }

  /**
   * Terra Spike needs to know when it's hit a wall (not just resting on
   * the floor under gravity) to turn and climb - the scene registers
   * this collider against its own ground/solids group; safe to call on
   * every floor contact too since it only acts when a *side* is blocked.
   */
  onGroundWaveWallContact(effect: WeaponEffectSprite): void {
    if (effect.weaponId !== 'terraSpike' || effect.groundWaveTurned) return;
    const body = effect.body as Phaser.Physics.Arcade.Body;
    if (!body.blocked.left && !body.blocked.right) return;
    effect.groundWaveTurned = true;
    body.setAllowGravity(false);
    body.setVelocity(0, -weaponTuning.terraSpike.speed);
  }

  private updateHud(): void {
    const slot = this.currentSlot;
    if (slot === 'buster') {
      this.hudText.setText('wpn: buster');
    } else {
      this.hudText.setText(
        `wpn: ${slot} [${this.energyBank.getEnergy(slot)}/${this.energyBank.getMaxEnergy()}]`,
      );
    }
  }

  private acquireEffect(): WeaponEffectSprite | undefined {
    return this.pool.find((effect) => !effect.active);
  }

  private tryFire(
    weaponId: WeaponId,
    x: number,
    y: number,
    direction: 1 | -1,
    applyCarry: (velocityX: number, frames: number) => void,
    grantIFrames: (frames: number) => void,
  ): void {
    const tuning = weaponTuning[weaponId];
    if (!this.energyBank.spend(weaponId, tuning.energyCost)) return; // out of energy - silent no-op
    this.updateHud();

    switch (tuning.behavior) {
      case 'bolt':
      case 'freezeShuriken':
        this.fireStraight(weaponId, x, y, direction, tuning.size, tuning.speed, tuning.maxFlightMs);
        break;
      case 'lobbed':
        this.fireLobbed(weaponId, x, y, direction, tuning);
        break;
      case 'boomerang':
        this.fireStraight(weaponId, x, y, direction, tuning.size, tuning.speed, tuning.maxFlightMs);
        break;
      case 'stickyDot':
        this.fireStraight(weaponId, x, y, direction, tuning.size, tuning.speed, tuning.maxFlightMs);
        break;
      case 'groundWave':
        this.fireGroundWave(weaponId, x, y, direction, tuning);
        break;
      case 'pierceCarry':
        this.fireStraight(weaponId, x, y, direction, tuning.size, tuning.speed, tuning.maxFlightMs);
        this.applyPierceCarry(tuning, direction, applyCarry);
        break;
      case 'dashSlash':
        this.fireDashSlash(weaponId, x, y, tuning, direction, applyCarry, grantIFrames);
        break;
    }
  }

  private textureFor(weaponId: WeaponId, size: number): string {
    return getRectTexture(this.scene, `weapon-${weaponId}`, size, size, WEAPON_COLOR[weaponId]);
  }

  private fireStraight(
    weaponId: WeaponId,
    x: number,
    y: number,
    direction: 1 | -1,
    size: number,
    speed: number,
    maxFlightMs: number,
  ): void {
    const effect = this.acquireEffect();
    if (!effect) return;
    effect.fire(weaponId, x, y, this.textureFor(weaponId, size), size, maxFlightMs);
    (effect.body as Phaser.Physics.Arcade.Body).setVelocity(direction * speed, 0);
  }

  private fireLobbed(
    weaponId: WeaponId,
    x: number,
    y: number,
    direction: 1 | -1,
    tuning: LobbedTuning,
  ): void {
    const effect = this.acquireEffect();
    if (!effect) return;
    effect.fire(
      weaponId,
      x,
      y,
      this.textureFor(weaponId, tuning.size),
      tuning.size,
      tuning.maxFlightMs,
    );
    const body = effect.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true);
    body.setGravityY(tuning.gravity);
    body.setVelocity(direction * tuning.speed, -tuning.speed * 0.5);
  }

  private fireGroundWave(
    weaponId: WeaponId,
    x: number,
    y: number,
    direction: 1 | -1,
    tuning: GroundWaveTuning,
  ): void {
    const effect = this.acquireEffect();
    if (!effect) return;
    effect.fire(
      weaponId,
      x,
      y,
      this.textureFor(weaponId, tuning.size),
      tuning.size,
      tuning.maxFlightMs,
    );
    const body = effect.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true);
    body.setGravityY(tuning.gravity);
    body.setVelocity(direction * tuning.speed, 0);
  }

  private applyPierceCarry(
    tuning: PierceCarryTuning,
    direction: 1 | -1,
    applyCarry: (velocityX: number, frames: number) => void,
  ): void {
    const velocityX = direction * (tuning.carryDistancePx / (tuning.carryFrames / 60));
    applyCarry(velocityX, tuning.carryFrames);
  }

  private fireDashSlash(
    weaponId: WeaponId,
    x: number,
    y: number,
    tuning: DashSlashTuning,
    direction: 1 | -1,
    applyCarry: (velocityX: number, frames: number) => void,
    grantIFrames: (frames: number) => void,
  ): void {
    const effect = this.acquireEffect();
    if (!effect) return;
    effect.fire(
      weaponId,
      x,
      y,
      this.textureFor(weaponId, tuning.hitboxWidth),
      tuning.hitboxWidth,
      0,
    );
    (effect.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    effect.activeFramesRemaining = tuning.dashFrames;

    const velocityX = direction * (tuning.dashDistancePx / (tuning.dashFrames / 60));
    applyCarry(velocityX, tuning.dashFrames);
    grantIFrames(tuning.iFrames);
  }

  private applyChain(
    weaponId: WeaponId,
    tuning: BoltTuning,
    hit: Enemy,
    allEnemies: readonly Enemy[],
  ): void {
    const candidates = allEnemies.filter((e) => e !== hit && !e.isDead);
    const index = selectChainTarget(
      { x: hit.x, y: hit.y },
      candidates.map((e) => ({ x: e.x, y: e.y })),
      tuning.chainRangePx,
    );
    if (index === null) return;
    candidates[index]?.applyWeaponHit(weaponId, tuning.chainDamage);
  }

  private applySplash(
    weaponId: WeaponId,
    tuning: LobbedTuning,
    hit: Enemy,
    allEnemies: readonly Enemy[],
  ): void {
    const candidates = allEnemies.filter((e) => e !== hit && !e.isDead);
    const indices = selectSplashTargets(
      { x: hit.x, y: hit.y },
      candidates.map((e) => ({ x: e.x, y: e.y })),
      tuning.splashRadiusPx,
    );
    for (const index of indices) candidates[index]?.applyWeaponHit(weaponId, tuning.splashDamage);
  }

  private applySticky(
    weaponId: WeaponId,
    tuning: StickyDotTuning,
    effect: WeaponEffectSprite,
    enemy: Enemy,
  ): void {
    if (!this.stickyTracker.canStick(enemy)) {
      // GDD §5: "one dart per enemy" - a second dart is a direct hit only, no extra DoT.
      enemy.applyWeaponHit(weaponId, tuning.damage);
      effect.deactivate();
      return;
    }

    enemy.applyWeaponHit(weaponId, tuning.damage);
    this.stickyTracker.markStuck(enemy);
    effect.stuckTo = enemy;
    effect.dotTicksRemaining = computeDotTickCount(tuning.dotDurationMs, tuning.dotTickMs);
    effect.dotTickFramesRemaining = msToFrames(tuning.dotTickMs);
    const body = effect.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setAllowGravity(false);
  }

  private stepEffect(effect: WeaponEffectSprite, playerX: number, playerY: number): void {
    const weaponId = effect.weaponId;
    if (!weaponId) return;
    const tuning = weaponTuning[weaponId];

    if (tuning.behavior === 'boomerang') {
      this.stepBoomerang(effect, tuning, playerX, playerY);
    } else if (tuning.behavior === 'stickyDot' && effect.stuckTo) {
      this.stepSticky(effect, weaponId, tuning);
    } else if (tuning.behavior === 'dashSlash') {
      this.stepDashSlash(effect, playerX, playerY);
    }
  }

  private stepBoomerang(
    effect: WeaponEffectSprite,
    tuning: BoomerangTuning,
    playerX: number,
    playerY: number,
  ): void {
    const dx = effect.x - effect.launchX;
    const dy = effect.y - effect.launchY;
    const traveled = Math.sqrt(dx * dx + dy * dy);

    if (
      !effect.boomerangReturning &&
      computeBoomerangPhase(traveled, tuning.maxRangePx) === 'returning'
    ) {
      effect.boomerangReturning = true;
    }
    if (!effect.boomerangReturning) return;

    const toPlayerX = playerX - effect.x;
    const toPlayerY = playerY - effect.y;
    const dist = Math.max(1, Math.hypot(toPlayerX, toPlayerY));
    const body = effect.body as Phaser.Physics.Arcade.Body;
    body.setVelocity((toPlayerX / dist) * tuning.speed, (toPlayerY / dist) * tuning.speed);

    if (dist < 10) effect.deactivate(); // caught back by the thrower
  }

  private stepSticky(
    effect: WeaponEffectSprite,
    weaponId: WeaponId,
    tuning: StickyDotTuning,
  ): void {
    const target = effect.stuckTo;
    if (!target || target.isDead) {
      if (target) this.stickyTracker.clear(target);
      effect.deactivate();
      return;
    }

    effect.setPosition(target.x, target.y);

    if (effect.dotTickFramesRemaining > 0) {
      effect.dotTickFramesRemaining -= 1;
      return;
    }
    if (effect.dotTicksRemaining <= 0) {
      this.stickyTracker.clear(target);
      effect.deactivate();
      return;
    }
    target.applyWeaponHit(weaponId, tuning.dotDamage);
    effect.dotTicksRemaining -= 1;
    effect.dotTickFramesRemaining = msToFrames(tuning.dotTickMs);
  }

  private stepDashSlash(effect: WeaponEffectSprite, playerX: number, playerY: number): void {
    if (effect.activeFramesRemaining <= 0) return;
    effect.setPosition(playerX, playerY);
    effect.activeFramesRemaining -= 1;
    if (effect.activeFramesRemaining <= 0) effect.deactivate();
  }
}
