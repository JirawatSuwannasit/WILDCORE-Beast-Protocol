import Phaser from 'phaser';

/**
 * A single held/released touch button, tracked by pointer identity so
 * releasing while the finger has slid off the button (a normal touch
 * gesture) still clears it - a scene-level `pointerup` release check,
 * not just the button's own `pointerup`, which would leave it "stuck
 * held" if the finger left the hit area before lifting.
 */
export class TouchButton {
  private heldByPointerId: number | null = null;

  constructor(
    scene: Phaser.Scene,
    gameObject: Phaser.GameObjects.GameObject & { setInteractive: (...args: never[]) => unknown },
  ) {
    gameObject.setInteractive({ useHandCursor: false });

    gameObject.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.heldByPointerId === null) this.heldByPointerId = pointer.id;
    });

    scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.heldByPointerId === pointer.id) this.heldByPointerId = null;
    });
  }

  get isHeld(): boolean {
    return this.heldByPointerId !== null;
  }
}
