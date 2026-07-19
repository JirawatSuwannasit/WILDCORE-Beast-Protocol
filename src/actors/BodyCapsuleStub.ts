import Phaser from 'phaser';
import { THEME } from '@/config/theme';

/**
 * GDD §3.2 secret: Body Capsule, gated behind Volt Chain powering the pump
 * (see BodyCapsulePump). Pickup is stubbed like LegsCapsuleStub - M6 wires
 * it to actually grant -25% damage + no knockback from small hits. Starts
 * locked (invisible, no collectible body) until the pump unlocks it.
 */
export class BodyCapsuleStub {
  private readonly visual: Phaser.GameObjects.Rectangle;
  private readonly zone: Phaser.GameObjects.Zone;
  private collected = false;
  private locked = true;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.visual = scene.add
      .rectangle(x, y, 10, 14, THEME.accentTeal, 0.9)
      .setStrokeStyle(1, THEME.textCreamHex)
      .setVisible(false);
    this.zone = scene.add.zone(x, y, 16, 20);
    scene.physics.add.existing(this.zone, true);
    (this.zone.body as Phaser.Physics.Arcade.StaticBody).enable = false;
  }

  get pickupZone(): Phaser.GameObjects.Zone {
    return this.zone;
  }

  get isCollected(): boolean {
    return this.collected;
  }

  /** Called by BodyCapsulePump once it's powered by Volt Chain. */
  unlock(): void {
    if (!this.locked) return;
    this.locked = false;
    this.visual.setVisible(true);
    (this.zone.body as Phaser.Physics.Arcade.StaticBody).enable = true;
  }

  collect(): void {
    if (this.collected || this.locked) return;
    this.collected = true;
    this.visual.setVisible(false);
    (this.zone.body as Phaser.Physics.Arcade.StaticBody).enable = false;
  }
}
