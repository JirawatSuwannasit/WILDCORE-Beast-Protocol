import Phaser from 'phaser';
import { THEME } from '@/config/theme';

/**
 * GDD §2.6 density requirement (8-12 pickups/stage): a visual placeholder
 * collectible. Stubbed like the Legs Capsule - no weapon-energy economy
 * exists yet (that's M3/M6), so collecting one just despawns it for now.
 */
export class EnergyPickupStub {
  private readonly visual: Phaser.GameObjects.Arc;
  private readonly zone: Phaser.GameObjects.Zone;
  private collected = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.visual = scene.add
      .circle(x, y, 5, THEME.accentTeal, 0.9)
      .setStrokeStyle(1, THEME.textCreamHex);
    this.zone = scene.add.zone(x, y, 14, 14);
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
