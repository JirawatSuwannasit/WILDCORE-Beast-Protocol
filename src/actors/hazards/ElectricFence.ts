import type Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { electricFenceTuning } from '@/config/enemyTuning';

/** GDD §3b: pulses on a visible+audible beat; safe window >=40 frames. */
export class ElectricFence {
  readonly hazardZone: Phaser.GameObjects.Zone;
  private readonly visual: Phaser.GameObjects.Rectangle;
  private active = true;
  private framesRemaining: number = electricFenceTuning.onFrames;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number) {
    this.visual = scene.add.rectangle(x, y, width, height, THEME.accentAmber, 0.85);
    this.hazardZone = scene.add.zone(x, y, width, height);
    scene.physics.add.existing(this.hazardZone, true);
  }

  get isActive(): boolean {
    return this.active;
  }

  fixedUpdate(): void {
    this.framesRemaining -= 1;
    if (this.framesRemaining > 0) return;

    this.active = !this.active;
    this.framesRemaining = this.active
      ? electricFenceTuning.onFrames
      : electricFenceTuning.safeFrames;
    this.visual.setFillStyle(
      this.active ? THEME.accentAmber : THEME.panel,
      this.active ? 0.85 : 0.25,
    );
  }
}
