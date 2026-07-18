import Phaser from 'phaser';
import { BaseScene } from '@/scenes/BaseScene';
import { THEME } from '@/config/theme';

export class TitleScene extends BaseScene {
  constructor() {
    super('Title');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(THEME.background);

    const { centerX } = this.safeZoneX;
    const centerY = this.scale.height / 2;

    this.add
      .rectangle(centerX, centerY - 20, 200, 60, THEME.accentAmber)
      .setStrokeStyle(2, THEME.panel);

    this.add
      .text(centerX, centerY - 20, 'WILDCORE', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: THEME.textCream,
      })
      .setOrigin(0.5);

    const prompt = this.add
      .text(centerX, centerY + 50, 'TAP TO START', {
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

    // currentlyOver lets a tap on the pause button (or any future UI)
    // absorb the tap instead of also triggering the scene transition.
    const handleTap = (
      _pointer: Phaser.Input.Pointer,
      currentlyOver: Phaser.GameObjects.GameObject[],
    ): void => {
      if (currentlyOver.length > 0) return;
      this.input.off('pointerdown', handleTap);
      this.scene.start('StageSelect');
    };
    this.input.on('pointerdown', handleTap);
  }
}
