import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { getRectTexture } from '@/systems/placeholderTexture';
import { slagGolemTuning } from '@/config/bossTuning';
import { Enemy } from '@/actors/Enemy';
import type { EnemyProjectilePool } from '@/actors/EnemyProjectile';
import type { WeaponId } from '@/data/weaknessWheel';

const SIZE = { width: 22, height: 22 };
const AGGRO_RANGE_PX = 60;

type Phase = 'lumber' | 'slamTelegraph' | 'slamRecover' | 'reforming';

/**
 * SLAG GOLEM mid-boss (GDD §3.3: "slag golem that re-forms once"). Manages
 * two HP pools itself: `phase1Hp` (a private counter, entirely separate
 * from the base Enemy's own hp) absorbs every hit until it drains, at
 * which point the golem "re-forms" (a brief invulnerable crumble/rebuild)
 * instead of dying; only AFTER that does damage start flowing into the
 * base Enemy's real hp via `super.takeDamage`, so `onDeath`/`onDefeated`
 * fire exactly once, on the genuine second kill. No shutter door, ritual,
 * or weakness hook - a real fight, but simpler than a full boss (same
 * treatment as Anglerfish).
 */
export class SlagGolem extends Enemy {
  private phase: Phase = 'lumber';
  private phaseFramesRemaining = 0;
  private attackCooldownFrames = 0;
  private phase1Hp: number = slagGolemTuning.phase1Hp;
  private reformed = false;
  private readonly minX: number;
  private readonly maxX: number;
  private facing: 1 | -1 = 1;

  onPlayerContact: ((damage: number) => void) | null = null;
  onSlamContact: ((damage: number) => void) | null = null;
  onDefeated: (() => void) | null = null;
  onReformed: (() => void) | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(
      scene,
      x,
      y,
      getRectTexture(scene, 'slag-golem', SIZE.width, SIZE.height, THEME.accentCoral),
      slagGolemTuning.phase2Hp,
    );

    this.isMinor = false; // a real (mid-)boss fight, not freeze-cheesable
    this.minX = x - slagGolemTuning.patrolRangeX / 2;
    this.maxX = x + slagGolemTuning.patrolRangeX / 2;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(SIZE.width, SIZE.height);
    body.setGravityY(900);
    body.setVelocityX(slagGolemTuning.lumberSpeed);
  }

  get isReforming(): boolean {
    return this.phase === 'reforming';
  }

  get hasReformed(): boolean {
    return this.reformed;
  }

  takeDamage(amount: number): void {
    if (this.isDead || this.phase === 'reforming') return;
    if (!this.reformed) {
      this.phase1Hp = Math.max(0, this.phase1Hp - amount);
      this.scene.tweens.add({ targets: this.visual, alpha: { from: 0.3, to: 1 }, duration: 100 });
      if (this.phase1Hp <= 0) this.beginReform();
      return;
    }
    super.takeDamage(amount);
  }

  applyWeaponHit(_weaponId: WeaponId, damage: number): void {
    this.takeDamage(damage);
  }

  private beginReform(): void {
    this.phase = 'reforming';
    this.phaseFramesRemaining = slagGolemTuning.reformFrames;
    this.invulnerable = true;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.visual.setAlpha(0.3);
  }

  protected onDeath(): void {
    super.onDeath();
    this.onDefeated?.();
  }

  fixedUpdate(playerX: number, playerY: number, _bolts: EnemyProjectilePool): void {
    this.captureRenderStep();
    if (this.isDead) return;

    const body = this.body as Phaser.Physics.Arcade.Body;
    const center = this.bodyCenter;

    if (this.attackCooldownFrames > 0) this.attackCooldownFrames -= 1;
    this.phaseFramesRemaining -= 1;

    switch (this.phase) {
      case 'lumber': {
        if (center.x <= this.minX && body.velocity.x < 0) {
          body.setVelocityX(slagGolemTuning.lumberSpeed);
          this.facing = 1;
        } else if (center.x >= this.maxX && body.velocity.x > 0) {
          body.setVelocityX(-slagGolemTuning.lumberSpeed);
          this.facing = -1;
        }
        const withinAggro = Math.hypot(playerX - center.x, playerY - center.y) <= AGGRO_RANGE_PX;
        if (withinAggro && this.attackCooldownFrames <= 0) {
          this.phase = 'slamTelegraph';
          this.phaseFramesRemaining = slagGolemTuning.slamTelegraphFrames;
          body.setVelocityX(0);
          this.visual.setTintFill(THEME.accentAmber);
        }
        break;
      }

      case 'slamTelegraph':
        // >=20f telegraph: glowing cracks spread before the ground-pound (feel pillar #4).
        if (this.phaseFramesRemaining <= 0) {
          this.visual.clearTint();
          if (Math.abs(playerX - center.x) <= slagGolemTuning.slamRangeX) {
            this.onSlamContact?.(slagGolemTuning.slamDamage);
          }
          this.phase = 'slamRecover';
          this.phaseFramesRemaining = slagGolemTuning.slamRecoverFrames;
        }
        break;

      case 'slamRecover':
        if (this.phaseFramesRemaining <= 0) {
          this.attackCooldownFrames = slagGolemTuning.attackCooldownFrames;
          this.phase = 'lumber';
          body.setVelocityX(this.facing * slagGolemTuning.lumberSpeed);
        }
        break;

      case 'reforming':
        if (this.phaseFramesRemaining <= 0) {
          this.reformed = true;
          this.invulnerable = false;
          this.visual.setAlpha(1);
          this.phase = 'lumber';
          body.setVelocityX(this.facing * slagGolemTuning.lumberSpeed);
          this.onReformed?.();
        } else {
          // Crumble/rebuild flicker, readable as "not currently fightable".
          this.visual.setAlpha(this.phaseFramesRemaining % 10 < 5 ? 0.3 : 0.7);
        }
        break;
    }

    if (this.phase !== 'reforming') {
      const dx = Math.abs(playerX - center.x);
      const dy = Math.abs(playerY - center.y);
      if (dx < SIZE.width / 2 + 6 && dy < SIZE.height / 2 + 6) {
        this.onPlayerContact?.(slagGolemTuning.contactDamage);
      }
    }
  }

  reset(x: number, y: number): void {
    super.reset(x, y);
    this.phase = 'lumber';
    this.phaseFramesRemaining = 0;
    this.attackCooldownFrames = 0;
    this.phase1Hp = slagGolemTuning.phase1Hp;
    this.reformed = false;
    this.facing = 1;
    this.visual.clearTint();
    this.visual.setAlpha(1);
    (this.body as Phaser.Physics.Arcade.Body).setVelocityX(slagGolemTuning.lumberSpeed);
  }
}
