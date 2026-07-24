import Phaser from 'phaser';
import { Enemy } from '@/actors/Enemy';
import type { EnemyProjectilePool } from '@/actors/EnemyProjectile';
import { getRectTexture } from '@/systems/placeholderTexture';
import { THEME } from '@/config/theme';
import { slagGolemTuning } from '@/config/emberTuning';
export class SlagGolem extends Enemy {
  private reformed = false;
  private cd = 70;
  onDefeated: (() => void) | null = null;
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(
      scene,
      x,
      y,
      getRectTexture(scene, 'slag-golem', 30, 32, THEME.accentCoral),
      slagGolemTuning.maxHp,
    );
    this.isMinor = false;
    (this.body as Phaser.Physics.Arcade.Body).setSize(30, 32).setAllowGravity(true);
  }
  protected onDeath(): void {
    if (!this.reformed) {
      this.reformed = true;
      this.invulnerable = true;
      this.visual.setTintFill(THEME.accentAmber);
      this.scene.time.delayedCall((slagGolemTuning.reformFrames * 1000) / 60, () => {
        super.reset(this.x, this.y);
        this.invulnerable = false;
        this.visual.clearTint();
      });
      return;
    }
    super.onDeath();
    this.onDefeated?.();
  }
  fixedUpdate(px: number, py: number, bolts: EnemyProjectilePool): void {
    this.captureRenderStep();
    this.cd--;
    if (this.cd === slagGolemTuning.slamTelegraphFrames) this.visual.setTintFill(THEME.accentAmber);
    if (this.cd <= 0) {
      this.visual.clearTint();
      bolts.fire(
        this.x,
        this.y,
        (px - this.x) * 0.7,
        (py - this.y) * 0.7,
        slagGolemTuning.rockDamage,
      );
      this.cd = 90;
    }
  }
}
