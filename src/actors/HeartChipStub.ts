import Phaser from 'phaser';
import { THEME } from '@/config/theme';
export class HeartChipStub {
  private readonly visual: Phaser.GameObjects.Arc;
  private readonly zone: Phaser.GameObjects.Zone;
  private collected = false;
  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.visual = scene.add
      .circle(x, y, 7, THEME.accentCoral, 0.95)
      .setStrokeStyle(1, THEME.textCreamHex);
    this.zone = scene.add.zone(x, y, 16, 16);
    scene.physics.add.existing(this.zone, true);
  }
  get pickupZone(): Phaser.GameObjects.Zone {
    return this.zone;
  }
  collect(): void {
    if (this.collected) return;
    this.collected = true;
    this.visual.setVisible(false);
    (this.zone.body as Phaser.Physics.Arcade.StaticBody).enable = false;
  }
}
