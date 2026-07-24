import Phaser from 'phaser';
import { Enemy } from '@/actors/Enemy';
import type { EnemyProjectilePool } from '@/actors/EnemyProjectile';
import { getRectTexture } from '@/systems/placeholderTexture';
import { THEME } from '@/config/theme';
import { slagBlobTuning } from '@/config/emberTuning';
export class SlagBlob extends Enemy {
  private f = slagBlobTuning.cooldownFrames;
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(
      scene,
      x,
      y,
      getRectTexture(scene, 'slag-blob', 16, 12, THEME.accentCoral),
      slagBlobTuning.hp,
    );
    (this.body as Phaser.Physics.Arcade.Body).setSize(16, 12).setAllowGravity(true);
  }
  fixedUpdate(px: number, py: number, bolts: EnemyProjectilePool): void {
    this.captureRenderStep();
    if (this.tickFrozen()) return;
    this.f -= 1;
    if (this.f === slagBlobTuning.telegraphFrames) this.visual.setTintFill(THEME.accentAmber);
    if (this.f <= 0) {
      this.visual.clearTint();
      for (const dy of [-35, -70])
        bolts.fire(
          this.x,
          this.y,
          (px - this.x) * 0.8,
          (py + dy - this.y) * 0.8,
          slagBlobTuning.arcDamage,
        );
      this.f = slagBlobTuning.cooldownFrames;
    }
  }
}
