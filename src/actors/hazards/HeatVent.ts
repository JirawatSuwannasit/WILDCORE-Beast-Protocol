import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { heatVentTuning } from '@/config/enemyTuning';

/**
 * GDD §3.3 signature (vertical) gimmick: "heat vents that lift jumps."
 * Mechanically the same 0-damage movement-modifier idiom as Reservoir's
 * `Current` (a push vector applied to anything overlapping, read every
 * fixedUpdate by the owning scene via `player.applyCurrentPush`) - kept as
 * its own class rather than reusing `Current` directly so the entity type
 * name, visuals (rising embers instead of bubbles), and §2.7 gimmick-usage
 * reporting all read as Foundry's own thing, distinct from Reservoir's
 * currents.
 */
export class HeatVent {
  readonly zone: Phaser.GameObjects.Zone;
  readonly pushX: number;
  readonly pushY: number;

  private readonly embers: Phaser.GameObjects.Arc[];
  private readonly width: number;
  private readonly height: number;
  private readonly originX: number;
  private readonly originY: number;
  private frame = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    pushX: number,
    pushY: number,
  ) {
    this.pushX = pushX;
    this.pushY = pushY;
    this.width = width;
    this.height = height;
    this.originX = x;
    this.originY = y;

    this.zone = scene.add.zone(x, y, width, height);
    scene.physics.add.existing(this.zone, true);

    this.embers = Array.from({ length: heatVentTuning.emberCount }, () =>
      scene.add.circle(x, y, 1.5, THEME.accentAmber, 0.7),
    );
  }

  fixedUpdate(): void {
    this.frame += 1;
    // Embers always rise (heat shimmer), regardless of the vent's own push
    // vector - even a mostly-horizontal vent still visually reads as hot.
    this.embers.forEach((ember, i) => {
      const phase = ((this.frame + i * 9) % 50) / 50;
      ember.setPosition(
        this.originX - this.width / 2 + (i / this.embers.length) * this.width,
        this.originY + this.height / 2 - phase * this.height,
      );
      ember.setAlpha(0.75 * (1 - phase));
    });
  }
}
