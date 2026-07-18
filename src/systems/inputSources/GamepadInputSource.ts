import type Phaser from 'phaser';
import { NEUTRAL_INPUT, type InputSnapshot, type InputSource } from '@/systems/input';

const STICK_DEADZONE = 0.35;

/** Bluetooth gamepad mapping (GDD §2.2b: fully supported, same buffers as touch). */
export class GamepadInputSource implements InputSource {
  constructor(private readonly scene: Phaser.Scene) {}

  sample(): InputSnapshot {
    const pad = this.scene.input.gamepad?.pad1;
    if (!pad?.connected) return NEUTRAL_INPUT;

    const stickX = pad.leftStick.x;
    const left = pad.left || stickX < -STICK_DEADZONE;
    const right = pad.right || stickX > STICK_DEADZONE;
    const moveX: -1 | 0 | 1 = left === right ? 0 : left ? -1 : 1;

    return {
      moveX,
      jumpHeld: pad.A,
      shootHeld: pad.X || pad.B,
      dashHeld: pad.R1 > 0.5 || pad.L1 > 0.5,
      weaponPrevHeld: pad.L2 > 0.5,
      weaponNextHeld: pad.R2 > 0.5,
    };
  }
}
