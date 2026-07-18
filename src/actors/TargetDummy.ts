import Phaser from 'phaser';
import { THEME } from '@/config/theme';
import { getRectTexture } from '@/systems/placeholderTexture';

const DUMMY_WIDTH = 16;
const DUMMY_HEIGHT = 24;
const DUMMY_MAX_HP = 30;

/** Stationary buster target for the gym (M1 spec). Never moves, so no interpolation needed. */
export class TargetDummy extends Phaser.Physics.Arcade.Sprite {
  private hp = DUMMY_MAX_HP;
  private readonly hpText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(
      scene,
      x,
      y,
      getRectTexture(scene, 'target-dummy', DUMMY_WIDTH, DUMMY_HEIGHT, THEME.moss),
    );
    scene.add.existing(this);
    scene.physics.add.existing(this, true);

    this.hpText = scene.add
      .text(x, y - DUMMY_HEIGHT / 2 - 10, `${this.hp}`, {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: THEME.textCream,
      })
      .setOrigin(0.5);
  }

  get hitPoints(): number {
    return this.hp;
  }

  takeDamage(amount: number): void {
    if (this.hp <= 0) return;

    this.hp = Math.max(0, this.hp - amount);
    this.hpText.setText(`${this.hp}`);

    if (this.hp === 0) {
      this.setTint(0x333333);
    } else {
      this.scene.tweens.add({ targets: this, alpha: { from: 0.4, to: 1 }, duration: 100 });
    }
  }

  reset(): void {
    this.hp = DUMMY_MAX_HP;
    this.hpText.setText(`${this.hp}`);
    this.clearTint();
    this.setAlpha(1);
  }
}
