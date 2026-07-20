/**
 * Normalized input state, identical regardless of source (GDD §2.2b:
 * "one input abstraction" serving touch, Bluetooth gamepad, and
 * keyboard). Sources report raw *held* state; edge detection (just
 * pressed/released, for coyote/buffer windows) happens downstream in
 * the consumer, sampled once per fixed 60Hz step - not here, and not
 * via Phaser's own per-render-frame JustDown helpers, which would be
 * out of step with the fixed simulation rate.
 */
export interface InputSnapshot {
  moveX: -1 | 0 | 1;
  /** -1 = up, 1 = down (matches world-space Y, same convention as gravity).
   * Only meaningful underwater (GDD §3.2 "swim down") - dry-land movement
   * ignores it entirely, same as moveX ignores jump. Touch sources report 0
   * (deliberately horizontal-only, see FloatingStick.ts); keyboard and
   * gamepad are the only sources that populate it. */
  moveY: -1 | 0 | 1;
  jumpHeld: boolean;
  dashHeld: boolean;
  shootHeld: boolean;
  weaponNextHeld: boolean;
  weaponPrevHeld: boolean;
}

export const NEUTRAL_INPUT: InputSnapshot = {
  moveX: 0,
  moveY: 0,
  jumpHeld: false,
  dashHeld: false,
  shootHeld: false,
  weaponNextHeld: false,
  weaponPrevHeld: false,
};

export interface InputSource {
  sample(): InputSnapshot;
}

/**
 * Merges any number of sources (touch + keyboard + gamepad can all be
 * active at once - e.g. a Bluetooth gamepad plugged into a phone).
 * Booleans OR together; opposing moveX directions from different
 * sources cancel to neutral rather than picking a winner.
 */
export class InputManager implements InputSource {
  constructor(private readonly sources: readonly InputSource[]) {}

  sample(): InputSnapshot {
    let left = false;
    let right = false;
    let up = false;
    let down = false;
    let jumpHeld = false;
    let dashHeld = false;
    let shootHeld = false;
    let weaponNextHeld = false;
    let weaponPrevHeld = false;

    for (const source of this.sources) {
      const snap = source.sample();
      if (snap.moveX < 0) left = true;
      if (snap.moveX > 0) right = true;
      if (snap.moveY < 0) up = true;
      if (snap.moveY > 0) down = true;
      jumpHeld = jumpHeld || snap.jumpHeld;
      dashHeld = dashHeld || snap.dashHeld;
      shootHeld = shootHeld || snap.shootHeld;
      weaponNextHeld = weaponNextHeld || snap.weaponNextHeld;
      weaponPrevHeld = weaponPrevHeld || snap.weaponPrevHeld;
    }

    const moveX: -1 | 0 | 1 = left === right ? 0 : left ? -1 : 1;
    const moveY: -1 | 0 | 1 = up === down ? 0 : up ? -1 : 1;

    return { moveX, moveY, jumpHeld, dashHeld, shootHeld, weaponNextHeld, weaponPrevHeld };
  }
}
