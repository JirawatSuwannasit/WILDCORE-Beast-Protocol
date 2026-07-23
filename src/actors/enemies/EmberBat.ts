import Phaser from 'phaser';
import { Enemy } from '@/actors/Enemy';
import type { EnemyProjectilePool } from '@/actors/EnemyProjectile';
import { getRectTexture } from '@/systems/placeholderTexture';
import { THEME } from '@/config/theme';
import { emberBatTuning } from '@/config/emberTuning';
export class EmberBat extends Enemy {
  private f = emberBatTuning.cooldownFrames;
  private sx = 0;
  private swoop = 0;
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(
      scene,
      x,
      y,
      getRectTexture(scene, 'ember-bat', 14, 8, THEME.accentAmber),
      emberBatTuning.hp,
    );
    this.sx = x;
    (this.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setSize(14, 8);
  }
  fixedUpdate(px: number, _py: number, _bolts: EnemyProjectilePool): void {
    this.captureRenderStep();
    if (this.tickFrozen()) return;
    const b = this.body as Phaser.Physics.Arcade.Body;
    if (this.swoop > 0) {
      this.swoop--;
      const t = 1 - this.swoop / emberBatTuning.swoopFrames;
      const dir = Math.sign(px - this.sx) || 1;
      b.setVelocityX(dir * 70);
      b.setVelocityY(Math.sin(t * Math.PI * 2) * 85);
      if (this.swoop <= 0) b.setVelocity(0, 0);
      return;
    }
    this.f--;
    if (this.f === emberBatTuning.eyeTelegraphFrames) this.visual.setTintFill(THEME.accentCoral);
    if (this.f <= 0) {
      this.visual.clearTint();
      this.swoop = emberBatTuning.swoopFrames;
      this.f = emberBatTuning.cooldownFrames;
    }
  }
}
