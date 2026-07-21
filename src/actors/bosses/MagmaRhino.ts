import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { getRectTexture } from '@/systems/placeholderTexture';
import { magmaRhinoTuning } from '@/config/bossTuning';
import { Enemy } from '@/actors/Enemy';
import type { EnemyProjectilePool } from '@/actors/EnemyProjectile';
import { isWeakness, type WeaponId } from '@/data/weaknessWheel';

const SIZE = { width: 26, height: 20 };
const IDLE_FRAMES = 45;
const WEAKNESS_STUN_FRAMES = 30;

type PatternId = 'ramCharge' | 'lavaGeysers' | 'hornToss';
type State =
  | 'ritual'
  | 'idle'
  | 'ramTelegraph'
  | 'ramDash'
  | 'wallStun'
  | 'geyserTelegraph'
  | 'geyserErupt'
  | 'geyserGap'
  | 'geyserRecover'
  | 'hornTelegraph'
  | 'hornRecover'
  | 'stunned'
  | 'defeated';

/**
 * MAGMA RHINO (GDD §3.3 / §4). 3 core patterns, all dodgeable with the
 * buster alone: (a) ram charge that cracks the wall, leaving a brief stun
 * opening, (b) lava geysers erupting in a readable sequence, (c) a horn
 * toss of magma rocks. Below 25% HP, patterns chain back-to-back (same
 * desperation shape as every other boss). Weak to Tide Burst - "extin-
 * guishes his charge flame" (interrupt + 4 damage, from any state).
 */
export class MagmaRhino extends Enemy {
  private bossFsmState: State = 'ritual';
  private framesRemaining = 0;
  private readonly arenaLeft: number;
  private readonly arenaRight: number;
  private readonly floorY: number;
  private desperationQueued: PatternId | null = null;

  // Ram charge
  private ramDirection: 1 | -1 = 1;

  // Lava geysers
  private geyserPositions: number[] = [];
  private geyserIndex = 0;
  private readonly geyserVisual: Phaser.GameObjects.Rectangle;
  private geyserErupting = false;

