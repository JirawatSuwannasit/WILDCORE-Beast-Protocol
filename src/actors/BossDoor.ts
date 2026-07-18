import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { getRectTexture } from '@/systems/placeholderTexture';

const CLOSE_DURATION_MS = 500;

/** Shutter door sealing the boss room entrance (GDD §4). Slides down to close; stays sealed for the fight. */
export class BossDoor {
  private readonly shutter: Phaser.Physics.Arcade.Sprite;
  private closed = false;

  constructor(scene: Phaser.Scene, x: number, topY: number, width: number, height: number) {
    this.shutter = scene.physics.add.staticSprite(
      x,
      topY,
      getRectTexture(scene, `bossdoor-${width}x${height}`, width, height, THEME.accentTeal),
    );
    this.shutter.setOrigin(0.5, 0);
    this.shutter.setVisible(false);
    (this.shutter.body as Phaser.Physics.Arcade.StaticBody).enable = false;
  }

  get collider(): Phaser.Physics.Arcade.Sprite {
    return this.shutter;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  close(scene: Phaser.Scene): void {
    if (this.closed) return;
    this.closed = true;

    const targetHeight = this.shutter.displayHeight;
    this.shutter.setVisible(true);
    this.shutter.setDisplaySize(this.shutter.displayWidth, 1);
    (this.shutter.body as Phaser.Physics.Arcade.StaticBody).enable = true;

    scene.tweens.add({
      targets: this.shutter,
      displayHeight: targetHeight,
      duration: CLOSE_DURATION_MS,
      ease: 'Cubic.easeOut',
      onUpdate: () =>
        (this.shutter.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject(),
    });
  }
}
