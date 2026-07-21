import Phaser from 'phaser';
import { THEME } from '@/config/theme';

/**
 * GDD §3.3 secret: Cell Pack #1 above the lava chase - dash recommended,
 * but reachable with the base kit (dash is still locked at this
 * milestone). Skill gate, not a weapon gate. Pickup is stubbed like
 * LegsCapsuleStub - M6 wires it to a stored full-heal.
 */
export class CellPackStub {
  private readonly visual: Phaser.GameObjects.Rectangle;
  private readonly zone: Phaser.GameObjects.Zone;
  private collected = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.visual = scene.add
      .rectangle(x, y, 12, 16, THEME.accentTeal, 0.9)
      .setStrokeStyle(1, THEME.textCreamHex);
    this.zone = scene.add.zone(x, y, 18, 20);
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
