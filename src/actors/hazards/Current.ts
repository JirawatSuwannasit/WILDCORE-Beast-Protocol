import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { currentTuning } from '@/config/enemyTuning';

/**
 * GDD §3b hazard matrix: currents are a movement modifier only (0 damage),
 * always shown by particles. Pushes anything overlapping by a fixed
 * vector every frame (GDD §3.2: "currents push jumps") - the owning
 * scene polls `zone` each fixedUpdate (same manual-overlap idiom as
 * BaseStageScene's speed-strip check) and applies `pushX`/`pushY` to the
 * player while they overlap.
 */
export class Current {
  readonly zone: Phaser.GameObjects.Zone;
  readonly pushX: number;
  readonly pushY: number;

  private readonly bubbles: Phaser.GameObjects.Arc[];
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

    this.bubbles = Array.from({ length: currentTuning.bubbleCount }, () =>
      scene.add.circle(x, y, 1.5, THEME.textCreamHex, 0.55),
    );
    this.bubbles.forEach((bubble, i) => {
      const t = i / this.bubbles.length;
      bubble.setPosition(
        this.originX - this.width / 2 + t * this.width,
        this.originY - this.height / 2 + t * this.height,
      );
    });
  }

  fixedUpdate(): void {
    this.frame += 1;
    const dir =
      Math.hypot(this.pushX, this.pushY) > 0.01
        ? { x: this.pushX, y: this.pushY }
        : { x: 0, y: -1 };
    const mag = Math.hypot(dir.x, dir.y) || 1;
    const stepX = (dir.x / mag) * 0.6;
    const stepY = (dir.y / mag) * 0.6;

    this.bubbles.forEach((bubble, i) => {
      const phase = ((this.frame + i * 7) % 60) / 60;
      bubble.setPosition(
        this.originX - this.width / 2 + (i / this.bubbles.length) * this.width + stepX * phase * 20,
        this.originY -
          this.height / 2 +
          (i / this.bubbles.length) * this.height +
          stepY * phase * 20,
      );
      bubble.setAlpha(0.6 * (1 - phase));
    });
  }
}
