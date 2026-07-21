import Phaser from 'phaser';
import { THEME } from '@/config/theme';

/**
 * GDD §3.3 secret: Heart Chip behind a crusher on a timed 2-cycle route -
 * a skill/timing gate, not a weapon gate (no "locked" hint needed; the
 * crushers' own visible rhythm is the readable gate). Pickup is stubbed
 * like LegsCapsuleStub - M6 wires it to actually grant +2 max HP.
 */
export class HeartChipStub {
  private readonly visual: Phaser.GameObjects.Arc;
  private readonly zone: Phaser.GameObjects.Zone;
  private collected = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.visual = scene.add
      .circle(x, y, 6, THEME.accentCoral, 0.9)
      .setStrokeStyle(1, THEME.textCreamHex);
    this.zone = scene.add.zone(x, y, 16, 16);
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
