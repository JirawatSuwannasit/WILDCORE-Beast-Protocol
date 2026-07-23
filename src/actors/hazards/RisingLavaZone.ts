import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { risingLavaTuning } from '@/config/emberTuning';
export class RisingLavaZone {
  private surfaceY: number;
  private triggered = false;
  private readonly visual: Phaser.GameObjects.Rectangle;
  constructor(
    scene: Phaser.Scene,
    private readonly x: number,
    private readonly width: number,
    bottomY: number,
    private readonly ceilingY: number,
  ) {
    this.surfaceY = bottomY;
    this.visual = scene.add
      .rectangle(x, bottomY, width, 1, THEME.accentCoral, 0.55)
      .setOrigin(0.5, 1)
      .setDepth(200);
  }
  trigger(): void {
    this.triggered = true;
  }
  fixedUpdate(): void {
    if (this.triggered && this.surfaceY > this.ceilingY)
      this.surfaceY = Math.max(
        this.ceilingY,
        this.surfaceY - risingLavaTuning.riseSpeedPxPerSec / 60,
      );
    this.visual.setSize(this.width, Math.max(1, this.visual.y - this.surfaceY));
  }
  overlaps(px: number, py: number): boolean {
    return Math.abs(px - this.x) <= this.width / 2 && py >= this.surfaceY && py <= this.visual.y;
  }
}
