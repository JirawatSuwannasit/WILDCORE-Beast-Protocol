import Phaser from 'phaser';
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

    this.add.rectangle(centerX, centerY, 260, 120, THEME.accentTeal).setStrokeStyle(2, THEME.panel);

    this.add
      .text(centerX, centerY - 12, 'STAGE SELECT', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: THEME.textCream,
      })
      .setOrigin(0.5);

    this.add
      .text(centerX, centerY + 8, '(stub - tap to enter a stage)', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: THEME.textCream,
      })
      .setOrigin(0.5);

    // currentlyOver lets a tap on the pause button (or any future UI)
    // absorb the tap instead of also triggering the scene transition.
    const handleTap = (
      _pointer: Phaser.Input.Pointer,
      currentlyOver: Phaser.GameObjects.GameObject[],
    ): void => {
      if (currentlyOver.length > 0) return;
      this.input.off('pointerdown', handleTap);
      this.scene.start('Stage');
    };
    this.input.on('pointerdown', handleTap);
  }
}
