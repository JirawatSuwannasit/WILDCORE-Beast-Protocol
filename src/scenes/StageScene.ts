import Phaser from 'phaser';
import { BaseScene } from '@/scenes/BaseScene';
import { THEME } from '@/config/theme';
import { FIXED_DT_S } from '@/systems/fixedTimestep';

const PACER_SPEED_PX_PER_S = 40;
const PACER_MARGIN = 24;

/**
 * Stage stub. Ground + a placeholder "pacer" rectangle sliding at a fixed
 * 60Hz logic rate, its render position interpolated by `renderAlpha` -
 * proof the fixed-timestep/interpolation wiring in BaseScene actually
 * drives movement, ready for the Player controller in M1.
 *
 * The ground panel spans the full (device-aspect-dependent) world width
 * to demonstrate background-extend (GDD §0); the pacer stays inside the
 * 320px safe zone, since gameplay hazards must stay reachable/readable
 * regardless of how much extra width a wide device shows.
 */
export class StageScene extends BaseScene {
  private pacer!: Phaser.GameObjects.Rectangle;
  private pacerPrevX = 0;
  private pacerX = 0;
  private pacerVelocity = PACER_SPEED_PX_PER_S;
  private pacerLeftBound = 0;
  private pacerRightBound = 0;

  constructor() {
    super('Stage');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(THEME.background);

    const { left, centerX, right } = this.safeZoneX;
    const worldHeight = this.scale.height;

    this.add.rectangle(this.scale.width / 2, worldHeight - 12, this.scale.width, 24, THEME.panel);

    this.add
      .text(centerX, 16, 'STAGE (stub)', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: THEME.textCream,
      })
      .setOrigin(0.5);

    this.pacerLeftBound = left + PACER_MARGIN;
    this.pacerRightBound = right - PACER_MARGIN;
    this.pacerX = this.pacerLeftBound;
    this.pacerPrevX = this.pacerX;
    this.pacer = this.add.rectangle(this.pacerX, worldHeight - 36, 12, 12, THEME.accentCoral);
  }

  protected fixedUpdate(_fixedDtMs: number): void {
    this.pacerPrevX = this.pacerX;
    this.pacerX += this.pacerVelocity * FIXED_DT_S;

    if (this.pacerX > this.pacerRightBound || this.pacerX < this.pacerLeftBound) {
      this.pacerVelocity *= -1;
      this.pacerX = Phaser.Math.Clamp(this.pacerX, this.pacerLeftBound, this.pacerRightBound);
    }
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    this.pacer.x = Phaser.Math.Linear(this.pacerPrevX, this.pacerX, this.renderAlpha);
  }
}
