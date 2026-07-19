import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { getRectTexture } from '@/systems/placeholderTexture';
import { bubbleCrabTuning } from '@/config/enemyTuning';
import { Enemy } from '@/actors/Enemy';
import type { EnemyProjectilePool } from '@/actors/EnemyProjectile';
import type { WeaponId } from '@/data/weaknessWheel';

const SIZE = 14;
const DEFAULT_FLOOR_RANGE_X = 48;
const DEFAULT_WALL_HEIGHT = 32;

/** The 4-leg loop a crab patrols: floor (left->right), then up/down the right-hand wall, then floor back. */
type Leg = 'floorRight' | 'wallUp' | 'wallDown' | 'floorLeft';

/**
 * GDD §3b: walks floor/walls inside a bubble shield (kinematic patrol
 * around a floor+wall rectangle - gravity disabled, driven by velocity +
 * boundary checks, the same idiom PatrolDrone's lane patrol already uses).
 * Pop the bubble (any hit) -> 2s vulnerable -> re-bubbles.
 */
export class BubbleCrab extends Enemy {
  private readonly anchorLeft: number;
  private readonly anchorRight: number;
  private readonly anchorTop: number;
  private readonly anchorBottom: number;
  private leg: Leg = 'floorRight';

  private bubbled = true;
  private vulnerableFramesRemaining = 0;
  private readonly shieldVisual: Phaser.GameObjects.Rectangle;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    opts: { floorRangeX?: number; wallHeight?: number } = {},
  ) {
    super(
      scene,
      x,
      y,
      getRectTexture(scene, 'bubble-crab', SIZE, SIZE, THEME.moss),
      bubbleCrabTuning.hp,
    );

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(SIZE, SIZE);

    const floorRangeX = opts.floorRangeX ?? DEFAULT_FLOOR_RANGE_X;
    const wallHeight = opts.wallHeight ?? DEFAULT_WALL_HEIGHT;
    this.anchorLeft = x;
    this.anchorRight = x + floorRangeX;
    this.anchorBottom = y;
    this.anchorTop = y - wallHeight;
    body.setVelocityX(bubbleCrabTuning.walkSpeed);

    this.shieldVisual = scene.add
      .rectangle(x, y, SIZE + 6, SIZE + 6, THEME.accentTeal, 0.35)
      .setStrokeStyle(1, THEME.accentTeal);
  }

  /** GDD §3b: any hit pops the bubble instead of dealing damage the first time; only a vulnerable crab actually loses HP. */
  takeDamage(amount: number): void {
    if (this.isDead) return;
    if (this.bubbled) {
      this.popBubble();
      return;
    }
    super.takeDamage(amount);
  }

  applyWeaponHit(_weaponId: WeaponId, damage: number): void {
    this.takeDamage(damage);
  }

  private popBubble(): void {
    this.bubbled = false;
    this.vulnerableFramesRemaining = bubbleCrabTuning.vulnerableFrames;
    this.shieldVisual.setVisible(false);
  }

  private reBubble(): void {
    this.bubbled = true;
    this.shieldVisual.setVisible(true);
  }

  fixedUpdate(_playerX: number, _playerY: number, _bolts: EnemyProjectilePool): void {
    this.captureRenderStep();
    if (this.isDead) {
      this.shieldVisual.setVisible(false);
      return;
    }
    if (this.tickFrozen()) return;

    if (!this.bubbled) {
      this.vulnerableFramesRemaining -= 1;
      if (this.vulnerableFramesRemaining <= 0) this.reBubble();
    }

    this.stepPatrol();
    this.shieldVisual.setPosition(this.bodyCenter.x, this.bodyCenter.y);
  }

  private stepPatrol(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const center = this.bodyCenter;
    const speed = bubbleCrabTuning.walkSpeed;

    switch (this.leg) {
      case 'floorRight':
        if (center.x >= this.anchorRight) {
          body.reset(this.anchorRight, this.anchorBottom);
          body.setVelocity(0, -speed);
          this.leg = 'wallUp';
        }
        break;
      case 'wallUp':
        if (center.y <= this.anchorTop) {
          body.reset(this.anchorRight, this.anchorTop);
          body.setVelocity(0, speed);
          this.leg = 'wallDown';
        }
        break;
      case 'wallDown':
        if (center.y >= this.anchorBottom) {
          body.reset(this.anchorRight, this.anchorBottom);
          body.setVelocity(-speed, 0);
          this.leg = 'floorLeft';
        }
        break;
      case 'floorLeft':
        if (center.x <= this.anchorLeft) {
          body.reset(this.anchorLeft, this.anchorBottom);
          body.setVelocity(speed, 0);
          this.leg = 'floorRight';
        }
        break;
    }
  }

  reset(x: number, y: number): void {
    super.reset(x, y);
    this.leg = 'floorRight';
    this.bubbled = true;
    this.vulnerableFramesRemaining = 0;
    this.shieldVisual.setVisible(true);
    this.shieldVisual.setPosition(x, y);
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(bubbleCrabTuning.walkSpeed, 0);
  }
}
