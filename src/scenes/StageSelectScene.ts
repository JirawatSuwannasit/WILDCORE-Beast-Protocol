import { BaseScene } from '@/scenes/BaseScene';
import { THEME } from '@/config/theme';

export class StageSelectScene extends BaseScene {
  constructor() {
    super('StageSelect');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(THEME.background);

    const { centerX } = this.safeZoneX;
    const centerY = this.scale.height / 2;

    this.add
      .text(centerX, centerY - 60, 'STAGE SELECT', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: THEME.textCream,
      })
      .setOrigin(0.5);

    this.addStageButton(centerX, centerY - 65, 'SPEEDWAY SAVANNA', THEME.accentTeal, 'Speedway');
    this.addStageButton(centerX, centerY - 25, 'CORAL RESERVOIR', THEME.accentCoral, 'Reservoir');
    this.addStageButton(centerX, centerY + 15, 'EMBER FOUNDRY', THEME.accentAmber, 'Foundry');
    this.addStageButton(centerX, centerY + 65, 'PLAYER GYM (practice)', THEME.panel, 'Gym');
  }

  private addStageButton(
    x: number,
    y: number,
    label: string,
    color: number,
    sceneKey: string,
  ): void {
    this.add
      .rectangle(x, y, 220, 36, color)
      .setStrokeStyle(2, THEME.panel)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start(sceneKey));

    this.add
      .text(x, y, label, { fontFamily: 'monospace', fontSize: '10px', color: THEME.textCream })
      .setOrigin(0.5);
  }
}
