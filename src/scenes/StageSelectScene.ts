import { BaseScene } from '@/scenes/BaseScene';
import { THEME } from '@/config/theme';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config/resolution';

export class StageSelectScene extends BaseScene {
  constructor() {
    super('StageSelect');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(THEME.background);

    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 260, 120, THEME.accentTeal)
      .setStrokeStyle(2, THEME.panel);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 12, 'STAGE SELECT', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: THEME.textCream,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 8, '(stub - tap to enter a stage)', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: THEME.textCream,
      })
      .setOrigin(0.5);

    this.input.once('pointerdown', () => {
      this.scene.start('Stage');
    });
  }
}
