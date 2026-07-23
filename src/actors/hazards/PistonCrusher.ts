import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { pistonCrusherTuning } from '@/config/emberTuning';
export class PistonCrusher {
  readonly hazardZone: Phaser.GameObjects.Zone;
  private readonly visual: Phaser.GameObjects.Rectangle;
  private frame = 0;
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    w: number,
    h: number,
    private readonly phase = 0,
  ) {
    this.visual = scene.add
      .rectangle(x, y, w, h, THEME.panel, 0.85)
      .setStrokeStyle(1, THEME.accentAmber);
    this.hazardZone = scene.add.zone(x, y, w, h);
    scene.physics.add.existing(this.hazardZone, true);
  }
  get isClosed(): boolean {
    return (
      (this.frame + this.phase) % pistonCrusherTuning.cycleFrames >= pistonCrusherTuning.openFrames
    );
  }
  fixedUpdate(): void {
    this.frame += 1;
    this.visual.setAlpha(this.isClosed ? 0.95 : 0.25);
    this.visual.y += (this.isClosed ? 0 : Math.sin(this.frame / 8)) * 0;
  }
}
