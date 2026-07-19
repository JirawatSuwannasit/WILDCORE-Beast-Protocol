import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import type { Player } from '@/actors/Player';
import type { TargetDummy } from '@/actors/TargetDummy';
import { debugBuildEnabled, debugFlags, toggleDebugDoubleJump } from '@/systems/debugFlags';

const THREE_FINGER_COUNT = 3;

/**
 * F3 / three-finger-tap toggled debug view (M1 spec): hitboxes, state,
 * velocity, coyote/buffer indicators. Touch zones aren't drawn
 * separately - the on-screen buttons are always rendered as translucent
 * shapes at their real hit-test bounds, so they already double as their
 * own zone visualization without a redundant overlay layer.
 */
export class DebugOverlay {
  private active = false;
  private readonly worldGraphics: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private readonly doubleJumpButton: Phaser.GameObjects.Text | null;
  private readonly activePointerIds = new Set<number>();
  private threeFingerTriggered = false;

  constructor(
    scene: Phaser.Scene,
    private readonly player: Player,
    private readonly targets: readonly TargetDummy[],
  ) {
    this.worldGraphics = scene.add.graphics().setDepth(1900).setVisible(false);
    this.text = scene.add
      .text(6, 16, '', { fontFamily: 'monospace', fontSize: '9px', color: THEME.textCream })
      .setScrollFactor(0)
      .setDepth(1900)
      .setVisible(false);

    // DEBUG TOOL ONLY (see src/systems/debugFlags.ts): a tappable toggle
    // for testing traversal, only ever created/interactive in a dev/debug
    // build - `toggleDebugDoubleJump` itself is also a no-op outside one,
    // so this is a second, independent guard, not the only one.
    this.doubleJumpButton = debugBuildEnabled
      ? scene.add
          .text(scene.scale.width - 6, 16, '', {
            fontFamily: 'monospace',
            fontSize: '9px',
            color: THEME.textCream,
            backgroundColor: '#000000',
          })
          .setOrigin(1, 0)
          .setScrollFactor(0)
          .setDepth(1900)
          .setVisible(false)
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => toggleDebugDoubleJump())
      : null;

    scene.input.keyboard?.on('keydown-F3', () => this.toggle());

    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.activePointerIds.add(pointer.id);
      if (this.activePointerIds.size >= THREE_FINGER_COUNT && !this.threeFingerTriggered) {
        this.threeFingerTriggered = true;
        this.toggle();
      }
    });
    scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      this.activePointerIds.delete(pointer.id);
      if (this.activePointerIds.size < THREE_FINGER_COUNT) this.threeFingerTriggered = false;
    });
  }

  toggle(): void {
    this.active = !this.active;
    this.worldGraphics.setVisible(this.active);
    this.text.setVisible(this.active);
    this.doubleJumpButton?.setVisible(this.active);
  }

  /** Call once per render frame, after positions are finalized for this frame. */
  refresh(): void {
    if (!this.active) return;

    this.worldGraphics.clear();

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    this.worldGraphics.lineStyle(1, 0x00ff00, 1);
    this.worldGraphics.strokeRect(body.x, body.y, body.width, body.height);

    const hurtBody = this.player.hurtboxZone.body as Phaser.Physics.Arcade.Body;
    this.worldGraphics.lineStyle(1, 0xff00ff, 1);
    this.worldGraphics.strokeRect(hurtBody.x, hurtBody.y, hurtBody.width, hurtBody.height);

    this.worldGraphics.lineStyle(1, 0xffff00, 1);
    for (const dummy of this.targets) {
      const dummyBody = dummy.body as Phaser.Physics.Arcade.Body;
      this.worldGraphics.strokeRect(dummyBody.x, dummyBody.y, dummyBody.width, dummyBody.height);
    }

    const info = this.player.debugInfo;
    this.text.setText([
      `state: ${info.state}`,
      `vel: ${info.velocityX.toFixed(0)}, ${info.velocityY.toFixed(0)}`,
      `grounded: ${info.grounded}`,
      `coyote: ${info.coyoteActive}`,
      `jumpBuf: ${info.jumpBufferActive}`,
      `dashBuf: ${info.dashBufferActive}`,
      `hp: ${this.player.hitPoints}`,
    ]);

    this.doubleJumpButton?.setText(`[DEBUG] dbl-jump: ${debugFlags.doubleJump ? 'ON' : 'OFF'}`);
  }
}
