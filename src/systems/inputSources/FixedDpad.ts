import Phaser from 'phaser';
import { touchLayout } from '@/config/touchLayout';
import { dpToLogicalPx } from '@/systems/touchScale';
import { THEME } from '@/config/theme';
import { TouchButton } from '@/systems/inputSources/TouchButton';

/** Fixed two-button D-pad alternative to the floating stick (GDD §2.2b: "player choice"). */
export class FixedDpad {
  private readonly left: TouchButton;
  private readonly right: TouchButton;

  constructor(scene: Phaser.Scene, anchorX: number, anchorY: number) {
    const size = dpToLogicalPx(scene, touchLayout.fixedDpad.buttonSizeDp);
    const gap = dpToLogicalPx(scene, touchLayout.fixedDpad.gapDp);

    const leftRect = scene.add
      .rectangle(
        anchorX - gap / 2 - size / 2,
        anchorY,
        size,
        size,
        THEME.panel,
        touchLayout.opacity,
      )
      .setScrollFactor(0)
      .setDepth(900);
    scene.add
      .text(leftRect.x, leftRect.y, '<', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: THEME.textCream,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(901);

    const rightRect = scene.add
      .rectangle(
        anchorX + gap / 2 + size / 2,
        anchorY,
        size,
        size,
        THEME.panel,
        touchLayout.opacity,
      )
      .setScrollFactor(0)
      .setDepth(900);
    scene.add
      .text(rightRect.x, rightRect.y, '>', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: THEME.textCream,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(901);

    this.left = new TouchButton(scene, leftRect);
    this.right = new TouchButton(scene, rightRect);
  }

  sampleMoveX(): -1 | 0 | 1 {
    if (this.left.isHeld === this.right.isHeld) return 0;
    return this.left.isHeld ? -1 : 1;
  }
}