  onPlayerContact: ((damage: number) => void) | null = null;
  onGeyserContact: ((damage: number) => void) | null = null;
  onWallCrack: (() => void) | null = null;
  onDefeated: (() => void) | null = null;
  onReaction: (() => void) | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, arenaLeft: number, arenaRight: number) {
    super(
      scene,
      x,
      y,
      getRectTexture(scene, 'magma-rhino', SIZE.width, SIZE.height, THEME.accentCoral),
      magmaRhinoTuning.maxHp,
    );

    this.arenaLeft = arenaLeft;
    this.arenaRight = arenaRight;
    this.floorY = y;
    this.invulnerable = true; // during the fill ritual
    this.isMinor = false; // GDD §3.4/§5: Frost Talon freezes only minor enemies, not bosses

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(SIZE.width, SIZE.height);
    body.setCollideWorldBounds(false);

    this.geyserVisual = scene.add
      .rectangle(x, y, 14, 4, THEME.accentAmber, 0.5)
      .setOrigin(0.5, 1)
      .setVisible(false);
  }

  get isInvulnerable(): boolean {
    return this.invulnerable;
  }

  get bossState(): State {
    return this.bossFsmState;
  }

  /** Called once the shutter doors finish closing; starts the HP-fill ritual. */
  beginRitual(): void {
    this.bossFsmState = 'ritual';
    this.framesRemaining = Math.round(magmaRhinoTuning.fillRitualMs / (1000 / 60));
  }

  /** GDD §3.3: weak to Tide Burst - 4 damage + interrupt (from any state) + reaction. */
  takesWeakness(_weaponId: WeaponId): void {
    if (this.isDead || this.bossFsmState === 'ritual' || this.bossFsmState === 'defeated') return;
    this.takeDamage(magmaRhinoTuning.weaknessDamage);
    if (this.isDead) return;
    this.onReaction?.();
    this.enterState('stunned', WEAKNESS_STUN_FRAMES);
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.geyserVisual.setVisible(false);
    this.geyserErupting = false;
  }

  /** Live wiring of the weakness wheel (GDD §5): any weapon hit routes here. */
  applyWeaponHit(weaponId: WeaponId, damage: number): void {
    if (isWeakness(weaponId, 'magmaRhino')) {
      this.takesWeakness(weaponId);
    } else {
      this.takeDamage(damage);
    }
  }

  protected onDeath(): void {
    super.onDeath();
    this.bossFsmState = 'defeated';
    this.geyserVisual.setVisible(false);
    this.onDefeated?.();
  }

  fixedUpdate(playerX: number, playerY: number, bolts: EnemyProjectilePool): void {
    this.captureRenderStep();
    if (this.isDead) return;

    this.framesRemaining -= 1;

    switch (this.bossFsmState) {
      case 'ritual':
        if (this.framesRemaining <= 0) {
          this.invulnerable = false;
          this.enterState('idle', IDLE_FRAMES);
        }
        break;

      case 'idle':
        if (this.framesRemaining <= 0) this.startPattern(this.pickPattern());
        break;

      case 'ramTelegraph':
        if (this.framesRemaining <= 0) this.launchRam();
        break;

      case 'ramDash':
        this.updateRamDash();
        break;

      case 'wallStun':
      case 'stunned':
        if (this.framesRemaining <= 0) this.finishPattern();
        break;

      case 'geyserTelegraph':
        if (this.framesRemaining <= 0) this.eruptGeyser();
        break;

      case 'geyserErupt':
        if (this.framesRemaining <= 0) this.recoverGeyser();
        break;

      case 'geyserGap':
        if (this.framesRemaining <= 0) this.nextGeyser();
        break;

      case 'geyserRecover':
        if (this.framesRemaining <= 0) this.finishPattern();
        break;

      case 'hornTelegraph':
        if (this.framesRemaining <= 0) this.fireHornToss(playerX, bolts);
        break;

      case 'hornRecover':
        if (this.framesRemaining <= 0) this.finishPattern();
        break;

      case 'defeated':
        break;
    }

    this.checkContactDamage(playerX, playerY);
  }

  private enterState(state: State, frames: number): void {
    this.bossFsmState = state;
    this.framesRemaining = frames;
  }

  private pickPattern(): PatternId {
    const order: PatternId[] = ['ramCharge', 'lavaGeysers', 'hornToss'];
    return order[Phaser.Math.Between(0, order.length - 1)] ?? 'ramCharge';
  }

  private startPattern(pattern: PatternId): void {
    if (pattern === 'ramCharge') {
      const center = this.bodyCenter;
      this.ramDirection = center.x <= (this.arenaLeft + this.arenaRight) / 2 ? 1 : -1;
      this.enterState('ramTelegraph', magmaRhinoTuning.ramCharge.telegraphFrames);
    } else if (pattern === 'lavaGeysers') {
      const span = this.arenaRight - this.arenaLeft;
      this.geyserPositions = [0.25, 0.5, 0.75].map((f) => this.arenaLeft + span * f);
      this.geyserIndex = 0;
      this.startGeyserAt(this.geyserIndex);
    } else {
      this.enterState('hornTelegraph', magmaRhinoTuning.hornToss.telegraphFrames);
    }
  }

  // --- Pattern (a): ram charge -> cracks the wall -> brief stun opening ---

  private launchRam(): void {
    const speed = magmaRhinoTuning.ramCharge.speed;
    (this.body as Phaser.Physics.Arcade.Body).setVelocityX(this.ramDirection * speed);
    this.bossFsmState = 'ramDash';
  }

  private updateRamDash(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const center = this.bodyCenter;
    const reachedWall =
      (this.ramDirection === 1 && center.x >= this.arenaRight - SIZE.width / 2) ||
      (this.ramDirection === -1 && center.x <= this.arenaLeft + SIZE.width / 2);

    if (reachedWall) {
      body.setVelocityX(0);
      this.onWallCrack?.();
      this.enterState('wallStun', magmaRhinoTuning.ramCharge.wallStunFrames);
    }
  }

  // --- Pattern (b): lava geysers in a readable sequence ---------------------

  private startGeyserAt(index: number): void {
    const x = this.geyserPositions[index] ?? this.bodyCenter.x;
    this.geyserVisual.setPosition(x, this.floorY);
    this.geyserVisual.setSize(14, 4);
    this.geyserVisual.setFillStyle(THEME.accentAmber, 0.5);
    this.geyserVisual.setVisible(true);
    this.geyserErupting = false;
    this.enterState('geyserTelegraph', magmaRhinoTuning.lavaGeysers.telegraphFrames);
  }

  private eruptGeyser(): void {
    this.geyserVisual.setSize(14, 40);
    this.geyserVisual.setFillStyle(THEME.accentCoral, 0.9);
    this.geyserErupting = true;
    this.enterState('geyserErupt', magmaRhinoTuning.lavaGeysers.eruptFrames);
  }

  private recoverGeyser(): void {
    this.geyserVisual.setVisible(false);
    this.geyserErupting = false;
    this.enterState('geyserGap', magmaRhinoTuning.lavaGeysers.stepFrames);
  }

  private nextGeyser(): void {
    this.geyserIndex += 1;
    if (this.geyserIndex >= this.geyserPositions.length) {
      this.enterState('geyserRecover', magmaRhinoTuning.lavaGeysers.recoverFrames);
      return;
    }
    this.startGeyserAt(this.geyserIndex);
  }

  // --- Pattern (c): horn toss of magma rocks ---------------------------------

  private fireHornToss(playerX: number, bolts: EnemyProjectilePool): void {
    const center = this.bodyCenter;
    const rockCount: number = magmaRhinoTuning.hornToss.rockCount;
    const { rockSpeed, damage } = magmaRhinoTuning.hornToss;
    const baseAngle = Math.atan2(this.floorY - center.y, playerX - center.x);
    const spread = 0.35;
    for (let i = 0; i < rockCount; i += 1) {
      const t = rockCount === 1 ? 0 : i / (rockCount - 1) - 0.5;
      const angle = baseAngle + t * spread * 2;
      bolts.fire(
        center.x,
        center.y,
        Math.cos(angle) * rockSpeed,
        Math.sin(angle) * rockSpeed,
        damage,
      );
    }
    this.enterState('hornRecover', magmaRhinoTuning.hornToss.recoverFrames);
  }

  // --- Shared -----------------------------------------------------------

  private finishPattern(): void {
    if (this.hpFraction() < magmaRhinoTuning.desperationHpFraction && !this.desperationQueued) {
      this.desperationQueued = this.pickPattern();
      this.enterState('hornRecover', magmaRhinoTuning.desperation.linkFrames);
      return;
    }
    if (this.desperationQueued) {
      const next = this.desperationQueued;
      this.desperationQueued = null;
      this.startPattern(next);
      return;
    }
    this.enterState('idle', IDLE_FRAMES);
  }

  private hpFraction(): number {
    return this.hitPoints / magmaRhinoTuning.maxHp;
  }

  private checkContactDamage(playerX: number, playerY: number): void {
    if (this.bossFsmState === 'ritual' || this.bossFsmState === 'defeated') return;

    const center = this.bodyCenter;
    const dx = Math.abs(playerX - center.x);
    const dy = Math.abs(playerY - center.y);
    if (dx < SIZE.width / 2 + 6 && dy < SIZE.height / 2 + 8) {
      this.onPlayerContact?.(magmaRhinoTuning.contactDamage);
    }

    if (this.geyserErupting) {
      const geyserDx = Math.abs(playerX - this.geyserVisual.x);
      if (geyserDx < 10 && playerY > this.floorY - 44) {
        this.onGeyserContact?.(magmaRhinoTuning.lavaGeysers.damage);
      }
    }
  }

  reset(x: number, y: number): void {
    super.reset(x, y);
    this.invulnerable = true;
    this.bossFsmState = 'ritual';
    this.framesRemaining = 0;
    this.desperationQueued = null;
    this.geyserVisual.setVisible(false);
    this.geyserErupting = false;
  }
}
