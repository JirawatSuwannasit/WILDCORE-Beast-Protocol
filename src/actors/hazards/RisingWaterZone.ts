import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { waterTuning } from '@/config/waterTuning';

/**
 * GDD §2.7 problem 2 (M4.1-REBUILD): the setpiece's signature water moment
 * - a rising water level inside the wall-kick ascent shaft. Starts inert;
 * `trigger()` (called once the player enters the shaft) begins the surface
 * climbing at a steady rate up to a ceiling row, then holds there. Anyone
 * below the current surface is "in the water" (float physics + a gentle
 * upward push) - purely an assist, matching GDD §3b's "currents ... 0
 * damage" rule, so falling behind it only ever helps, never punishes.
 */
export class RisingWaterZone {
  private readonly x: number;
  private readonly halfWidth: number;
  private readonly bottomY: number;
  private readonly ceilingY: number;
  private surfaceY: number;
  private triggered = false;
  private readonly visual: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, x: number, width: number, bottomY: number, ceilingY: number) {
    this.x = x;
    this.halfWidth = width / 2;
    this.bottomY = bottomY;
    this.ceilingY = ceilingY;
    this.surfaceY = bottomY;

    this.visual = scene.add
      .rectangle(x, bottomY, width, 1, THEME.accentTeal, 0.4)
      .setOrigin(0.5, 1)
      .setDepth(waterTuning.renderDepth);
  }

  trigger(): void {
    this.triggered = true;
  }

  /** Whether `(px, py)` is below the current water surface, within the shaft's width. */
  overlaps(px: number, py: number): boolean {
    return Math.abs(px - this.x) <= this.halfWidth && py >= this.surfaceY && py <= this.bottomY;
  }

  get pushY(): number {
    return waterTuning.risingWater.pushY;
  }

  fixedUpdate(): void {
    if (this.triggered && this.surfaceY > this.ceilingY) {
      this.surfaceY = Math.max(
        this.ceilingY,
        this.surfaceY - waterTuning.risingWater.riseSpeedPxPerSec / 60,
      );
    }
    this.visual.setSize(this.halfWidth * 2, Math.max(1, this.bottomY - this.surfaceY));
    this.visual.setPosition(this.x, this.bottomY);
  }
}
