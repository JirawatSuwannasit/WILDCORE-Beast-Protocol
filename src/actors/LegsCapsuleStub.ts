import Phaser from 'phaser';
import { THEME } from '@/config/theme';

/** GDD §3.1 secret: Legs Capsule, "no weapon gate". Pickup is stubbed - M6 wires it to actually grant Dash. */
export class LegsCapsuleStub {
  private readonly visual: Phaser.GameObjects.Rectangle;
  private readonly zone: Phaser.GameObjects.Zone;
  private collected = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.visual = scene.add
      .rectangle(x, y, 10, 14, THEME.accentAmber, 0.9)
      .setStrokeStyle(1, THEME.textCreamHex);
    this.zone = scene.add.zone(x, y, 16, 20);
    scene.physics.add.existing(this.zone, true);
  }

  get pickupZone(): Phaser.GameObjects.Zone {
    return this.zone;
  }

  get isCollected(): boolean {
    return this.collected;
  }

  collect(): void {
    if (this.collected) return;
    this.collected = true;
    this.visual.setVisible(false);
    (this.zone.body as Phaser.Physics.Arcade.StaticBody).enable = false;
  }
}
