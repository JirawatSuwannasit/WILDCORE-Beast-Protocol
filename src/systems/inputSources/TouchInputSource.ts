import Phaser from 'phaser';
import { touchLayout } from '@/config/touchLayout';
import { dpToLogicalPx } from '@/systems/touchScale';
import { THEME } from '@/config/theme';
import type { InputSnapshot, InputSource } from '@/systems/input';
import { TouchButton } from '@/systems/inputSources/TouchButton';
import { FloatingStick } from '@/systems/inputSources/FloatingStick';
import { FixedDpad } from '@/systems/inputSources/FixedDpad';

export interface TouchInputZone {
  safeLeft: number;
  safeRight: number;
  worldHeight: number;
}

function makeRoundButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  diameterDp: number,
  label: string,
  color: number,
): TouchButton {
  const radius = dpToLogicalPx(scene, diameterDp) / 2;
  const circle = scene.add
    .circle(x, y, radius, color, touchLayout.opacity)
    .setScrollFactor(0)
    .setDepth(900);
  scene.add
    .text(x, y, label, { fontFamily: 'monospace', fontSize: '11px', color: THEME.textCream })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(901);
  return new TouchButton(scene, circle);
}

/**
 * Builds the on-screen touch UI (GDD §2.2b) and reports it through the
 * same InputSource interface as keyboard/gamepad. Left thumb: floating
 * stick or fixed D-pad (touchLayout.stickMode). Right thumb: A Jump,
 * B Shoot (hold = charge), C Dash, weapon-swap arrows.
 */
export class TouchInputSource implements InputSource {
  private readonly stick?: FloatingStick;
  private readonly dpad?: FixedDpad;
  private readonly jump: TouchButton;
  private readonly shoot: TouchButton;
  private readonly dash: TouchButton;
  private readonly weaponPrev: TouchButton;
  private readonly weaponNext: TouchButton;

  constructor(scene: Phaser.Scene, zone: TouchInputZone) {
    const bottom = zone.worldHeight - dpToLogicalPx(scene, 4);

    if (touchLayout.stickMode === 'floating') {
      this.stick = new FloatingStick(scene, {
        x: zone.safeLeft,
        y: zone.worldHeight * 0.35,
        width: (zone.safeRight - zone.safeLeft) * 0.5,
        height: zone.worldHeight * 0.65,
      });
    } else {
      this.dpad = new FixedDpad(
        scene,
        zone.safeLeft + dpToLogicalPx(scene, touchLayout.fixedDpad.anchorFromLeftDp),
        bottom - dpToLogicalPx(scene, touchLayout.fixedDpad.anchorFromBottomDp),
      );
    }

    const btn = touchLayout.buttons;
    this.jump = makeRoundButton(
      scene,
      zone.safeRight - dpToLogicalPx(scene, btn.jump.fromRightDp),
      bottom - dpToLogicalPx(scene, btn.jump.fromBottomDp),
      btn.diameterDp,
      'A',
      THEME.accentAmber,
    );
    this.shoot = makeRoundButton(
      scene,
      zone.safeRight - dpToLogicalPx(scene, btn.shoot.fromRightDp),
      bottom - dpToLogicalPx(scene, btn.shoot.fromBottomDp),
      btn.diameterDp,
      'B',
      THEME.accentCoral,
    );
    this.dash = makeRoundButton(
      scene,
      zone.safeRight - dpToLogicalPx(scene, btn.dash.fromRightDp),
      bottom - dpToLogicalPx(scene, btn.dash.fromBottomDp),
      btn.diameterDp,
      'C',
      THEME.accentTeal,
    );

    const swap = touchLayout.weaponSwap;
    this.weaponPrev = makeRoundButton(
      scene,
      zone.safeRight - dpToLogicalPx(scene, swap.prev.fromRightDp),
      bottom - dpToLogicalPx(scene, swap.prev.fromBottomDp),
      swap.diameterDp,
      '<',
      THEME.panel,
    );
    this.weaponNext = makeRoundButton(
      scene,
      zone.safeRight - dpToLogicalPx(scene, swap.next.fromRightDp),
      bottom - dpToLogicalPx(scene, swap.next.fromBottomDp),
      swap.diameterDp,
      '>',
      THEME.panel,
    );
  }

  /** Call once per render frame to keep the stick nub visual in sync. */
  refreshVisuals(): void {
    this.stick?.refreshVisual();
  }

  sample(): InputSnapshot {
    const moveX = this.stick ? this.stick.sampleMoveX() : (this.dpad?.sampleMoveX() ?? 0);

    return {
      moveX,
      jumpHeld: this.jump.isHeld,
      dashHeld: this.dash.isHeld,
      shootHeld: this.shoot.isHeld,
      weaponNextHeld: this.weaponNext.isHeld,
      weaponPrevHeld: this.weaponPrev.isHeld,
    };
  }
}
