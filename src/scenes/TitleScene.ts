import { BaseScene } from '@/scenes/BaseScene';
import { THEME } from '@/config/theme';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config/resolution';

export class TitleScene extends BaseScene {
  constructor() {
    super('Title');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(THEME.background);

    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, 200, 60, THEME.accentAmber)
      .setStrokeStyle(2, THEME.panel);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, 'WILDCORE', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: THEME.textCream,
      })
      .setOrigin(0.5);

    const prompt = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50, 'TAP TO START', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: THEME.textCream,
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: prompt,
      alpha: { from: 1, to: 0.3 },
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    this.input.once('pointerdown', () => {
      this.scene.start('StageSelect');
    });
  }
}
