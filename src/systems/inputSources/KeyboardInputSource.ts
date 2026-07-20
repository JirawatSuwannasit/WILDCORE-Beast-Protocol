import Phaser from 'phaser';
import { NEUTRAL_INPUT, type InputSnapshot, type InputSource } from '@/systems/input';

type Keys = Record<
  | 'left'
  | 'left2'
  | 'right'
  | 'right2'
  | 'up'
  | 'up2'
  | 'down'
  | 'down2'
  | 'jump'
  | 'jump2'
  | 'shoot'
  | 'dash'
  | 'dash2'
  | 'weaponPrev'
  | 'weaponNext',
  Phaser.Input.Keyboard.Key
>;

/** Keyboard mapping for the web dev-preview (GDD §2.2b: keyboard is secondary, dev-only). */
export class KeyboardInputSource implements InputSource {
  private readonly keys: Keys | null;

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    this.keys = keyboard
      ? (keyboard.addKeys({
          left: Phaser.Input.Keyboard.KeyCodes.LEFT,
          left2: Phaser.Input.Keyboard.KeyCodes.A,
          right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
          right2: Phaser.Input.Keyboard.KeyCodes.D,
          up: Phaser.Input.Keyboard.KeyCodes.UP,
          up2: Phaser.Input.Keyboard.KeyCodes.W,
          down: Phaser.Input.Keyboard.KeyCodes.DOWN,
          down2: Phaser.Input.Keyboard.KeyCodes.S,
          jump: Phaser.Input.Keyboard.KeyCodes.Z,
          jump2: Phaser.Input.Keyboard.KeyCodes.SPACE,
          shoot: Phaser.Input.Keyboard.KeyCodes.X,
          dash: Phaser.Input.Keyboard.KeyCodes.C,
          dash2: Phaser.Input.Keyboard.KeyCodes.SHIFT,
          weaponPrev: Phaser.Input.Keyboard.KeyCodes.Q,
          weaponNext: Phaser.Input.Keyboard.KeyCodes.E,
        }) as Keys)
      : null;
  }

  sample(): InputSnapshot {
    if (!this.keys) return NEUTRAL_INPUT;

    const left = this.keys.left.isDown || this.keys.left2.isDown;
    const right = this.keys.right.isDown || this.keys.right2.isDown;
    const moveX: -1 | 0 | 1 = left === right ? 0 : left ? -1 : 1;

    const up = this.keys.up.isDown || this.keys.up2.isDown;
    const down = this.keys.down.isDown || this.keys.down2.isDown;
    const moveY: -1 | 0 | 1 = up === down ? 0 : up ? -1 : 1;

    return {
      moveX,
      moveY,
      jumpHeld: this.keys.jump.isDown || this.keys.jump2.isDown,
      dashHeld: this.keys.dash.isDown || this.keys.dash2.isDown,
      shootHeld: this.keys.shoot.isDown,
      weaponNextHeld: this.keys.weaponNext.isDown,
      weaponPrevHeld: this.keys.weaponPrev.isDown,
    };
  }
}
