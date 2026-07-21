import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { getRectTexture } from '@/systems/placeholderTexture';
import { slagFlameTuning } from '@/config/enemyTuning';

const SIZE = 10;

/**
 * GDD §3b: Slag Blob's slag "leaves brief floor flames" after landing -
 * a lingering contact hazard, not an enemy (no HP, can't be attacked).
 * Pooled like `EnemyProjectile`/`WeaponEffectSprite` (spawned dynamically
 * during play, not placed via Tiled) since a handful easily covers every
 * blob's attack without runtime GameObject churn.
 */
export class SlagFlame extends Phaser.Physics.Arcade.Sprite {
  private framesRemaining = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, -100, -100, getRectTexture(scene, 'slag-flame', SIZE, SIZE, THEME.accentAmber));
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.setActive(false);
    this.setVisible(false);
    (this.body as Phaser.Physics.Arcade.StaticBody).enable = false;
  }

  spawn(x: number, y: number): void {
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.framesRemaining = slagFlameTuning.lifetimeFrames;
    const body = this.body as Phaser.Physics.Arcade.StaticBody;
    body.enable = true;
    body.updateFromGameObject();
  }

  fixedUpdate(): void {
    if (!this.active) return;
    this.framesRemaining -= 1;
    this.setAlpha(this.framesRemaining < 30 && this.framesRemaining % 6 < 3 ? 0.4 : 1);
    if (this.framesRemaining <= 0) this.despawn();
  }

  private despawn(): void {
    this.setActive(false);
    this.setVisible(false);
    (this.body as Phaser.Physics.Arcade.StaticBody).enable = false;
  }
}

/** Shared pool - a handful of concurrent flames comfortably covers every Slag Blob's attack. */
export class SlagFlamePool {
  private readonly pool: SlagFlame[];

  constructor(scene: Phaser.Scene, size = 6) {
    this.pool = Array.from({ length: size }, () => new SlagFlame(scene));
  }

  get flames(): readonly SlagFlame[] {
    return this.pool;
  }

  spawn(x: number, y: number): void {
    const flame = this.pool.find((f) => !f.active);
    flame?.spawn(x, y);
  }

  fixedUpdate(): void {
    for (const flame of this.pool) flame.fixedUpdate();
  }
}
