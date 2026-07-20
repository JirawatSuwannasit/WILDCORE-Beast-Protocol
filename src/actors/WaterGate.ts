import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { getRectTexture } from '@/systems/placeholderTexture';
import { waterGateTuning } from '@/config/enemyTuning';
import { waterTuning } from '@/config/waterTuning';

/**
 * GDD §3.2 signature gimmick: "water level raises/lowers on valves;
 * ... valves change which floors are swimmable -> layer choices." A gate
 * is a rectangular floor plate that's either DRAINED (solid, walkable,
 * blocks passage through it) or FLOODED (open, passable, and a real
 * water zone the player can swim/float in while overlapping). Toggled by
 * a paired WaterValve, never directly by the player.
 */
export class WaterGate {
  readonly name: string;
  private readonly plate: Phaser.Physics.Arcade.Image;
  private readonly waterVisual: Phaser.GameObjects.Rectangle;
  private readonly zone: Phaser.GameObjects.Zone;
  private open: boolean;
  private readonly fullHeight: number;

  constructor(
    scene: Phaser.Scene,
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
    startsOpen: boolean,
  ) {
    this.name = name;
    this.fullHeight = height;
    this.open = startsOpen;

    this.plate = scene.physics.add.staticImage(
      x,
      y,
      getRectTexture(scene, `water-gate-plate-${width}x${height}`, width, height, THEME.panel),
    );
    (this.plate.body as Phaser.Physics.Arcade.StaticBody).enable = !this.open;
    this.plate.setVisible(!this.open);

    this.waterVisual = scene.add
      .rectangle(x, y, width, this.open ? height : 1, THEME.accentTeal, 0.4)
      .setVisible(this.open)
      .setDepth(waterTuning.renderDepth);

    this.zone = scene.add.zone(x, y, width, height);
    scene.physics.add.existing(this.zone, true);
  }

  /** The player-overlap check zone (GDD §3.2 float physics) - only meaningful while `isOpen`. */
  get submersionZone(): Phaser.GameObjects.Zone {
    return this.zone;
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** The solid collider to register against the player (enabled only while drained). */
  get collider(): Phaser.Physics.Arcade.Image {
    return this.plate;
  }

  toggle(scene: Phaser.Scene): void {
    this.open = !this.open;

    if (this.open) {
      (this.plate.body as Phaser.Physics.Arcade.StaticBody).enable = false;
      this.waterVisual.setVisible(true);
      scene.tweens.add({
        targets: this.waterVisual,
        displayHeight: this.fullHeight,
        duration: waterGateTuning.toggleTweenMs,
        ease: 'Sine.easeInOut',
      });
    } else {
      this.plate.setVisible(true);
      (this.plate.body as Phaser.Physics.Arcade.StaticBody).enable = true;
      scene.tweens.add({
        targets: this.waterVisual,
        displayHeight: 1,
        duration: waterGateTuning.toggleTweenMs,
        ease: 'Sine.easeInOut',
        onComplete: () => this.waterVisual.setVisible(false),
      });
    }
  }
}
