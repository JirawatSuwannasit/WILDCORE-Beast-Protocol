import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { heatVentTuning } from '@/config/emberTuning';

export class HeatVent {
  readonly zone: Phaser.GameObjects.Zone;
  private readonly visual: Phaser.GameObjects.Rectangle;
  private frame = 0;
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    private readonly slowfall = false,
  ) {
    this.visual = scene.add
      .rectangle(x, y, width, height, THEME.accentAmber, 0.28)
      .setStrokeStyle(1, THEME.accentCoral);
    this.zone = scene.add.zone(x, y, width, height);
    scene.physics.add.existing(this.zone, true);
  }
  fixedUpdate(): void {
    this.frame = (this.frame + 1) % heatVentTuning.pulseFrames;
    this.visual.setAlpha(
      this.slowfall
        ? 0.2
        : 0.2 + 0.18 * Math.sin((this.frame / heatVentTuning.pulseFrames) * Math.PI),
    );
  }
  apply(player: { body: Phaser.Physics.Arcade.Body }): void {
    player.body.setVelocityY(
      this.slowfall
        ? Math.min(player.body.velocity.y, heatVentTuning.slowfallVelocityY)
        : Math.min(player.body.velocity.y, heatVentTuning.liftVelocityY),
    );
  }
}
