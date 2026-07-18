import Phaser from 'phaser';
import { BaseScene } from '@/scenes/BaseScene';
import { THEME } from '@/config/theme';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config/resolution';
import { FIXED_DT_S } from '@/systems/fixedTimestep';

const PACER_SPEED_PX_PER_S = 40;
const PACER_MARGIN = 24;

/**
 * Stage stub. Ground + a placeholder "pacer" rectangle sliding at a fixed
 * 60Hz logic rate, its render position interpolated by `renderAlpha` -
 * proof the fixed-timestep/interpolation wiring in BaseScene actually
 * drives movement, ready for the Player controller in M1.
 */
export class StageScene extends BaseScene {
  private pacer!: Phaser.GameObjects.Rectangle;
  private pacerPrevX = 0;
  private pacerX = 0;
  private pacerVelocity = PACER_SPEED_PX_PER_S;

  constructor() {
    super('Stage');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(THEME.background);

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 12, GAME_WIDTH, 24, THEME.panel);

    this.add
      .text(GAME_WIDTH / 2, 16, 'STAGE (stub)', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: THEME.textCream,
      })
      .setOrigin(0.5);

    this.pacerX = PACER_MARGIN;
    this.pacerPrevX = this.pacerX;
    this.pacer = this.add.rectangle(this.pacerX, GAME_HEIGHT - 36, 12, 12, THEME.accentCoral);
  }

  protected fixedUpdate(_fixedDtMs: number): void {
    this.pacerPrevX = this.pacerX;
    this.pacerX += this.pacerVelocity * FIXED_DT_S;

    if (this.pacerX > GAME_WIDTH - PACER_MARGIN || this.pacerX < PACER_MARGIN) {
      this.pacerVelocity *= -1;
      this.pacerX = Phaser.Math.Clamp(this.pacerX, PACER_MARGIN, GAME_WIDTH - PACER_MARGIN);
    }
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    this.pacer.x = Phaser.Math.Linear(this.pacerPrevX, this.pacerX, this.renderAlpha);
  }
}
